import { auditLogs, chainAnchors, users, verifyAuditChain, withTenant } from "@lex/db";
import { ok } from "@lex/shared";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { type Variables } from "../lib/context";
import { pageMeta, pageParams } from "../lib/pagination";

export const auditRoutes = new Hono<{ Variables: Variables }>();

/** Audit jurnali — server-side sahifalash + ijrochi filtri + qidiruv. */
auditRoutes.get("/audit", async (c) => {
  const { tenantId } = c.get("auth");
  const { page, pageSize, limit, offset } = pageParams(c);
  const actor = c.req.query("actor");
  const q = (c.req.query("q") ?? "").trim();

  const conds = [];
  if (actor && actor !== "all") conds.push(eq(auditLogs.actorType, actor as "user" | "ai_agent" | "system"));
  if (q) conds.push(or(ilike(auditLogs.action, `%${q}%`), ilike(auditLogs.actorId, `%${q}%`)));
  const where = conds.length ? and(...conds) : undefined;

  const data = await withTenant(tenantId, async (tx) => {
    const count = (await tx.select({ count: sql<number>`count(*)::int` }).from(auditLogs).where(where))[0]?.count ?? 0;

    const rows = await tx
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    // Filtr chiplari uchun barqaror sanoq (filtrdan mustaqil).
    const actorCounts = await tx
      .select({ actorType: auditLogs.actorType, c: sql<number>`count(*)::int` })
      .from(auditLogs)
      .groupBy(auditLogs.actorType);
    const byActor: Record<string, number> = {};
    let allTotal = 0;
    for (const a of actorCounts) {
      byActor[a.actorType] = a.c;
      allTotal += a.c;
    }

    const userRows = await tx.select({ id: users.id, fullName: users.fullName }).from(users);
    const nameById = new Map(userRows.map((u) => [u.id, u.fullName]));

    const items = rows.map((r) => ({
      id: r.id,
      actorType: r.actorType,
      actorId: r.actorId,
      actorName: r.actorType === "user" && r.actorId ? nameById.get(r.actorId) ?? r.actorId : r.actorId,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      detail: r.detail,
      createdAt: r.createdAt,
    }));

    return { items, count, byActor, allTotal };
  });

  return c.json(
    ok(
      { items: data.items, byActor: data.byActor, allTotal: data.allTotal, ...pageMeta(data.count, page, pageSize) },
      "common.ok",
      c.get("locale"),
    ),
  );
});

/**
 * Audit zanjirining o'zgartirilmaganligini tekshiradi (har bir yozuv hash'ini
 * qayta hisoblab, saqlangan qiymat bilan solishtiradi — DB darajasidagi trigger
 * ilova kodidan mustaqil ishlaydi, shuning uchun natija ishonchli).
 */
auditRoutes.get("/audit/verify", async (c) => {
  const { tenantId } = c.get("auth");
  const status = await verifyAuditChain(tenantId);
  return c.json(ok(status, "common.ok", c.get("locale")));
});

/**
 * Zanjir "uchi"ni tashqi (Bitcoin) langarlash tarixi — OpenTimestamps orqali.
 * Ichki hash-zanjirdan farqli o'laroq, bu ISBOTNI hech kim (biz ham) o'zgartira
 * olmaydigan, mustaqil uchinchi tomon (Bitcoin blokcheyni)ga bog'laydi.
 */
auditRoutes.get("/audit/anchors", async (c) => {
  const { tenantId } = c.get("auth");
  const rows = await withTenant(tenantId, (tx) =>
    tx
      .select({
        id: chainAnchors.id,
        chainTipHash: chainAnchors.chainTipHash,
        status: chainAnchors.status,
        bitcoinBlockHeight: chainAnchors.bitcoinBlockHeight,
        confirmedAt: chainAnchors.confirmedAt,
        createdAt: chainAnchors.createdAt,
      })
      .from(chainAnchors)
      .orderBy(desc(chainAnchors.createdAt))
      .limit(20),
  );
  return c.json(ok({ items: rows }, "common.ok", c.get("locale")));
});
