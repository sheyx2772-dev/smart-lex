import { auditLogs, contractors, contracts, documents, withTenant } from "@lex/db";
import { DOCUMENT_TYPES, ERROR_CODE, fail, ok } from "@lex/shared";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { type Variables } from "../lib/context";
import { pageMeta, pageParams } from "../lib/pagination";
import { documentSignSchema, validate } from "../lib/validation";

export const documentRoutes = new Hono<{ Variables: Variables }>();

const CAN_SIGN = new Set(["owner", "admin", "legal", "finance"]);

/**
 * Hujjatlar ombori — YENGIL ro'yxat (metadata only, og'ir `extracted.body` tortilmaydi),
 * server-side sahifalash + tur filtri + qidiruv. To'liq matn `/documents/:id` orqali.
 */
documentRoutes.get("/documents", async (c) => {
  const { tenantId } = c.get("auth");
  const { page, pageSize, limit, offset } = pageParams(c);
  const typeParam = c.req.query("type");
  const q = (c.req.query("q") ?? "").trim();

  const data = await withTenant(tenantId, async (tx) => {
    const conds = [];
    if (typeParam && typeParam !== "all" && (DOCUMENT_TYPES as readonly string[]).includes(typeParam))
      conds.push(eq(documents.type, typeParam as (typeof DOCUMENT_TYPES)[number]));
    if (q) conds.push(or(ilike(documents.title, `%${q}%`), ilike(contractors.name, `%${q}%`)));
    const where = conds.length ? and(...conds) : undefined;

    const countRows = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(documents)
      .leftJoin(contractors, eq(documents.contractorId, contractors.id))
      .where(where);
    const count = countRows[0]?.count ?? 0;

    const rows = await tx
      .select({
        id: documents.id,
        type: documents.type,
        title: documents.title,
        didoxId: documents.didoxId,
        createdAt: documents.createdAt,
        contractorName: contractors.name,
        contractNumber: contracts.number,
        hasBody: sql<boolean>`(${documents.extracted} ->> 'body') is not null`,
      })
      .from(documents)
      .leftJoin(contractors, eq(documents.contractorId, contractors.id))
      .leftJoin(contracts, eq(documents.contractId, contracts.id))
      .where(where)
      .orderBy(desc(documents.createdAt))
      .limit(limit)
      .offset(offset);

    // Filtr chiplari uchun barqaror sanoq (filtrdan mustaqil).
    const typeCounts = await tx.select({ k: documents.type, c: sql<number>`count(*)::int` }).from(documents).groupBy(documents.type);
    const byType: Record<string, number> = {};
    let allTotal = 0;
    for (const x of typeCounts) {
      byType[x.k] = x.c;
      allTotal += x.c;
    }

    return { items: rows, count, byType, allTotal };
  });

  return c.json(
    ok({ items: data.items, byType: data.byType, allTotal: data.allTotal, ...pageMeta(data.count, page, pageSize) }, "common.ok", c.get("locale")),
  );
});

/** Bitta hujjatning to'liq tafsiloti — matn (extracted) shu yerda tortiladi. */
documentRoutes.get("/documents/:id", async (c) => {
  const { tenantId } = c.get("auth");
  const id = c.req.param("id");

  const [row] = await withTenant(tenantId, (tx) =>
    tx
      .select({
        id: documents.id,
        type: documents.type,
        title: documents.title,
        didoxId: documents.didoxId,
        s3Key: documents.s3Key,
        extracted: documents.extracted,
        createdAt: documents.createdAt,
        contractorName: contractors.name,
        contractNumber: contracts.number,
      })
      .from(documents)
      .leftJoin(contractors, eq(documents.contractorId, contractors.id))
      .leftJoin(contracts, eq(documents.contractId, contracts.id))
      .where(eq(documents.id, id))
      .limit(1),
  );

  return c.json(ok(row ?? null, "common.ok", c.get("locale")));
});

/** Hujjatni E-IMZO bilan imzolash (imzo client tomonda qo'yilgan — server saqlaydi). */
documentRoutes.post("/documents/:id/sign", async (c) => {
  const locale = c.get("locale");
  const { tenantId, userId, role } = c.get("auth");
  if (!CAN_SIGN.has(role)) return c.json(fail(ERROR_CODE.FORBIDDEN, "auth.forbidden", locale), 403);

  const parsed = validate(documentSignSchema, await c.req.json().catch(() => null));
  if (!parsed.ok) return c.json(fail(ERROR_CODE.VALIDATION_FAILED, "common.validation_failed", locale, { fields: parsed.fields }), 422);
  const id = c.req.param("id");
  const sig = parsed.data.signature;

  const done = await withTenant(tenantId, async (tx) => {
    const [doc] = await tx.select({ id: documents.id, extracted: documents.extracted }).from(documents).where(eq(documents.id, id)).limit(1);
    if (!doc) return false;
    await tx
      .update(documents)
      .set({ extracted: { ...((doc.extracted ?? {}) as object), signature: sig } })
      .where(eq(documents.id, id));
    await tx.insert(auditLogs).values({
      tenantId,
      actorType: "user",
      actorId: userId,
      action: "document.signed",
      entityType: "document",
      entityId: id,
      detail: { signer: sig.signerName, certSerial: sig.certSerial, provider: sig.provider },
    });
    return true;
  });

  if (!done) return c.json(fail(ERROR_CODE.NOT_FOUND, "common.not_found", locale), 404);
  return c.json(ok({ signed: true }, "common.updated", locale));
});
