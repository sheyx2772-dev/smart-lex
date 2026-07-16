import { contractors, invoices, receivables, reminders, withTenant } from "@lex/db";
import { ok } from "@lex/shared";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { type Variables } from "../lib/context";
import { pageMeta, pageParams } from "../lib/pagination";

export const reminderRoutes = new Hono<{ Variables: Variables }>();

/** Yuborilgan eslatmalar jurnali — server-side sahifalash + kanal/holat filtri + qidiruv. */
reminderRoutes.get("/reminders", async (c) => {
  const { tenantId } = c.get("auth");
  const { page, pageSize, limit, offset } = pageParams(c);
  const channel = c.req.query("channel");
  const status = c.req.query("status");
  const q = (c.req.query("q") ?? "").trim();

  const data = await withTenant(tenantId, async (tx) => {
    const conds = [];
    if (channel && channel !== "all")
      conds.push(eq(reminders.channel, channel as "sms" | "email" | "telegram" | "hybrid_post"));
    if (status && status !== "all")
      conds.push(eq(reminders.status, status as "queued" | "sent" | "delivered" | "failed"));
    if (q) conds.push(or(ilike(contractors.name, `%${q}%`), ilike(reminders.address, `%${q}%`), ilike(invoices.number, `%${q}%`)));
    const where = conds.length ? and(...conds) : undefined;

    const countRows = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(reminders)
      .innerJoin(receivables, eq(reminders.receivableId, receivables.id))
      .innerJoin(contractors, eq(receivables.contractorId, contractors.id))
      .innerJoin(invoices, eq(receivables.invoiceId, invoices.id))
      .where(where);
    const count = countRows[0]?.count ?? 0;

    const rows = await tx
      .select({
        id: reminders.id,
        stage: reminders.stage,
        channel: reminders.channel,
        status: reminders.status,
        address: reminders.address,
        body: reminders.body,
        paymentLink: reminders.paymentLink,
        sentAt: reminders.sentAt,
        createdAt: reminders.createdAt,
        contractorName: contractors.name,
        contractorTin: contractors.tin,
        invoiceNumber: invoices.number,
      })
      .from(reminders)
      .innerJoin(receivables, eq(reminders.receivableId, receivables.id))
      .innerJoin(contractors, eq(receivables.contractorId, contractors.id))
      .innerJoin(invoices, eq(receivables.invoiceId, invoices.id))
      .where(where)
      .orderBy(desc(reminders.createdAt))
      .limit(limit)
      .offset(offset);

    // Filtr chiplari uchun barqaror sanoq (filtrdan mustaqil).
    const chan = await tx.select({ k: reminders.channel, c: sql<number>`count(*)::int` }).from(reminders).groupBy(reminders.channel);
    const stat = await tx.select({ k: reminders.status, c: sql<number>`count(*)::int` }).from(reminders).groupBy(reminders.status);
    const byChannel: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let allTotal = 0;
    for (const x of chan) {
      byChannel[x.k] = x.c;
      allTotal += x.c;
    }
    for (const x of stat) byStatus[x.k] = x.c;

    return { items: rows, count, byChannel, byStatus, allTotal };
  });

  return c.json(
    ok(
      { items: data.items, byChannel: data.byChannel, byStatus: data.byStatus, allTotal: data.allTotal, ...pageMeta(data.count, page, pageSize) },
      "common.ok",
      c.get("locale"),
    ),
  );
});
