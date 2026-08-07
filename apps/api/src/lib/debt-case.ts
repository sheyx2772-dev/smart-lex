import { assignStrategy, type CollectionContext } from "@lex/agents";
import { stateFromCollectionProgress } from "@lex/core";
import {
  caseEvents,
  contractors,
  debtCases,
  invoices,
  pendingOverrides,
  receivables,
  recoveryPlaybooks,
  type TenantTx,
} from "@lex/db";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";

/** Yangi case raqami: YYYY-NNNN */
export function nextCaseNumber(existingCount: number, year = new Date().getFullYear()): string {
  return `${year}-${String(existingCount + 1).padStart(4, "0")}`;
}

export async function logCaseEvent(
  tx: TenantTx,
  tenantId: string,
  debtCaseId: string,
  eventType: string,
  detail?: Record<string, unknown>,
  actorId = "strategy-agent",
): Promise<void> {
  await tx.insert(caseEvents).values({
    tenantId,
    debtCaseId,
    eventType,
    actorType: "ai_agent",
    actorId,
    detail,
  });
}

/** Bitta receivable uchun debt case yaratadi yoki yangilaydi (DS-Score + playbook). */
export async function upsertDebtCase(
  tx: TenantTx,
  input: {
    tenantId: string;
    receivableId: string;
    locale: "uz" | "ru" | "en";
    creditorName: string;
    debtorName: string;
    amountMajor: number;
    penaltyMajor: number;
    currency: string;
    overdueDays: number;
    agingBucket: string;
    riskScore: number;
    riskFactors: { label: string; points: number }[];
    executedStages: string[];
    availableChannels: ("sms" | "email" | "telegram")[];
    partialPaid?: boolean;
    aggressiveness?: "soft" | "normal" | "aggressive";
  },
): Promise<{ caseId: string; caseNumber: string }> {
  const [existing] = await tx.select().from(debtCases).where(eq(debtCases.receivableId, input.receivableId)).limit(1);

  const ctx: CollectionContext = {
    locale: input.locale,
    creditorName: input.creditorName,
    debtorName: input.debtorName,
    amountMajor: input.amountMajor,
    penaltyMajor: input.penaltyMajor,
    currency: input.currency,
    overdueDays: input.overdueDays,
    agingBucket: input.agingBucket,
    riskScore: input.riskScore,
    executedStages: input.executedStages,
    availableChannels: input.availableChannels,
    partialPaid: input.partialPaid,
  };

  let caseId: string;
  let caseNumber: string;

  if (existing) {
    caseId = existing.id;
    caseNumber = existing.caseNumber;
  } else {
    const countRow = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(debtCases)
      .where(eq(debtCases.tenantId, input.tenantId));
    caseNumber = nextCaseNumber(countRow[0]?.count ?? 0);
    const [created] = await tx
      .insert(debtCases)
      .values({
        tenantId: input.tenantId,
        receivableId: input.receivableId,
        caseNumber,
        state: "scoring",
        startedAt: new Date(),
      })
      .returning();
    if (!created) throw new Error("debt_case_create_failed");
    caseId = created.id;
    await logCaseEvent(tx, input.tenantId, caseId, "case.created", { receivableId: input.receivableId });
  }

  const strategy = await assignStrategy({
    caseId,
    caseNumber,
    ctx,
    riskScore: input.riskScore,
    riskFactors: input.riskFactors,
    aggressiveness: input.aggressiveness,
  });

  const state = stateFromCollectionProgress(input.executedStages, input.overdueDays);

  await tx
    .update(debtCases)
    .set({
      state,
      dsScore: strategy.dsScore.dsScore,
      recoveryProbability: Math.round(strategy.dsScore.recoveryProbability * 100),
      recommendedStrategy: strategy.dsScore.recommendedStrategy,
      recommendedChannels: strategy.dsScore.recommendedChannels,
      optimalSettlementPct: strategy.dsScore.optimalSettlementPct,
      estimatedRecoveryDays: strategy.dsScore.estimatedRecoveryDays,
      priorityRank: strategy.priorityRank,
      scoreFactors: strategy.dsScore.factors,
    })
    .where(and(eq(debtCases.id, caseId), eq(debtCases.tenantId, input.tenantId)));

  const [pb] = await tx.select().from(recoveryPlaybooks).where(eq(recoveryPlaybooks.debtCaseId, caseId)).limit(1);
  if (pb) {
    await tx
      .update(recoveryPlaybooks)
      .set({
        strategyType: strategy.playbook.strategyType,
        phases: strategy.playbook.phases,
        exitConditions: strategy.playbook.exitConditions,
        version: pb.version + 1,
      })
      .where(eq(recoveryPlaybooks.id, pb.id));
  } else {
    await tx.insert(recoveryPlaybooks).values({
      tenantId: input.tenantId,
      debtCaseId: caseId,
      strategyType: strategy.playbook.strategyType,
      phases: strategy.playbook.phases,
      exitConditions: strategy.playbook.exitConditions,
    });
  }

  await logCaseEvent(tx, input.tenantId, caseId, "strategy.assigned", {
    dsScore: strategy.dsScore.dsScore,
    strategy: strategy.dsScore.recommendedStrategy,
    action: strategy.decision.action,
    reasoning: strategy.reasoning,
  });

  return { caseId, caseNumber };
}

/** Portfolio bo'yicha priority rank qayta hisoblash (yuqori DS-Score = #1 prioritet). */
export async function rerankCases(tx: TenantTx, tenantId: string): Promise<void> {
  const cases = await tx
    .select({ id: debtCases.id, dsScore: debtCases.dsScore })
    .from(debtCases)
    .where(and(eq(debtCases.tenantId, tenantId), ne(debtCases.state, "closed")));

  cases.sort((a, b) => b.dsScore - a.dsScore);
  let rank = 1;
  for (const c of cases) {
    await tx.update(debtCases).set({ priorityRank: rank++ }).where(eq(debtCases.id, c.id));
  }
}

/** Settlement taklifi uchun override yaratadi. */
export async function createSettlementOverride(
  tx: TenantTx,
  input: {
    tenantId: string;
    debtCaseId: string;
    debtorMessage: string;
    offerAmountMajor: number;
    totalAmountMajor: number;
    aiRecommendation: Record<string, unknown>;
    autoExecuteHours?: number;
  },
): Promise<string> {
  const autoExecuteAt = new Date(Date.now() + (input.autoExecuteHours ?? 24) * 3600_000);

  const [row] = await tx
    .insert(pendingOverrides)
    .values({
      tenantId: input.tenantId,
      debtCaseId: input.debtCaseId,
      type: "settlement",
      aiRecommendation: {
        ...input.aiRecommendation,
        offerAmountMajor: input.offerAmountMajor,
        totalAmountMajor: input.totalAmountMajor,
        acceptRecommended: true,
      },
      debtorMessage: input.debtorMessage,
      autoExecuteAt,
    })
    .returning({ id: pendingOverrides.id });

  await logCaseEvent(tx, input.tenantId, input.debtCaseId, "override.settlement_requested", {
    offerAmountMajor: input.offerAmountMajor,
    autoExecuteAt: autoExecuteAt.toISOString(),
  });

  return row?.id ?? "";
}

export async function getCaseWithDetails(tx: TenantTx, tenantId: string, caseId: string) {
  const [debtCase] = await tx
    .select()
    .from(debtCases)
    .where(and(eq(debtCases.id, caseId), eq(debtCases.tenantId, tenantId)))
    .limit(1);
  if (!debtCase) return null;

  const [playbook] = await tx.select().from(recoveryPlaybooks).where(eq(recoveryPlaybooks.debtCaseId, caseId)).limit(1);
  const events = await tx
    .select()
    .from(caseEvents)
    .where(eq(caseEvents.debtCaseId, caseId))
    .orderBy(sql`${caseEvents.createdAt} desc`)
    .limit(50);
  const overrides = await tx
    .select()
    .from(pendingOverrides)
    .where(and(eq(pendingOverrides.debtCaseId, caseId), eq(pendingOverrides.status, "pending")));

  const [recRow] = await tx.select().from(receivables).where(eq(receivables.id, debtCase.receivableId)).limit(1);
  let contractor = null;
  let invoice = null;
  if (recRow) {
    const [inv] = await tx.select().from(invoices).where(eq(invoices.id, recRow.invoiceId)).limit(1);
    invoice = inv ?? null;
    if (inv) {
      const [c] = await tx.select().from(contractors).where(eq(contractors.id, inv.contractorId)).limit(1);
      contractor = c ?? null;
    }
  }

  return { debtCase, playbook: playbook ?? null, events, overrides, contractor, invoice, receivable: recRow ?? null };
}

const ACTIVE_STATES = ["pre_legal", "escalate", "legal", "strategy_assigned", "negotiation", "debtor_responded"] as const;

export async function listActiveCases(tx: TenantTx, tenantId: string, limit = 20) {
  const rows = await tx
    .select({
      debtCase: debtCases,
      receivable: receivables,
      contractor: contractors,
    })
    .from(debtCases)
    .innerJoin(receivables, eq(receivables.id, debtCases.receivableId))
    .innerJoin(contractors, eq(contractors.id, receivables.contractorId))
    .where(and(eq(debtCases.tenantId, tenantId), inArray(debtCases.state, [...ACTIVE_STATES])))
    .orderBy(asc(debtCases.priorityRank))
    .limit(limit);

  return rows;
}

export async function listAllCases(tx: TenantTx, tenantId: string, limit = 50) {
  return tx
    .select({
      debtCase: debtCases,
      receivable: receivables,
      contractor: contractors,
    })
    .from(debtCases)
    .innerJoin(receivables, eq(receivables.id, debtCases.receivableId))
    .innerJoin(contractors, eq(contractors.id, receivables.contractorId))
    .where(and(eq(debtCases.tenantId, tenantId), ne(debtCases.state, "closed")))
    .orderBy(asc(debtCases.priorityRank))
    .limit(limit);
}
