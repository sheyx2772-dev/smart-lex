import { type AgingBucket, format, money } from "@lex/core";
import { contractors, invoices, payments, receivables, withTenant } from "@lex/db";
import { COLLECTION_STAGES, ok, type ReceivableStatus } from "@lex/shared";
import { desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { type Variables } from "../lib/context";

export const reportRoutes = new Hono<{ Variables: Variables }>();

const amount = (minor: bigint, currency: string) => ({
  minor: minor.toString(),
  formatted: format(money(minor, currency)),
});

const AGING_BUCKETS: AgingBucket[] = ["current", "1_30", "31_60", "61_90", "90_plus"];

/**
 * Hisobotlar — qarz yoshi tahlili, moliyaviy xulosa, undiruv samaradorligi,
 * risk taqsimoti va 6 oylik dinamika. Bitta so'rovda barcha analitika.
 */
reportRoutes.get("/reports", async (c) => {
  const { tenantId } = c.get("auth");

  const data = await withTenant(tenantId, async (tx) => {
    const recs = await tx
      .select({
        status: receivables.status,
        outstandingMinor: receivables.outstandingMinor,
        penaltyMinor: receivables.penaltyMinor,
        currency: receivables.currency,
        agingBucket: receivables.agingBucket,
        riskScore: receivables.riskScore,
        executedStages: receivables.executedStages,
      })
      .from(receivables);

    const currency = recs[0]?.currency ?? "UZS";

    // ── Qarz yoshi (aging) — bucket bo'yicha soni + summasi ──
    const agingCount: Record<string, number> = {};
    const agingSum: Record<string, bigint> = {};
    for (const b of AGING_BUCKETS) {
      agingCount[b] = 0;
      agingSum[b] = 0n;
    }
    const byStatus: Record<ReceivableStatus, number> = { pending: 0, partial: 0, paid: 0, overdue: 0, written_off: 0 };
    const risk = { low: 0, medium: 0, high: 0, critical: 0 };
    const funnel: Record<string, number> = {};
    for (const s of COLLECTION_STAGES) funnel[s] = 0;

    let totalOutstanding = 0n;
    let totalPenalty = 0n;
    let writtenOff = 0n;

    for (const r of recs) {
      const b = r.agingBucket as AgingBucket;
      agingCount[b] = (agingCount[b] ?? 0) + 1;
      agingSum[b] = (agingSum[b] ?? 0n) + r.outstandingMinor;
      byStatus[r.status]++;
      totalOutstanding += r.outstandingMinor;
      totalPenalty += r.penaltyMinor;
      if (r.status === "written_off") writtenOff += r.outstandingMinor;
      if (r.riskScore >= 85) risk.critical++;
      else if (r.riskScore >= 60) risk.high++;
      else if (r.riskScore >= 30) risk.medium++;
      else risk.low++;
      for (const st of r.executedStages ?? []) if (st in funnel) funnel[st]++;
    }

    const totalAgingSum = AGING_BUCKETS.reduce((s, b) => s + (agingSum[b] ?? 0n), 0n);
    const aging = AGING_BUCKETS.map((b) => ({
      key: b,
      count: agingCount[b] ?? 0,
      ...amount(agingSum[b] ?? 0n, currency),
      pct: totalAgingSum > 0n ? Math.round((Number(agingSum[b] ?? 0n) / Number(totalAgingSum)) * 100) : 0,
    }));

    const total = recs.length;
    const collectionRate = total ? Math.round((byStatus.paid / total) * 100) : 0;

    // ── Moliyaviy: jami hisob-faktura + qabul qilingan to'lovlar ──
    const [invoiced] = await tx
      .select({ sum: sql<string>`coalesce(sum(${invoices.amountMinor}),0)::text` })
      .from(invoices);
    const [paid] = await tx
      .select({ sum: sql<string>`coalesce(sum(${payments.amountMinor}),0)::text` })
      .from(payments)
      .where(eq(payments.status, "received"));

    const totalInvoiced = BigInt(invoiced?.sum ?? "0");
    const totalPaid = BigInt(paid?.sum ?? "0");

    // ── 6 oylik dinamika: hisob-faktura vs undirilgan ──
    const invByMonth = await tx
      .select({
        month: sql<string>`to_char(date_trunc('month', ${invoices.issuedAt}), 'YYYY-MM')`,
        sum: sql<string>`coalesce(sum(${invoices.amountMinor}),0)::text`,
      })
      .from(invoices)
      .where(sql`${invoices.issuedAt} >= date_trunc('month', now()) - interval '5 months'`)
      .groupBy(sql`date_trunc('month', ${invoices.issuedAt})`);

    const payByMonth = await tx
      .select({
        month: sql<string>`to_char(date_trunc('month', ${payments.paidAt}), 'YYYY-MM')`,
        sum: sql<string>`coalesce(sum(${payments.amountMinor}),0)::text`,
      })
      .from(payments)
      .where(sql`${payments.status} = 'received' and ${payments.paidAt} >= date_trunc('month', now()) - interval '5 months'`)
      .groupBy(sql`date_trunc('month', ${payments.paidAt})`);

    const invMap = new Map(invByMonth.map((r) => [r.month, BigInt(r.sum)]));
    const payMap = new Map(payByMonth.map((r) => [r.month, BigInt(r.sum)]));
    // Oxirgi 6 oy yorlig'ini deterministik yig'amiz (now dan orqaga).
    const now = new Date();
    const months: { month: string; invoiced: ReturnType<typeof amount>; collected: ReturnType<typeof amount> }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      months.push({
        month: key,
        invoiced: amount(invMap.get(key) ?? 0n, currency),
        collected: amount(payMap.get(key) ?? 0n, currency),
      });
    }

    // ── Top qarzdorlar (undirilmagan bo'yicha) ──
    const topDebtors = await tx
      .select({
        contractorId: contractors.id,
        name: contractors.name,
        tin: contractors.tin,
        outstandingMinor: sql<string>`coalesce(sum(${receivables.outstandingMinor}),0)::text`,
        penaltyMinor: sql<string>`coalesce(sum(${receivables.penaltyMinor}),0)::text`,
        maxOverdue: sql<number>`coalesce(max(${receivables.overdueDays}),0)::int`,
        maxRisk: sql<number>`coalesce(max(${receivables.riskScore}),0)::int`,
      })
      .from(receivables)
      .innerJoin(contractors, eq(receivables.contractorId, contractors.id))
      .groupBy(contractors.id, contractors.name, contractors.tin)
      .orderBy(desc(sql`sum(${receivables.outstandingMinor})`))
      .limit(5);

    return {
      currency,
      financial: {
        invoiced: amount(totalInvoiced, currency),
        collected: amount(totalPaid, currency),
        outstanding: amount(totalOutstanding, currency),
        penalty: amount(totalPenalty, currency),
        writtenOff: amount(writtenOff, currency),
        collectionRate,
      },
      aging,
      byStatus,
      risk,
      funnel: COLLECTION_STAGES.map((s) => ({ stage: s, count: funnel[s] ?? 0 })),
      months,
      topDebtors: topDebtors.map((d) => ({
        contractorId: d.contractorId,
        name: d.name,
        tin: d.tin,
        outstanding: amount(BigInt(d.outstandingMinor), currency),
        penalty: amount(BigInt(d.penaltyMinor), currency),
        overdueDays: d.maxOverdue,
        riskScore: d.maxRisk,
      })),
    };
  });

  return c.json(ok(data, "common.ok", c.get("locale")));
});
