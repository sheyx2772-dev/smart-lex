import { type CollectionStep, calcRisk, daysBetween, dueCollectionSteps, DEFAULT_COLLECTION_STEPS, format, money } from "@lex/core";
import { approvalRequests, auditLogs, collectionRules, contractors, contracts, invoices, receivables, withTenant } from "@lex/db";
import { type CollectionStage, ok } from "@lex/shared";
import { desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { type Variables } from "../lib/context";

export const agentConsoleRoutes = new Hono<{ Variables: Variables }>();

const amount = (minor: bigint, currency: string) => ({ minor: minor.toString(), formatted: format(money(minor, currency)) });

/** Tenant collection siyosati (default) yoki standart qoidalar. */
async function tenantSteps(tx: Parameters<Parameters<typeof withTenant>[1]>[0]): Promise<CollectionStep[]> {
  const [rule] = await tx.select({ steps: collectionRules.steps }).from(collectionRules).where(eq(collectionRules.isDefault, true)).limit(1);
  const raw = (rule?.steps as CollectionStep[] | undefined) ?? null;
  return raw && raw.length ? raw : DEFAULT_COLLECTION_STEPS;
}

/** Bitta debitorlik uchun AI reasoning + tavsiya (deterministik, shaffof). */
function analyze(r: {
  outstandingMinor: bigint;
  penaltyMinor: bigint;
  invoiceAmount: bigint;
  overdueDays: number;
  agingBucket: string;
  executedStages: CollectionStage[];
  dueDate: Date;
  now: Date;
  steps: CollectionStep[];
}) {
  const outstandingRatio = r.invoiceAmount > 0n ? Number(r.outstandingMinor) / Number(r.invoiceAmount) : 1;
  const priorDemandCount = r.executedStages.includes("demand_letter") ? 1 : 0;
  const latePaymentCount = r.executedStages.filter((s) => s === "firm_reminder" || s === "soft_reminder").length;

  const risk = calcRisk({ maxOverdueDays: r.overdueDays, outstandingRatio, latePaymentCount, priorDemandCount });

  // Hozir muddati kelgan, bajarilmagan bosqich (darhol harakat).
  const due = dueCollectionSteps({ steps: r.steps, dueDate: r.dueDate, now: r.now, executedStages: r.executedStages });
  const next = due[due.length - 1] ?? null;

  // Keyingi rejalashtirilgan (hali muddati kelmagan) bosqich — agentning "reja"si.
  const executed = new Set(r.executedStages);
  const daysFromDue = daysBetween(r.dueDate, r.now);
  const upcoming = r.steps
    .filter((s) => !executed.has(s.stage))
    .filter((s) => daysFromDue < s.offsetDays)
    .sort((a, b) => a.offsetDays - b.offsetDays)[0] ?? null;

  return {
    riskScore: risk.score,
    riskBand: risk.band,
    factors: risk.factors.map((f) => ({ label: f.label, points: Math.round(f.points) })),
    outstandingRatio: Math.round(outstandingRatio * 100),
    done: r.executedStages,
    recommendation: next ? { stage: next.stage, requiresApproval: next.requiresApproval } : null,
    scheduled: upcoming
      ? { stage: upcoming.stage, requiresApproval: upcoming.requiresApproval, inDays: upcoming.offsetDays - daysFromDue }
      : null,
  };
}

/**
 * AI Agent Konsoli — har bir faol debitorlik uchun agentning "fikrlash izi":
 * ko'rgan faktlari, risk omillari, va tavsiya etgan keyingi harakati.
 */
agentConsoleRoutes.get("/agent/console", async (c) => {
  const { tenantId } = c.get("auth");
  const now = new Date();

  const data = await withTenant(tenantId, async (tx) => {
    const steps = await tenantSteps(tx);

    const rows = await tx
      .select({
        id: receivables.id,
        status: receivables.status,
        outstandingMinor: receivables.outstandingMinor,
        penaltyMinor: receivables.penaltyMinor,
        currency: receivables.currency,
        overdueDays: receivables.overdueDays,
        agingBucket: receivables.agingBucket,
        executedStages: receivables.executedStages,
        invoiceNumber: invoices.number,
        invoiceAmount: invoices.amountMinor,
        dueDate: invoices.dueDate,
        penaltyDailyBps: contracts.penaltyDailyBps,
        contractorName: contractors.name,
        contractorTin: contractors.tin,
        contractorId: contractors.id,
      })
      .from(receivables)
      .innerJoin(invoices, eq(receivables.invoiceId, invoices.id))
      .innerJoin(contractors, eq(receivables.contractorId, contractors.id))
      .leftJoin(contracts, eq(invoices.contractId, contracts.id))
      .where(sql`${receivables.status} <> 'paid'`)
      .orderBy(desc(receivables.overdueDays));

    // Har debitorlik uchun kutilayotgan tasdiqlar (agent tayyorlagan).
    const pending = await tx
      .select({ receivableId: approvalRequests.receivableId, type: approvalRequests.type })
      .from(approvalRequests)
      .where(eq(approvalRequests.status, "pending"));
    const pendingByRec = new Map<string, string>();
    for (const p of pending) if (p.receivableId) pendingByRec.set(p.receivableId, p.type);

    const currency = rows[0]?.currency ?? "UZS";

    const items = rows.map((r) => {
      const a = analyze({
        outstandingMinor: r.outstandingMinor,
        penaltyMinor: r.penaltyMinor,
        invoiceAmount: r.invoiceAmount,
        overdueDays: r.overdueDays,
        agingBucket: r.agingBucket,
        executedStages: (r.executedStages ?? []) as CollectionStage[],
        dueDate: r.dueDate,
        now,
        steps,
      });
      return {
        id: r.id,
        contractorId: r.contractorId,
        contractorName: r.contractorName,
        contractorTin: r.contractorTin,
        invoiceNumber: r.invoiceNumber,
        status: r.status,
        dueDate: r.dueDate,
        overdueDays: r.overdueDays,
        agingBucket: r.agingBucket,
        outstanding: amount(r.outstandingMinor, r.currency),
        penalty: amount(r.penaltyMinor, r.currency),
        invoiceAmount: amount(r.invoiceAmount, r.currency),
        penaltyDailyBps: r.penaltyDailyBps ?? 0,
        executedStages: (r.executedStages ?? []) as string[],
        pendingApproval: pendingByRec.get(r.id) ?? null,
        ...a,
      };
    });

    const summary = {
      analyzed: items.length,
      overdue: items.filter((i) => i.overdueDays > 0).length,
      needsAction: items.filter((i) => i.recommendation).length,
      needsApproval: items.filter((i) => i.recommendation?.requiresApproval || i.scheduled?.requiresApproval || i.pendingApproval).length,
      highRisk: items.filter((i) => i.riskBand === "high").length,
    };

    return { currency, summary, items };
  });

  return c.json(ok(data, "common.ok", c.get("locale")));
});

/**
 * Agentni ishga tushirish — barcha debitorliklarni qayta baholaydi (risk-skor yangilanadi),
 * har biri uchun audit yozadi. Deterministik va idempotent (pul/aging'ga tegmaydi — bu monitor ishi).
 */
agentConsoleRoutes.post("/agent/run", async (c) => {
  const { tenantId, userId } = c.get("auth");
  const now = new Date();

  const result = await withTenant(tenantId, async (tx) => {
    const steps = await tenantSteps(tx);
    const rows = await tx
      .select({
        id: receivables.id,
        outstandingMinor: receivables.outstandingMinor,
        penaltyMinor: receivables.penaltyMinor,
        overdueDays: receivables.overdueDays,
        agingBucket: receivables.agingBucket,
        executedStages: receivables.executedStages,
        riskScore: receivables.riskScore,
        invoiceAmount: invoices.amountMinor,
        dueDate: invoices.dueDate,
      })
      .from(receivables)
      .innerJoin(invoices, eq(receivables.invoiceId, invoices.id))
      .where(sql`${receivables.status} <> 'paid'`);

    let updated = 0;
    let needsAction = 0;
    for (const r of rows) {
      const a = analyze({
        outstandingMinor: r.outstandingMinor,
        penaltyMinor: r.penaltyMinor,
        invoiceAmount: r.invoiceAmount,
        overdueDays: r.overdueDays,
        agingBucket: r.agingBucket,
        executedStages: (r.executedStages ?? []) as CollectionStage[],
        dueDate: r.dueDate,
        now,
        steps,
      });
      if (a.recommendation) needsAction++;
      if (a.riskScore !== r.riskScore) {
        await tx.update(receivables).set({ riskScore: a.riskScore, lastEvaluatedAt: now }).where(eq(receivables.id, r.id));
        updated++;
      }
    }

    await tx.insert(auditLogs).values({
      tenantId,
      actorType: "ai_agent",
      actorId: userId,
      action: "agent.evaluated",
      entityType: "receivable",
      entityId: null,
      detail: { analyzed: rows.length, riskUpdated: updated, needsAction },
    });

    return { analyzed: rows.length, riskUpdated: updated, needsAction };
  });

  return c.json(ok(result, "common.ok", c.get("locale")));
});
