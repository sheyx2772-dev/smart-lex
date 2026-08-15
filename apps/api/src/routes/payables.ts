import { format, money } from "@lex/core";
import { contractors, payables, withTenant } from "@lex/db";
import { ok } from "@lex/shared";
import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { type Variables } from "../lib/context";

/**
 * Kreditorlik — tenantning O'Z krediti (boshqaga qarzdorligi). Didox'dan kiruvchi
 * hujjatlar shu yerga tushadi (packages/integrations/src/sync.ts). Undiruv jarayoniga
 * (debt_cases, reminders, court) UMUMAN kirmaydi — faqat nazorat/ko'rish uchun.
 */
export const payableRoutes = new Hono<{ Variables: Variables }>();

payableRoutes.get("/payables", async (c) => {
  const { tenantId } = c.get("auth");
  const locale = c.get("locale");

  const rows = await withTenant(tenantId, (tx) =>
    tx
      .select({
        id: payables.id,
        number: payables.number,
        amountMinor: payables.amountMinor,
        currency: payables.currency,
        issuedAt: payables.issuedAt,
        dueDate: payables.dueDate,
        contractorName: contractors.name,
        contractorTin: contractors.tin,
      })
      .from(payables)
      .innerJoin(contractors, eq(payables.contractorId, contractors.id))
      .orderBy(desc(payables.issuedAt)),
  );

  let totalMinor = 0n;
  const currency = rows[0]?.currency ?? "UZS";
  const items = rows.map((r) => {
    totalMinor += r.amountMinor;
    return {
      id: r.id,
      number: r.number,
      amount: format(money(r.amountMinor, r.currency)),
      issuedAt: r.issuedAt,
      dueDate: r.dueDate,
      contractorName: r.contractorName,
      contractorTin: r.contractorTin,
    };
  });

  return c.json(
    ok(
      { items, total: items.length, totalAmount: format(money(totalMinor, currency)) },
      "common.ok",
      locale,
    ),
  );
});
