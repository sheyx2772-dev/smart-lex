import { format, money } from "@lex/core";
import { approvalRequests, auditLogs, documents, getDb, receivables, reminders, tenants, users, withTenant } from "@lex/db";
import { ERROR_CODE, fail, ok } from "@lex/shared";
import { desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { type Variables } from "../lib/context";
import { env } from "../lib/env";
import { readSub } from "../lib/subscription";

/**
 * PLATFORMA ADMIN paneli — barcha mijozlar (tenant'lar) bo'yicha kesim.
 * Faqat platforma egasi tenanti (PLATFORM_TENANT_ID) owner/admin'iga ochiq.
 * `tenants` jadvalida RLS yo'q → getDb barcha tenantlarni ko'radi; har tenant
 * metrikasi withTenant orqali (RLS ichida) yig'iladi.
 */
export const platformRoutes = new Hono<{ Variables: Variables }>();

function isPlatformAdmin(c: Parameters<Parameters<Hono<{ Variables: Variables }>["get"]>[1]>[0]): boolean {
  const { tenantId, role } = c.get("auth");
  return Boolean(env.platformTenantId) && tenantId === env.platformTenantId && (role === "owner" || role === "admin");
}

platformRoutes.get("/platform/overview", async (c) => {
  const locale = c.get("locale");
  if (!isPlatformAdmin(c)) return c.json(fail(ERROR_CODE.UNAUTHORIZED, "auth.unauthorized", locale), 403);

  const db = getDb();
  const tenantRows = await db
    .select({ id: tenants.id, name: tenants.name, type: tenants.type, tin: tenants.tin, settings: tenants.settings, createdAt: tenants.createdAt })
    .from(tenants)
    .orderBy(desc(tenants.createdAt));

  let currency = "UZS";
  let totalOutMinor = 0n;
  const totals = { tenants: tenantRows.length, users: 0, receivables: 0, documents: 0, reminders: 0, pendingApprovals: 0 };

  const list = [];
  for (const tr of tenantRows) {
    const m = await withTenant(tr.id, async (tx) => {
      const [u] = await tx.select({ n: sql<number>`count(*)::int` }).from(users);
      const [r] = await tx
        .select({ n: sql<number>`count(*)::int`, out: sql<string>`coalesce(sum(${receivables.outstandingMinor}),0)::text`, cur: sql<string | null>`max(${receivables.currency})` })
        .from(receivables);
      const [d] = await tx.select({ n: sql<number>`count(*)::int` }).from(documents);
      const [rem] = await tx.select({ n: sql<number>`count(*)::int` }).from(reminders);
      const [ap] = await tx.select({ n: sql<number>`count(*)::int` }).from(approvalRequests).where(eq(approvalRequests.status, "pending"));
      const [act] = await tx.select({ last: sql<string | null>`max(${auditLogs.createdAt})` }).from(auditLogs);
      return {
        users: u?.n ?? 0,
        receivables: r?.n ?? 0,
        outMinor: r?.out ?? "0",
        cur: r?.cur ?? "UZS",
        documents: d?.n ?? 0,
        reminders: rem?.n ?? 0,
        pending: ap?.n ?? 0,
        last: act?.last ?? null,
      };
    });
    const settings = (tr.settings ?? {}) as Record<string, unknown>;
    const cur = m.cur || "UZS";
    currency = cur;
    const outMinor = BigInt(m.outMinor || "0");
    totalOutMinor += outMinor;
    totals.users += m.users;
    totals.receivables += m.receivables;
    totals.documents += m.documents;
    totals.reminders += m.reminders;
    totals.pendingApprovals += m.pending;

    list.push({
      id: tr.id,
      name: tr.name,
      type: tr.type,
      tin: tr.tin,
      createdAt: tr.createdAt,
      users: m.users,
      receivables: m.receivables,
      outstanding: format(money(outMinor, cur)),
      documents: m.documents,
      reminders: m.reminders,
      pendingApprovals: m.pending,
      lastActivity: m.last,
      plan: typeof settings.plan === "string" ? settings.plan : null,
      limit: typeof settings.limit === "number" ? settings.limit : null,
      subscription: readSub(settings),
      ofertaAccepted: Boolean(settings.ofertaAcceptedAt),
      ofertaAcceptedAt: typeof settings.ofertaAcceptedAt === "string" ? settings.ofertaAcceptedAt : null,
      isPlatform: tr.id === env.platformTenantId,
    });
  }

  return c.json(
    ok(
      {
        totals: { ...totals, outstanding: format(money(totalOutMinor, currency)) },
        tenants: list,
      },
      "common.ok",
      locale,
    ),
  );
});

/** Bitta mijozning hujjatlari + oferta holati (ko'rish/yuklab olish uchun). */
platformRoutes.get("/platform/tenants/:id/documents", async (c) => {
  const locale = c.get("locale");
  if (!isPlatformAdmin(c)) return c.json(fail(ERROR_CODE.UNAUTHORIZED, "auth.unauthorized", locale), 403);
  const id = c.req.param("id");

  const rows = await withTenant(id, async (tx) =>
    tx
      .select({ id: documents.id, type: documents.type, title: documents.title, createdAt: documents.createdAt, extracted: documents.extracted })
      .from(documents)
      .orderBy(desc(documents.createdAt))
      .limit(300),
  );
  const items = rows.map((r) => {
    const ex = (r.extracted ?? {}) as Record<string, unknown>;
    return {
      id: r.id,
      type: r.type,
      title: r.title,
      createdAt: r.createdAt,
      signed: Boolean(ex.signature),
      body: typeof ex.body === "string" ? ex.body : "",
    };
  });

  const [t] = await getDb().select({ name: tenants.name, tin: tenants.tin, settings: tenants.settings }).from(tenants).where(eq(tenants.id, id)).limit(1);
  const s = (t?.settings ?? {}) as Record<string, unknown>;

  return c.json(
    ok(
      {
        tenant: { name: t?.name ?? "", tin: t?.tin ?? "" },
        oferta: {
          accepted: Boolean(s.ofertaAcceptedAt),
          acceptedAt: typeof s.ofertaAcceptedAt === "string" ? s.ofertaAcceptedAt : null,
          signer: typeof s.ofertaSigner === "string" ? s.ofertaSigner : null,
          method: typeof s.ofertaMethod === "string" ? s.ofertaMethod : null,
        },
        documents: items,
      },
      "common.ok",
      locale,
    ),
  );
});

/** Mijoz (tenant) tarifi va limitini o'rnatish (platforma admini). */
platformRoutes.post("/platform/tenants/:id/plan", async (c) => {
  const locale = c.get("locale");
  if (!isPlatformAdmin(c)) return c.json(fail(ERROR_CODE.UNAUTHORIZED, "auth.unauthorized", locale), 403);
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as { plan?: string; limit?: number };
  const plan = typeof body.plan === "string" ? body.plan.slice(0, 40) : undefined;
  const limit = typeof body.limit === "number" && body.limit >= 0 ? Math.floor(body.limit) : undefined;

  const db = getDb();
  const [row] = await db.select({ settings: tenants.settings }).from(tenants).where(eq(tenants.id, id)).limit(1);
  if (!row) return c.json(fail(ERROR_CODE.NOT_FOUND, "common.not_found", locale), 404);
  const settings = { ...((row.settings ?? {}) as Record<string, unknown>) };
  if (plan !== undefined) settings.plan = plan;
  if (limit !== undefined) settings.limit = limit;
  await db.update(tenants).set({ settings }).where(eq(tenants.id, id));
  return c.json(ok({ id, plan: settings.plan ?? null, limit: settings.limit ?? null }, "common.updated", locale));
});

/** Obunani faollashtirish/uzaytirish (to'lov tasdiqi) yoki to'xtatish (platforma admini). */
platformRoutes.post("/platform/tenants/:id/subscription", async (c) => {
  const locale = c.get("locale");
  if (!isPlatformAdmin(c)) return c.json(fail(ERROR_CODE.UNAUTHORIZED, "auth.unauthorized", locale), 403);
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as { plan?: string; months?: number; action?: string };

  const db = getDb();
  const [row] = await db.select({ settings: tenants.settings }).from(tenants).where(eq(tenants.id, id)).limit(1);
  if (!row) return c.json(fail(ERROR_CODE.NOT_FOUND, "common.not_found", locale), 404);
  const settings = { ...((row.settings ?? {}) as Record<string, unknown>) };
  const sub = { ...((settings.subscription ?? {}) as Record<string, unknown>) };

  if (typeof body.plan === "string") sub.plan = body.plan.slice(0, 40);
  if (body.action === "expire") {
    sub.until = new Date(Date.now() - 1000).toISOString();
  } else {
    // To'lov tasdiqlandi → obunani `months` oyga uzaytirish (mavjud muddat yoki hozirdan).
    const months = typeof body.months === "number" && body.months > 0 ? Math.min(Math.floor(body.months), 36) : 1;
    const curUntil = typeof sub.until === "string" ? Date.parse(sub.until) : 0;
    const base = curUntil > Date.now() ? curUntil : Date.now();
    sub.until = new Date(base + months * 30 * 24 * 60 * 60 * 1000).toISOString();
    sub.lastPaymentAt = new Date().toISOString();
  }
  settings.subscription = sub;
  await db.update(tenants).set({ settings }).where(eq(tenants.id, id));
  return c.json(ok({ id, subscription: readSub(settings) }, "common.updated", locale));
});
