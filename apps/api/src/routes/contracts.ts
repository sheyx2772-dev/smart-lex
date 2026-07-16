import { calcPenalty, calcRisk, evaluateReceivable, money } from "@lex/core";
import { auditLogs, contractors, contracts, invoices, receivables, withTenant } from "@lex/db";
import { ERROR_CODE, fail, ok } from "@lex/shared";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { type Variables } from "../lib/context";
import { contractCreateSchema, validate } from "../lib/validation";

export const contractRoutes = new Hono<{ Variables: Variables }>();

const CAN_CREATE = new Set(["owner", "admin", "finance", "legal"]);

/**
 * Yangi shartnoma + invoice yaratish. AI-first: kontragent STIR bo'yicha mavjud bo'lsa
 * qayta ishlatiladi (Part 11 — "never ask twice"), yangi invoice darhol baholanadi
 * (receivable snapshot) — shu zahoti Dashboard/Receivables/Case View'da ko'rinadi.
 */
contractRoutes.post("/contracts", async (c) => {
  const locale = c.get("locale");
  const { tenantId, role, userId } = c.get("auth");
  if (!CAN_CREATE.has(role)) return c.json(fail(ERROR_CODE.FORBIDDEN, "auth.forbidden", locale), 403);

  const parsed = validate(contractCreateSchema, await c.req.json().catch(() => null));
  if (!parsed.ok) return c.json(fail(ERROR_CODE.VALIDATION_FAILED, "common.validation_failed", locale, { fields: parsed.fields }), 422);
  const d = parsed.data;

  const result = await withTenant(tenantId, async (tx) => {
    // 1) Kontragent — mavjud (id yoki STIR) bo'lsa qayta ishlatamiz.
    let contractorId = d.contractorId ?? null;
    if (!contractorId && d.contractor) {
      const [existing] = await tx
        .select({ id: contractors.id })
        .from(contractors)
        .where(and(eq(contractors.tenantId, tenantId), eq(contractors.tin, d.contractor.tin)))
        .limit(1);
      if (existing) {
        contractorId = existing.id;
      } else {
        const [created] = await tx
          .insert(contractors)
          .values({
            tenantId,
            name: d.contractor.name,
            tin: d.contractor.tin,
            legalAddress: d.contractor.legalAddress ?? null,
            phone: d.contractor.phone ?? null,
            email: d.contractor.email ?? null,
          })
          .returning({ id: contractors.id });
        contractorId = created!.id;
      }
    }
    if (!contractorId) return { error: "contractor" as const };

    // 2) Shartnoma
    const [contract] = await tx
      .insert(contracts)
      .values({
        tenantId,
        contractorId,
        number: d.number,
        signedAt: d.signedAt ? new Date(d.signedAt) : null,
        penaltyDailyBps: d.penaltyDailyBps,
        penaltyCapBps: d.penaltyCapBps ?? null,
      })
      .returning();

    // 3) Invoice
    const amountMinor = BigInt(d.invoice.amountMinor);
    const [invoice] = await tx
      .insert(invoices)
      .values({
        tenantId,
        contractId: contract!.id,
        contractorId,
        number: d.invoice.number,
        amountMinor,
        currency: "UZS",
        issuedAt: new Date(d.invoice.issuedAt),
        dueDate: new Date(d.invoice.dueDate),
      })
      .returning();

    // 4) Darhol baholash → receivable snapshot (deterministik core).
    const now = new Date();
    const state = evaluateReceivable({ invoiced: money(amountMinor, "UZS"), paid: money(0n, "UZS"), dueDate: invoice!.dueDate, now });
    const penalty = calcPenalty(state.outstanding, { dailyRateBps: d.penaltyDailyBps, capBps: d.penaltyCapBps ?? undefined }, invoice!.dueDate, now).penalty;
    const risk = calcRisk({ maxOverdueDays: state.overdueDays, outstandingRatio: 1, latePaymentCount: 0, priorDemandCount: 0 });

    await tx.insert(receivables).values({
      tenantId,
      invoiceId: invoice!.id,
      contractorId,
      status: state.status,
      outstandingMinor: state.outstanding.minor,
      penaltyMinor: penalty.minor,
      currency: "UZS",
      overdueDays: state.overdueDays,
      agingBucket: state.agingBucket,
      riskScore: risk.score,
      executedStages: [],
      lastEvaluatedAt: now,
    });

    await tx.insert(auditLogs).values({
      tenantId,
      actorType: "user",
      actorId: userId,
      action: "contract.created",
      entityType: "contract",
      entityId: contract!.id,
      detail: { number: d.number, invoice: d.invoice.number },
    });

    return { contractorId, contractId: contract!.id, invoiceId: invoice!.id, status: state.status };
  });

  if ("error" in result) return c.json(fail(ERROR_CODE.VALIDATION_FAILED, "common.validation_failed", locale, { fields: { contractor: "required" } }), 422);
  return c.json(ok(result, "common.created", locale));
});
