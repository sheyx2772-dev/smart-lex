import { approvalRequests, auditLogs, contractors, getDb, invoices, receivables, reminders, tenants, withTenant } from "@lex/db";
import { createDataSource, DidoxDataSource } from "@lex/integrations";
import { ERROR_CODE, fail, ok } from "@lex/shared";
import { decryptSecret } from "@lex/shared/secrets";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { type Variables } from "../lib/context";
import { canUsePaid } from "../lib/subscription";

/**
 * Talabnomani Didox orqali RASMIY yuborish (2 qadam, imzo foydalanuvchi mashinasida):
 *  1) prepare  → Didox'dan talabnoma olib, create → imzolanadigan `toSign` (JSON) qaytadi;
 *  2) (front)  → foydalanuvchi `toSign`ni E-IMZO bilan imzolaydi (PKCS7);
 *  3) sign     → PKCS7 Didox'ga → talabnoma jo'natiladi + tasdiq yopiladi + bosqich ilgarilaydi.
 * Server imzolamaydi. Didox kaliti (env) yo'q bo'lsa — available:false.
 */
export const didoxNotifyRoutes = new Hono<{ Variables: Variables }>();

/** Didox real adapteri — tenant kaliti (yoki env), aks holda null. */
function didoxSource(settings?: unknown): DidoxDataSource | null {
  const integrations = ((settings as Record<string, unknown>)?.integrations ?? {}) as Record<string, string>;
  const src = createDataSource("company", { userKey: decryptSecret(integrations.didoxToken) }); // company/marketplace/government
  return src instanceof DidoxDataSource ? src : null;
}

/** 1-qadam: talabnomani Didox'da yaratib, imzolanadigan `toSign`ni qaytaradi. */
didoxNotifyRoutes.post("/approvals/:id/didox/prepare", async (c) => {
  const { tenantId } = c.get("auth");
  const locale = c.get("locale");
  const id = c.req.param("id");
  // Obuna gate — Didox rasmiy yuborish PULLI amal (trial/active kerak).
  const [subRow] = await getDb().select({ settings: tenants.settings }).from(tenants).where(eq(tenants.id, c.get("auth").tenantId)).limit(1);
  if (!canUsePaid(subRow?.settings)) return c.json(ok({ available: false, reason: "subscription_required" }, "common.ok", locale));
  const src = didoxSource(subRow?.settings);
  if (!src) return c.json(ok({ available: false, reason: "not_configured" }, "common.ok", locale));

  const info = await withTenant(tenantId, async (tx) => {
    const [ap] = await tx
      .select({ receivableId: approvalRequests.receivableId, type: approvalRequests.type })
      .from(approvalRequests)
      .where(eq(approvalRequests.id, id))
      .limit(1);
    if (!ap || ap.type !== "demand_letter" || !ap.receivableId) return null;
    const [row] = await tx
      .select({ didoxId: invoices.didoxId })
      .from(receivables)
      .innerJoin(invoices, eq(receivables.invoiceId, invoices.id))
      .where(eq(receivables.id, ap.receivableId))
      .limit(1);
    return { didoxId: row?.didoxId ?? null };
  });
  if (!info) return c.json(fail(ERROR_CODE.NOT_FOUND, "common.not_found", locale), 404);
  if (!info.didoxId) return c.json(ok({ available: false, reason: "no_didox_invoice" }, "common.ok", locale));

  try {
    const base64 = await src.getDebtorNotification([info.didoxId]);
    if (!base64) return c.json(ok({ available: false, reason: "empty_notification" }, "common.ok", locale));
    const { toSign } = await src.createDebtorNotification(base64);
    return c.json(ok({ available: true, toSign }, "common.ok", locale));
  } catch (e) {
    return c.json(ok({ available: false, reason: "didox_error", detail: String((e as Error)?.message ?? e).slice(0, 200) }, "common.ok", locale));
  }
});

/** 2-qadam: E-IMZO PKCS7 → Didox'ga jo'natish + tasdiqni yopish. */
didoxNotifyRoutes.post("/approvals/:id/didox/sign", async (c) => {
  const { tenantId, userId } = c.get("auth");
  const locale = c.get("locale");
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as { pkcs7?: string };
  const pkcs7 = String(body.pkcs7 ?? "").slice(0, 200_000); // PKCS7 imzo odatda bir necha KB — tashqi Didox chaqiruvini haddan tashqari katta yuklamadan himoya qiladi
  if (!pkcs7) return c.json(ok({ status: "failed", error: "no_signature" }, "common.ok", locale));
  const [signRow] = await getDb().select({ settings: tenants.settings }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const src = didoxSource(signRow?.settings);
  if (!src) return c.json(ok({ status: "failed", error: "not_configured" }, "common.ok", locale));

  try {
    await src.signDebtorNotification(pkcs7);
  } catch (e) {
    return c.json(ok({ status: "failed", error: String((e as Error)?.message ?? e).slice(0, 200) }, "common.ok", locale));
  }

  const out = await withTenant(tenantId, async (tx) => {
    const [ap] = await tx
      .update(approvalRequests)
      .set({ status: "approved", decidedByUserId: userId, decidedAt: new Date() })
      .where(eq(approvalRequests.id, id))
      .returning();
    if (!ap) return null;
    if (ap.receivableId) {
      const [rec] = await tx.select().from(receivables).where(eq(receivables.id, ap.receivableId)).limit(1);
      if (rec) {
        const [contractor] = await tx.select().from(contractors).where(eq(contractors.id, rec.contractorId)).limit(1);
        const payload = (ap.payload ?? {}) as Record<string, unknown>;
        await tx.insert(reminders).values({
          tenantId,
          receivableId: rec.id,
          stage: "demand_letter",
          channel: "hybrid_post", // rasmiy hujjat kanali (Didox); audit'da tafsilot
          status: "sent",
          address: contractor?.email ?? contractor?.phone ?? "Didox",
          body: typeof payload.body === "string" ? payload.body : "",
          sentAt: new Date(),
        });
        const stages = new Set<string>(rec.executedStages ?? []);
        stages.add("demand_letter");
        await tx.update(receivables).set({ executedStages: [...stages] }).where(eq(receivables.id, rec.id));
      }
    }
    await tx.insert(auditLogs).values({
      tenantId,
      actorType: "user",
      actorId: userId,
      action: "demand.sent_didox",
      entityType: "receivable",
      entityId: ap.receivableId,
      detail: { channel: "didox" },
    });
    return { status: "sent" as const, id: ap.id };
  });
  if (!out) return c.json(fail(ERROR_CODE.NOT_FOUND, "common.not_found", locale), 404);
  return c.json(ok(out, "common.ok", locale));
});
