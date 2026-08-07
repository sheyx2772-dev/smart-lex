import { generateReminderText } from "@lex/agents";
import { money } from "@lex/core";
import { contractors, invoices, receivables, reminders, withTenant } from "@lex/db";
import { createNotifier } from "@lex/integrations";
import { ok } from "@lex/shared";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { type Variables } from "../lib/context";
import { pageMeta, pageParams } from "../lib/pagination";

export const reminderRoutes = new Hono<{ Variables: Variables }>();

/**
 * Har bir kanal HAQIQATAN ulanganmi (real yetkazib beruvchi) yoki hozircha
 * simulyatsiya rejimida (jurnalga yoziladi, lekin qarzdorga yetib bormaydi) —
 * bu holat ilgari hech qayerda ko'rsatilmagan edi.
 */
reminderRoutes.get("/reminders/channel-status", async (c) => {
  const smsReal = Boolean(process.env.ESKIZ_TOKEN || (process.env.ESKIZ_EMAIL && process.env.ESKIZ_PASSWORD));
  return c.json(
    ok(
      { sms: smsReal, email: false, telegram: false, hybrid_post: false },
      "common.ok",
      c.get("locale"),
    ),
  );
});

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

/**
 * Qo'lda eslatma yuborish (SMS) — qarzdorga darhol. Eskiz kaliti bo'lsa REAL SMS,
 * bo'lmasa simulyatsiya (jurnalga yoziladi, `simulated: true`). Talabnoma emas —
 * bu oddiy eslatma; talabnoma E-IMZO + Didox orqali (Tasdiqlar oqimida).
 */
reminderRoutes.post("/reminders/send", async (c) => {
  const { tenantId } = c.get("auth");
  const locale = c.get("locale");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const receivableId = String(body.receivableId ?? "");
  const stage: "soft_reminder" | "firm_reminder" = body.stage === "firm_reminder" ? "firm_reminder" : "soft_reminder";
  if (!receivableId) return c.json(ok({ status: "failed", error: "no_receivable" }, "common.ok", locale));

  const out = await withTenant(tenantId, async (tx) => {
    const [row] = await tx
      .select({
        outstandingMinor: receivables.outstandingMinor,
        currency: receivables.currency,
        overdueDays: receivables.overdueDays,
        contractorName: contractors.name,
        phone: contractors.phone,
        email: contractors.email,
        invoiceNumber: invoices.number,
      })
      .from(receivables)
      .innerJoin(contractors, eq(receivables.contractorId, contractors.id))
      .innerJoin(invoices, eq(receivables.invoiceId, invoices.id))
      .where(eq(receivables.id, receivableId))
      .limit(1);
    if (!row) return { status: "failed" as const, error: "not_found" };
    const phone = row.phone?.trim() ?? "";
    const address = phone || row.email?.trim() || "";
    if (!address) return { status: "failed" as const, error: "no_contact" };
    const channel: "sms" | "email" = phone ? "sms" : "email";

    const text = generateReminderText({
      stage,
      locale,
      debtorName: row.contractorName,
      amount: money(row.outstandingMinor, row.currency),
      invoiceNumbers: [row.invoiceNumber],
      overdueDays: row.overdueDays,
    });
    const res = await createNotifier(channel).send({ channel, address, body: text });
    const [ins] = await tx
      .insert(reminders)
      .values({
        tenantId,
        receivableId,
        stage,
        channel,
        status: res.status === "sent" ? "sent" : "failed",
        address,
        body: text,
        sentAt: res.status === "sent" ? new Date() : null,
      })
      .returning({ id: reminders.id });

    const smsConfigured = Boolean(process.env.ESKIZ_TOKEN || (process.env.ESKIZ_EMAIL && process.env.ESKIZ_PASSWORD));
    return {
      id: ins?.id ?? null,
      status: res.status,
      channel,
      address,
      simulated: channel === "sms" ? !smsConfigured : true,
      preview: text.slice(0, 220),
      error: res.error ?? null,
    };
  });
  return c.json(ok(out, "common.ok", locale));
});
