import { format, money } from "@lex/core";
import {
  approvalRequests,
  contractors,
  contracts,
  invoices,
  receivables,
  reminders,
  withTenant,
} from "@lex/db";
import { COLLECTION_STAGES, ok } from "@lex/shared";
import { and, desc, eq, inArray, max, sql } from "drizzle-orm";
import { Hono } from "hono";
import { type Variables } from "../lib/context";
import { pageMeta, pageParams } from "../lib/pagination";

export const overdueRoutes = new Hono<{ Variables: Variables }>();

const amount = (minor: bigint, currency: string) => ({
  minor: minor.toString(),
  formatted: format(money(minor, currency)),
});

/** Kanonik bosqich tartibi — keyingi tavsiya etilgan qadamni deterministik aniqlaydi. */
const STAGE_ORDER = COLLECTION_STAGES; // soft_reminder → firm_reminder → demand_letter → court

/** Muddati o'tgan qarzlar worklisti — server-side sahifalash + aging filtri; summary butun bo'yicha. */
overdueRoutes.get("/overdue", async (c) => {
  const { tenantId } = c.get("auth");
  const { page, pageSize, limit, offset } = pageParams(c);
  const aging = c.req.query("aging");

  const result = await withTenant(tenantId, async (tx) => {
    const conds = [eq(receivables.status, "overdue" as const)];
    if (aging && aging !== "all") conds.push(eq(receivables.agingBucket, aging));
    const where = and(...conds);

    const countRows = await tx.select({ count: sql<number>`count(*)::int` }).from(receivables).where(where);
    const count = countRows[0]?.count ?? 0;

    const rows = await tx
      .select({
        id: receivables.id,
        outstandingMinor: receivables.outstandingMinor,
        penaltyMinor: receivables.penaltyMinor,
        currency: receivables.currency,
        overdueDays: receivables.overdueDays,
        agingBucket: receivables.agingBucket,
        riskScore: receivables.riskScore,
        executedStages: receivables.executedStages,
        invoiceNumber: invoices.number,
        dueDate: invoices.dueDate,
        contractorId: contractors.id,
        contractorName: contractors.name,
        contractorTin: contractors.tin,
        phone: contractors.phone,
        contractNumber: contracts.number,
      })
      .from(receivables)
      .innerJoin(invoices, eq(receivables.invoiceId, invoices.id))
      .innerJoin(contractors, eq(receivables.contractorId, contractors.id))
      .leftJoin(contracts, eq(invoices.contractId, contracts.id))
      .where(where)
      .orderBy(desc(receivables.overdueDays))
      .limit(limit)
      .offset(offset);

    const ids = rows.map((r) => r.id);
    const remMap = new Map<string, { count: number; lastAt: Date | null }>();
    const pendMap = new Map<string, string>();
    if (ids.length) {
      const rem = await tx
        .select({ receivableId: reminders.receivableId, count: sql<number>`count(*)::int`, lastAt: max(reminders.sentAt) })
        .from(reminders)
        .where(inArray(reminders.receivableId, ids))
        .groupBy(reminders.receivableId);
      for (const x of rem) remMap.set(x.receivableId, { count: x.count, lastAt: x.lastAt });
      const pend = await tx
        .select({ receivableId: approvalRequests.receivableId, type: approvalRequests.type })
        .from(approvalRequests)
        .where(and(eq(approvalRequests.status, "pending"), inArray(approvalRequests.receivableId, ids)));
      for (const x of pend) if (x.receivableId) pendMap.set(x.receivableId, x.type);
    }

    const items = rows.map((r) => {
      const executed = r.executedStages ?? [];
      const rm = remMap.get(r.id);
      return {
        id: r.id,
        outstanding: amount(r.outstandingMinor, r.currency),
        penalty: amount(r.penaltyMinor, r.currency),
        total: amount(r.outstandingMinor + r.penaltyMinor, r.currency),
        currency: r.currency,
        overdueDays: r.overdueDays,
        agingBucket: r.agingBucket,
        riskScore: r.riskScore,
        executedStages: executed,
        nextStage: STAGE_ORDER.find((s) => !executed.includes(s)) ?? null,
        invoiceNumber: r.invoiceNumber,
        dueDate: r.dueDate,
        contractorId: r.contractorId,
        contractorName: r.contractorName,
        contractorTin: r.contractorTin,
        phone: r.phone,
        contractNumber: r.contractNumber,
        reminderCount: rm?.count ?? 0,
        lastReminderAt: rm?.lastAt ?? null,
        pendingApproval: pendMap.get(r.id) ?? null,
      };
    });

    // ── Summary — BARCHA muddati o'tganlar bo'yicha (filtrdan mustaqil) ──
    const [sums] = await tx
      .select({
        total: sql<number>`count(*)::int`,
        outstanding: sql<string>`coalesce(sum(${receivables.outstandingMinor}),0)::text`,
        penalty: sql<string>`coalesce(sum(${receivables.penaltyMinor}),0)::text`,
        currency: sql<string>`coalesce(max(${receivables.currency}),'UZS')`,
      })
      .from(receivables)
      .where(eq(receivables.status, "overdue"));

    const agingRows = await tx
      .select({ k: receivables.agingBucket, c: sql<number>`count(*)::int` })
      .from(receivables)
      .where(eq(receivables.status, "overdue"))
      .groupBy(receivables.agingBucket);
    const byAging: Record<string, number> = { "1_30": 0, "31_60": 0, "61_90": 0, "90_plus": 0 };
    for (const x of agingRows) byAging[x.k] = x.c;

    const [na] = await tx
      .select({ c: sql<number>`count(distinct ${approvalRequests.receivableId})::int` })
      .from(approvalRequests)
      .innerJoin(receivables, eq(approvalRequests.receivableId, receivables.id))
      .where(and(eq(approvalRequests.status, "pending"), eq(receivables.status, "overdue")));

    const cur = sums?.currency ?? "UZS";
    return {
      items,
      count,
      summary: {
        count: sums?.total ?? 0,
        totalOutstanding: amount(BigInt(sums?.outstanding ?? "0"), cur),
        totalPenalty: amount(BigInt(sums?.penalty ?? "0"), cur),
        needsApproval: na?.c ?? 0,
        critical: byAging["90_plus"] ?? 0,
        byAging,
      },
    };
  });

  return c.json(
    ok({ items: result.items, summary: result.summary, ...pageMeta(result.count, page, pageSize) }, "common.ok", c.get("locale")),
  );
});
