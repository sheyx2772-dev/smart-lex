import { type AgingBucket, format, money } from "@lex/core";
import {
  approvalRequests,
  auditLogs,
  contractors,
  documents,
  invoices,
  payments,
  receivables,
  reminders,
  withTenant,
} from "@lex/db";
import { COLLECTION_STAGES, ok, type ReceivableStatus } from "@lex/shared";
import { desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { type Variables } from "../lib/context";

export const dashboardRoutes = new Hono<{ Variables: Variables }>();

const amount = (minor: bigint, currency: string) => ({
  minor: minor.toString(),
  formatted: format(money(minor, currency)),
});

/** Boy dashboard — barcha KPI, taqsimot, funnel, top qarzdorlar, agent faoliyati bitta so'rovda. */
dashboardRoutes.get("/dashboard", async (c) => {
  const { tenantId } = c.get("auth");

  const data = await withTenant(tenantId, async (tx) => {
    // ── Barcha debitorliklar (agregat uchun) ──
    const recs = await tx
      .select({
        status: receivables.status,
        outstandingMinor: receivables.outstandingMinor,
        penaltyMinor: receivables.penaltyMinor,
        currency: receivables.currency,
        agingBucket: receivables.agingBucket,
        riskScore: receivables.riskScore,
        overdueDays: receivables.overdueDays,
        executedStages: receivables.executedStages,
      })
      .from(receivables);

    const currency = recs[0]?.currency ?? "UZS";
    const byStatus: Record<ReceivableStatus, number> = { pending: 0, partial: 0, paid: 0, overdue: 0, written_off: 0 };
    const byAging: Record<AgingBucket, bigint> = { current: 0n, "1_30": 0n, "31_60": 0n, "61_90": 0n, "90_plus": 0n };
    const funnel: Record<string, number> = {};
    for (const s of COLLECTION_STAGES) funnel[s] = 0;

    let totalOutstanding = 0n;
    let totalPenalty = 0n;
    let highRisk = 0;
    let overdueDaysSum = 0;
    let overdueCount = 0;

    for (const r of recs) {
      byStatus[r.status]++;
      byAging[r.agingBucket as AgingBucket] = (byAging[r.agingBucket as AgingBucket] ?? 0n) + r.outstandingMinor;
      totalOutstanding += r.outstandingMinor;
      totalPenalty += r.penaltyMinor;
      if (r.riskScore >= 70) highRisk++;
      if (r.status === "overdue") {
        overdueCount++;
        overdueDaysSum += r.overdueDays;
      }
      for (const st of r.executedStages ?? []) if (st in funnel) funnel[st]++;
    }

    const total = recs.length;
    const paidCount = byStatus.paid;
    const collectionRate = total ? Math.round((paidCount / total) * 100) : 0;
    const avgOverdueDays = overdueCount ? Math.round(overdueDaysSum / overdueCount) : 0;

    // ── Undirilgan pul (qabul qilingan to'lovlar) ──
    const [recovered] = await tx
      .select({ sum: sql<string>`coalesce(sum(${payments.amountMinor}),0)::text` })
      .from(payments)
      .where(eq(payments.status, "received"));

    // ── Kutilayotgan tasdiqlar + yuborilgan eslatmalar ──
    const [pendA] = await tx.select({ c: sql<number>`count(*)::int` }).from(approvalRequests).where(eq(approvalRequests.status, "pending"));
    const [remC] = await tx.select({ c: sql<number>`count(*)::int` }).from(reminders);

    // ── AI bugun (oxirgi 24 soat) nima qildi ──
    const since = sql`now() - interval '24 hours'`;
    const [remToday] = await tx.select({ c: sql<number>`count(*)::int` }).from(auditLogs).where(sql`${auditLogs.action} = 'reminder.sent' and ${auditLogs.createdAt} >= ${since}`);
    const [demToday] = await tx.select({ c: sql<number>`count(*)::int` }).from(auditLogs).where(sql`${auditLogs.action} = 'demand.generated' and ${auditLogs.createdAt} >= ${since}`);
    const [docToday] = await tx.select({ c: sql<number>`count(*)::int` }).from(documents).where(sql`${documents.createdAt} >= ${since}`);

    // ── Top qarzdorlar (eng katta qoldiq) ──
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

    // ── So'nggi debitorliklar ──
    const recent = await tx
      .select({
        id: receivables.id,
        status: receivables.status,
        outstandingMinor: receivables.outstandingMinor,
        penaltyMinor: receivables.penaltyMinor,
        currency: receivables.currency,
        overdueDays: receivables.overdueDays,
        riskScore: receivables.riskScore,
        invoiceNumber: invoices.number,
        dueDate: invoices.dueDate,
        contractorName: contractors.name,
      })
      .from(receivables)
      .innerJoin(invoices, eq(receivables.invoiceId, invoices.id))
      .innerJoin(contractors, eq(receivables.contractorId, contractors.id))
      .orderBy(desc(receivables.overdueDays))
      .limit(6);

    // ── Agent faoliyati (so'nggi audit) ──
    const activity = await tx
      .select({
        id: auditLogs.id,
        actorType: auditLogs.actorType,
        action: auditLogs.action,
        detail: auditLogs.detail,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(7);

    return {
      currency,
      kpis: {
        totalOutstanding: amount(totalOutstanding, currency),
        totalPenalty: amount(totalPenalty, currency),
        recovered: amount(BigInt(recovered?.sum ?? "0"), currency),
        totalReceivables: total,
        overdueCount,
        paidCount,
        highRisk,
        avgOverdueDays,
        collectionRate,
        pendingApprovals: pendA?.c ?? 0,
        remindersSent: remC?.c ?? 0,
      },
      todaysWork: {
        reminders: remToday?.c ?? 0,
        demands: demToday?.c ?? 0,
        documents: docToday?.c ?? 0,
        pendingApprovals: pendA?.c ?? 0,
      },
      byStatus,
      aging: Object.fromEntries(Object.entries(byAging).map(([k, v]) => [k, amount(v, currency)])),
      funnel: COLLECTION_STAGES.map((s) => ({ stage: s, count: funnel[s] ?? 0 })),
      topDebtors: topDebtors.map((d) => ({
        contractorId: d.contractorId,
        name: d.name,
        tin: d.tin,
        outstanding: amount(BigInt(d.outstandingMinor), currency),
        penalty: amount(BigInt(d.penaltyMinor), currency),
        overdueDays: d.maxOverdue,
        riskScore: d.maxRisk,
      })),
      recentReceivables: recent.map((r) => ({
        id: r.id,
        status: r.status,
        outstanding: amount(r.outstandingMinor, r.currency),
        penalty: amount(r.penaltyMinor, r.currency),
        overdueDays: r.overdueDays,
        riskScore: r.riskScore,
        invoiceNumber: r.invoiceNumber,
        dueDate: r.dueDate,
        contractorName: r.contractorName,
      })),
      activity,
    };
  });

  return c.json(ok(data, "common.ok", c.get("locale")));
});
