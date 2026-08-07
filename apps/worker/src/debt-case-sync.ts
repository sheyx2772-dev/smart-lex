import { assignStrategy, type CollectionContext } from "@lex/agents";
import { stateFromCollectionProgress } from "@lex/core";
import {
  caseEvents,
  debtCases,
  recoveryPlaybooks,
  type TenantTx,
} from "@lex/db";
import { type Locale } from "@lex/shared";
import { and, eq, ne, sql } from "drizzle-orm";

function nextCaseNumber(count: number, year = new Date().getFullYear()): string {
  return `${year}-${String(count + 1).padStart(4, "0")}`;
}

async function logEvent(tx: TenantTx, tenantId: string, caseId: string, type: string, detail?: Record<string, unknown>) {
  await tx.insert(caseEvents).values({ tenantId, debtCaseId: caseId, eventType: type, actorType: "ai_agent", actorId: "monitor-agent", detail });
}

export async function upsertCaseForReceivable(
  tx: TenantTx,
  input: {
    tenantId: string;
    receivableId: string;
    locale: Locale;
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
    channels: ("sms" | "email" | "telegram")[];
    partialPaid?: boolean;
    aggressiveness?: "soft" | "normal" | "aggressive";
  },
): Promise<void> {
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
    availableChannels: input.channels,
    partialPaid: input.partialPaid,
  };

  let caseId: string;
  let caseNumber: string;

  if (existing) {
    caseId = existing.id;
    caseNumber = existing.caseNumber;
  } else {
    const countRow = await tx.select({ count: sql<number>`count(*)::int` }).from(debtCases).where(eq(debtCases.tenantId, input.tenantId));
    caseNumber = nextCaseNumber(countRow[0]?.count ?? 0);
    const [created] = await tx
      .insert(debtCases)
      .values({ tenantId: input.tenantId, receivableId: input.receivableId, caseNumber, state: "scoring", startedAt: new Date() })
      .returning();
    if (!created) return;
    caseId = created.id;
    await logEvent(tx, input.tenantId, caseId, "case.created");
  }

  const strategy = await assignStrategy({
    caseId,
    caseNumber,
    ctx,
    riskScore: input.riskScore,
    riskFactors: input.riskFactors,
    aggressiveness: input.aggressiveness,
  });

  await tx
    .update(debtCases)
    .set({
      state: stateFromCollectionProgress(input.executedStages, input.overdueDays),
      dsScore: strategy.dsScore.dsScore,
      recoveryProbability: Math.round(strategy.dsScore.recoveryProbability * 100),
      recommendedStrategy: strategy.dsScore.recommendedStrategy,
      recommendedChannels: strategy.dsScore.recommendedChannels,
      optimalSettlementPct: strategy.dsScore.optimalSettlementPct,
      estimatedRecoveryDays: strategy.dsScore.estimatedRecoveryDays,
      priorityRank: strategy.priorityRank,
      scoreFactors: strategy.dsScore.factors,
    })
    .where(eq(debtCases.id, caseId));

  const [pb] = await tx.select().from(recoveryPlaybooks).where(eq(recoveryPlaybooks.debtCaseId, caseId)).limit(1);
  if (pb) {
    await tx
      .update(recoveryPlaybooks)
      .set({ strategyType: strategy.playbook.strategyType, phases: strategy.playbook.phases, exitConditions: strategy.playbook.exitConditions, version: pb.version + 1 })
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
}

export async function rerankCases(tx: TenantTx, tenantId: string): Promise<void> {
  const cases = await tx.select({ id: debtCases.id, dsScore: debtCases.dsScore }).from(debtCases).where(and(eq(debtCases.tenantId, tenantId), ne(debtCases.state, "closed")));
  cases.sort((a, b) => b.dsScore - a.dsScore);
  let rank = 1;
  for (const c of cases) {
    await tx.update(debtCases).set({ priorityRank: rank++ }).where(eq(debtCases.id, c.id));
  }
}

export async function syncDebtCasesForTenant(
  tx: TenantTx,
  tenant: { id: string; name: string; defaultLocale: Locale; settings: Record<string, unknown> },
  receivables: {
    id: string;
    contractorId: string;
    status: string;
    outstandingMinor: bigint;
    penaltyMinor: bigint;
    currency: string;
    overdueDays: number;
    agingBucket: string;
    riskScore: number;
    executedStages: string[];
  }[],
  contractors: Map<string, { name: string; phone: string | null; email: string | null; telegramId: string | null }>,
  channelCfg: { sms: boolean; email: boolean; telegram: boolean },
  aggressiveness?: "soft" | "normal" | "aggressive",
): Promise<number> {
  let n = 0;
  for (const rec of receivables) {
    if (rec.status !== "overdue" && rec.status !== "partial") continue;
    const contractor = contractors.get(rec.contractorId);
    if (!contractor) continue;
    const channels: ("sms" | "email" | "telegram")[] = [];
    if (channelCfg.sms && contractor.phone) channels.push("sms");
    if (channelCfg.email && contractor.email) channels.push("email");
    if (channelCfg.telegram && contractor.telegramId) channels.push("telegram");

    await upsertCaseForReceivable(tx, {
      tenantId: tenant.id,
      receivableId: rec.id,
      locale: tenant.defaultLocale,
      creditorName: tenant.name,
      debtorName: contractor.name,
      amountMajor: Number(rec.outstandingMinor) / 100,
      penaltyMajor: Number(rec.penaltyMinor) / 100,
      currency: rec.currency,
      overdueDays: rec.overdueDays,
      agingBucket: rec.agingBucket,
      riskScore: rec.riskScore,
      riskFactors: [],
      executedStages: rec.executedStages,
      channels,
      aggressiveness,
    });
    n++;
  }
  await rerankCases(tx, tenant.id);
  return n;
}
