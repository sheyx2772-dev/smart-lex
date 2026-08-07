import { calcDsScore, type DsScoreResult } from "@lex/core";
import { type StrategyType } from "@lex/shared";
import { buildPlaybook } from "./playbook.js";
import { type CollectionContext, decideCollectionAction, type CollectionDecision, ruleDecision } from "./decide.js";

export interface StrategyInput {
  caseId: string;
  caseNumber: string;
  ctx: CollectionContext;
  riskScore: number;
  riskFactors: { label: string; points: number }[];
  aggressiveness?: "soft" | "normal" | "aggressive";
}

export interface StrategyResult {
  dsScore: DsScoreResult;
  decision: CollectionDecision;
  playbook: ReturnType<typeof buildPlaybook>;
  priorityRank: number;
  reasoning: string;
}

/**
 * Strategy Agent — DS-Score + AI qaror + Recovery Playbook yaratadi.
 * Bu avtonom undiruv OS ning "miya" qismi.
 */
export async function assignStrategy(input: StrategyInput): Promise<StrategyResult> {
  const dsScore = calcDsScore({
    risk: { score: input.riskScore, band: input.riskScore >= 70 ? "high" : input.riskScore >= 40 ? "medium" : "low", factors: input.riskFactors },
    overdueDays: input.ctx.overdueDays,
    amountMajor: input.ctx.amountMajor,
    currency: input.ctx.currency,
    executedStageCount: input.ctx.executedStages.length,
    respondedBefore: input.ctx.respondedBefore,
    partialPaid: input.ctx.partialPaid,
  });

  // Aggressiveness override
  let strategy = dsScore.recommendedStrategy;
  if (input.aggressiveness === "aggressive" && strategy !== "legal") strategy = "aggressive";
  if (input.aggressiveness === "soft" && strategy === "aggressive") strategy = "soft_escalation";

  const decision = await decideCollectionAction(input.ctx);
  const playbook = buildPlaybook(strategy, input.caseId);

  const priorityRank = Math.round(100 - dsScore.dsScore + (input.ctx.amountMajor >= 50_000_000 ? -10 : 0));

  const reasoning =
    `DS-Score: ${dsScore.dsScore}/100, undirish ehtimoli ${Math.round(dsScore.recoveryProbability * 100)}%. ` +
    `Strategiya: ${strategy}. Keyingi qadam: ${decision.action}. Sabab: ${decision.reason}`;

  return {
    dsScore: { ...dsScore, recommendedStrategy: strategy },
    decision,
    playbook,
    priorityRank,
    reasoning,
  };
}

/** Tezkor strategiya (LLM'siz) — batch scoring uchun. */
export function assignStrategySync(input: Omit<StrategyInput, "caseId" | "caseNumber"> & { caseId: string }): Omit<StrategyResult, "decision"> & { decision: CollectionDecision } {
  const dsScore = calcDsScore({
    risk: { score: input.riskScore, band: input.riskScore >= 70 ? "high" : input.riskScore >= 40 ? "medium" : "low", factors: input.riskFactors },
    overdueDays: input.ctx.overdueDays,
    amountMajor: input.ctx.amountMajor,
    currency: input.ctx.currency,
    executedStageCount: input.ctx.executedStages.length,
    respondedBefore: input.ctx.respondedBefore,
    partialPaid: input.ctx.partialPaid,
  });
  const decision = ruleDecision(input.ctx);
  const playbook = buildPlaybook(dsScore.recommendedStrategy, input.caseId);
  return {
    dsScore,
    decision,
    playbook,
    priorityRank: Math.round(100 - dsScore.dsScore),
    reasoning: `DS-Score ${dsScore.dsScore}, strategiya ${dsScore.recommendedStrategy}`,
  };
}

export type { StrategyType };
