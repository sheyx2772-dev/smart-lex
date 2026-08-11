import { suggestFactoringQuote } from "@lex/core";
import { contractors, financingListings, getDb, invoices, receivables, tenants, withTenant } from "@lex/db";
import { ERROR_CODE, fail, ok } from "@lex/shared";
import { and, desc, eq } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { type Variables } from "../lib/context";
import { env } from "../lib/env";

/**
 * Moliyalashtirish bozori (factoring marketplace) — "Ishonchli Reestr" modeli.
 * SmartLex talab huquqi yoki pulni O'ZIGA OLMAYDI, faqat DS-Score bilan tasdiqlangan
 * qarzlarni bank/NBKT (nobank kredit tashkiloti) xaridorlariga ko'rsatadi. Haqiqiy
 * bitim (moliyalashtirish + talab tsessiyasi) platformadan tashqarida — xaridor bilan
 * to'g'ridan-to'g'ri. Xaridor tomoni hali portal emas: MC Legal ichki panel orqali
 * qo'lda moslashtiradi (/platform/financing), real bank hamkorlar ulangach kengaytiriladi.
 */
export const financingRoutes = new Hono<{ Variables: Variables }>();

const CAN_LIST = new Set(["owner", "admin", "finance", "legal"]);

function isPlatformAdmin(c: Context<{ Variables: Variables }>): boolean {
  const { tenantId, role } = c.get("auth");
  return Boolean(env.platformTenantId) && tenantId === env.platformTenantId && (role === "owner" || role === "admin");
}

/** Bitta qarz uchun moliyalashtirish bozoriga mosligini tekshiradi (yozmasdan). */
financingRoutes.get("/financing/quote/:receivableId", async (c) => {
  const locale = c.get("locale");
  const { tenantId } = c.get("auth");
  const receivableId = c.req.param("receivableId");

  const result = await withTenant(tenantId, async (tx) => {
    const [rec] = await tx.select({ riskScore: receivables.riskScore, status: receivables.status }).from(receivables).where(eq(receivables.id, receivableId)).limit(1);
    if (!rec) return null;
    const [active] = await tx.select({ id: financingListings.id }).from(financingListings).where(and(eq(financingListings.receivableId, receivableId), eq(financingListings.status, "listed"))).limit(1);
    return { rec, activeListingId: active?.id ?? null };
  });
  if (!result) return c.json(fail(ERROR_CODE.NOT_FOUND, "common.not_found", locale), 404);

  if (result.rec.status === "paid" || result.rec.status === "written_off") {
    return c.json(ok({ eligible: false, band: "not_eligible", suggestedDiscountBps: 0, activeListingId: result.activeListingId }, "common.ok", locale));
  }
  const quote = suggestFactoringQuote(result.rec.riskScore);
  return c.json(ok({ ...quote, activeListingId: result.activeListingId }, "common.ok", locale));
});

/** Qarzni bozorga ro'yxatga qo'yish. */
financingRoutes.post("/financing/list", async (c) => {
  const locale = c.get("locale");
  const { tenantId, userId, role } = c.get("auth");
  if (!CAN_LIST.has(role)) return c.json(fail(ERROR_CODE.FORBIDDEN, "auth.forbidden", locale), 403);
  const body = (await c.req.json().catch(() => ({}))) as { receivableId?: string; requestedDiscountBps?: number };
  const receivableId = String(body.receivableId ?? "");
  if (!receivableId) return c.json(fail(ERROR_CODE.VALIDATION_FAILED, "common.validation_failed", locale), 422);
  const requestedDiscountBps =
    typeof body.requestedDiscountBps === "number" && Number.isFinite(body.requestedDiscountBps) ? Math.max(0, Math.min(5000, Math.round(body.requestedDiscountBps))) : undefined;

  const result = await withTenant(tenantId, async (tx) => {
    const [rec] = await tx
      .select({ riskScore: receivables.riskScore, status: receivables.status, outstandingMinor: receivables.outstandingMinor, penaltyMinor: receivables.penaltyMinor, currency: receivables.currency })
      .from(receivables)
      .where(eq(receivables.id, receivableId))
      .limit(1);
    if (!rec) return "not_found" as const;
    if (rec.status === "paid" || rec.status === "written_off") return "not_eligible" as const;

    const [active] = await tx.select({ id: financingListings.id }).from(financingListings).where(and(eq(financingListings.receivableId, receivableId), eq(financingListings.status, "listed"))).limit(1);
    if (active) return "already_listed" as const;

    const quote = suggestFactoringQuote(rec.riskScore);
    if (!quote.eligible) return "not_eligible" as const;

    const [created] = await tx
      .insert(financingListings)
      .values({
        tenantId,
        receivableId,
        amountMinor: rec.outstandingMinor + (rec.penaltyMinor ?? 0n),
        currency: rec.currency as "UZS",
        riskScoreAtListing: rec.riskScore,
        suggestedDiscountBps: quote.suggestedDiscountBps,
        requestedDiscountBps: requestedDiscountBps ?? quote.suggestedDiscountBps,
      })
      .returning({ id: financingListings.id });
    return { id: created!.id };
  });

  if (result === "not_found") return c.json(fail(ERROR_CODE.NOT_FOUND, "common.not_found", locale), 404);
  if (result === "not_eligible") return c.json(fail(ERROR_CODE.VALIDATION_FAILED, "financing.not_eligible", locale), 422);
  if (result === "already_listed") return c.json(fail(ERROR_CODE.CONFLICT, "financing.already_listed", locale), 409);
  return c.json(ok(result, "common.created", locale));
});

/** Ro'yxatdan olib tashlash (sotuvchi fikridan qaytdi). */
financingRoutes.post("/financing/:id/withdraw", async (c) => {
  const locale = c.get("locale");
  const { tenantId, role } = c.get("auth");
  if (!CAN_LIST.has(role)) return c.json(fail(ERROR_CODE.FORBIDDEN, "auth.forbidden", locale), 403);
  const id = c.req.param("id");

  const updated = await withTenant(tenantId, (tx) =>
    tx
      .update(financingListings)
      .set({ status: "withdrawn", resolvedAt: new Date() })
      .where(and(eq(financingListings.id, id), eq(financingListings.status, "listed")))
      .returning({ id: financingListings.id }),
  );
  if (updated.length === 0) return c.json(fail(ERROR_CODE.NOT_FOUND, "common.not_found", locale), 404);
  return c.json(ok({ ok: true }, "common.updated", locale));
});

/** Tenant'ning o'z ro'yxatlari. */
financingRoutes.get("/financing/listings", async (c) => {
  const locale = c.get("locale");
  const { tenantId } = c.get("auth");
  const rows = await withTenant(tenantId, (tx) =>
    tx
      .select({
        id: financingListings.id,
        status: financingListings.status,
        amountMinor: financingListings.amountMinor,
        currency: financingListings.currency,
        riskScoreAtListing: financingListings.riskScoreAtListing,
        suggestedDiscountBps: financingListings.suggestedDiscountBps,
        requestedDiscountBps: financingListings.requestedDiscountBps,
        matchedPartnerName: financingListings.matchedPartnerName,
        matchedDiscountBps: financingListings.matchedDiscountBps,
        createdAt: financingListings.createdAt,
        contractorName: contractors.name,
      })
      .from(financingListings)
      .innerJoin(receivables, eq(financingListings.receivableId, receivables.id))
      .innerJoin(contractors, eq(receivables.contractorId, contractors.id))
      .orderBy(desc(financingListings.createdAt)),
  );
  return c.json(ok({ items: rows }, "common.ok", locale));
});

// ─── Platforma admin (MC Legal) — barcha tenantlar bo'yicha, xaridorlar bilan qo'lda moslashtirish ───

financingRoutes.get("/platform/financing", async (c) => {
  const locale = c.get("locale");
  if (!isPlatformAdmin(c)) return c.json(fail(ERROR_CODE.UNAUTHORIZED, "auth.unauthorized", locale), 403);

  const tenantRows = await getDb().select({ id: tenants.id, name: tenants.name }).from(tenants);
  const items: Record<string, unknown>[] = [];
  for (const t of tenantRows) {
    const rows = await withTenant(t.id, (tx) =>
      tx
        .select({
          id: financingListings.id,
          status: financingListings.status,
          amountMinor: financingListings.amountMinor,
          currency: financingListings.currency,
          riskScoreAtListing: financingListings.riskScoreAtListing,
          suggestedDiscountBps: financingListings.suggestedDiscountBps,
          requestedDiscountBps: financingListings.requestedDiscountBps,
          matchedPartnerName: financingListings.matchedPartnerName,
          matchedDiscountBps: financingListings.matchedDiscountBps,
          createdAt: financingListings.createdAt,
          contractorName: contractors.name,
          invoiceNumber: invoices.number,
        })
        .from(financingListings)
        .innerJoin(receivables, eq(financingListings.receivableId, receivables.id))
        .innerJoin(contractors, eq(receivables.contractorId, contractors.id))
        .leftJoin(invoices, eq(receivables.invoiceId, invoices.id))
        .where(eq(financingListings.status, "listed"))
        .orderBy(desc(financingListings.createdAt)),
    );
    for (const r of rows) items.push({ ...r, tenantId: t.id, tenantName: t.name });
  }
  return c.json(ok({ items }, "common.ok", locale));
});

/** MC Legal xaridor bilan bitim tuzilganini qo'lda qayd etadi. */
financingRoutes.post("/platform/financing/:id/match", async (c) => {
  const locale = c.get("locale");
  if (!isPlatformAdmin(c)) return c.json(fail(ERROR_CODE.UNAUTHORIZED, "auth.unauthorized", locale), 403);
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as { tenantId?: string; matchedPartnerName?: string; matchedDiscountBps?: number; status?: string };
  const listingTenantId = String(body.tenantId ?? "");
  if (!listingTenantId) return c.json(fail(ERROR_CODE.VALIDATION_FAILED, "common.validation_failed", locale), 422);
  const status = body.status === "completed" ? "completed" : "matched";
  const matchedPartnerName = typeof body.matchedPartnerName === "string" ? body.matchedPartnerName.slice(0, 200) : "";
  const matchedDiscountBps = typeof body.matchedDiscountBps === "number" && Number.isFinite(body.matchedDiscountBps) ? Math.round(body.matchedDiscountBps) : null;

  const updated = await withTenant(listingTenantId, (tx) =>
    tx
      .update(financingListings)
      .set({ status, matchedPartnerName, matchedDiscountBps, matchedAt: new Date(), ...(status === "completed" ? { resolvedAt: new Date() } : {}) })
      .where(eq(financingListings.id, id))
      .returning({ id: financingListings.id }),
  );
  if (updated.length === 0) return c.json(fail(ERROR_CODE.NOT_FOUND, "common.not_found", locale), 404);
  return c.json(ok({ ok: true }, "common.updated", locale));
});
