import { type StrategyType } from "@lex/shared";
import { type RiskResult } from "./risk.js";

/** DS-Score™ kiritish ma'lumotlari — Kimi prompt spec bo'yicha. */
export interface DsScoreInput {
  risk: RiskResult;
  overdueDays: number;
  amountMajor: number;
  currency: string;
  executedStageCount: number;
  respondedBefore?: boolean;
  partialPaid?: boolean;
  /** 0..1 — tarixiy muvaffaqiyat (default 0.5). */
  historicalSuccessRate?: number;
}

export interface DsScoreFactor {
  label: string;
  impact: number;
}

export interface DsScoreResult {
  dsScore: number;
  recoveryProbability: number;
  recommendedStrategy: StrategyType;
  recommendedChannels: ("sms" | "telegram" | "email" | "hybrid_post")[];
  optimalSettlementPct: number;
  estimatedRecoveryDays: number;
  factors: DsScoreFactor[];
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function amountTier(amountMajor: number): "small" | "medium" | "large" {
  if (amountMajor >= 100_000_000) return "large";
  if (amountMajor >= 10_000_000) return "medium";
  return "small";
}

function maturityBucket(overdueDays: number): "fresh" | "aging" | "old" {
  if (overdueDays <= 30) return "fresh";
  if (overdueDays <= 90) return "aging";
  return "old";
}

/**
 * DS-Score™ — deterministik undiruv balli (0-100).
 * Yuqori ball = yuqori undirish ehtimoli va prioritet.
 */
export function calcDsScore(input: DsScoreInput): DsScoreResult {
  const factors: DsScoreFactor[] = [{ label: "Boshlang'ich baza", impact: 50 }];

  // Debtor risk (inverted — past xavf = yuqori DS)
  const debtorRiskBonus = clamp(100 - input.risk.score, 0, 100);
  factors.push({ label: `Qarzdor xavfi (${input.risk.score}/100)`, impact: Math.round(debtorRiskBonus * 0.25) });

  // Debt age
  const maturity = maturityBucket(input.overdueDays);
  const ageImpact = maturity === "fresh" ? 15 : maturity === "aging" ? 5 : -10;
  factors.push({ label: `Qarz yoshi (${input.overdueDays} kun)`, impact: ageImpact });

  // Amount tier
  const tier = amountTier(input.amountMajor);
  const tierImpact = tier === "large" ? 10 : tier === "medium" ? 5 : 0;
  factors.push({ label: `Summa darajasi (${tier})`, impact: tierImpact });

  // Behavioral signals
  if (input.respondedBefore) factors.push({ label: "Oldin javob bergan", impact: 12 });
  if (input.partialPaid) factors.push({ label: "Qisman to'lagan", impact: 15 });
  if (input.executedStageCount >= 3) factors.push({ label: `${input.executedStageCount} bosqich natijasiz`, impact: -8 * Math.min(input.executedStageCount - 2, 3) });

  const raw = factors.reduce((s, f) => s + f.impact, 0);
  const dsScore = clamp(Math.round(raw), 5, 98);

  const hist = input.historicalSuccessRate ?? 0.5;
  const recoveryProbability = clamp(
    Math.round((dsScore / 100) * 0.6 * 100 + hist * 40) / 100,
    0.05,
    0.95,
  );

  let recommendedStrategy: StrategyType = "standard";
  if (input.risk.score >= 70 || maturity === "old") recommendedStrategy = "legal";
  else if (input.risk.score >= 45 || maturity === "aging") recommendedStrategy = "aggressive";
  else if (input.risk.score <= 25 && maturity === "fresh") recommendedStrategy = "soft_escalation";

  const recommendedChannels: DsScoreResult["recommendedChannels"] =
    recommendedStrategy === "legal"
      ? ["email", "hybrid_post"]
      : recommendedStrategy === "soft_escalation"
        ? ["telegram", "sms"]
        : ["sms", "telegram", "email"];

  const optimalSettlementPct =
    recommendedStrategy === "legal" ? 95 : recommendedStrategy === "aggressive" ? 80 : recommendedStrategy === "soft_escalation" ? 90 : 85;

  const estimatedRecoveryDays =
    recommendedStrategy === "legal"
      ? 90 + input.overdueDays
      : recommendedStrategy === "aggressive"
        ? 45 + Math.floor(input.overdueDays / 2)
        : recommendedStrategy === "soft_escalation"
          ? 21 + Math.floor(input.overdueDays / 3)
          : 34 + Math.floor(input.overdueDays / 4);

  return {
    dsScore,
    recoveryProbability,
    recommendedStrategy,
    recommendedChannels,
    optimalSettlementPct,
    estimatedRecoveryDays,
    factors,
  };
}
