/**
 * Deterministik risk-skor (0..100). LLM EMAS — shaffof, izohlanadigan qoidalar.
 * Yuqori skor => yuqori undirilmaslik xavfi.
 */

export interface RiskInput {
  /** Joriy eng katta muddatidan o'tish (kun). */
  maxOverdueDays: number;
  /** Qolgan qarzning umumiy invoice'ga nisbati (0..1). */
  outstandingRatio: number;
  /** Oxirgi 12 oyda kechiktirilgan to'lovlar soni. */
  latePaymentCount: number;
  /** Oldingi talabnomalar soni. */
  priorDemandCount: number;
}

export type RiskBand = "low" | "medium" | "high";

export interface RiskResult {
  score: number; // 0..100
  band: RiskBand;
  /** Skorga hissa qo'shgan omillar (shaffoflik/audit uchun). */
  factors: { label: string; points: number }[];
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

export function calcRisk(input: RiskInput): RiskResult {
  const factors: { label: string; points: number }[] = [];

  // Muddatidan o'tish: 0..40 ball (90+ kun => to'liq).
  const overduePoints = clamp((input.maxOverdueDays / 90) * 40, 0, 40);
  factors.push({ label: "overdue_days", points: overduePoints });

  // Qolgan qarz ulushi: 0..25 ball.
  const ratioPoints = clamp(input.outstandingRatio, 0, 1) * 25;
  factors.push({ label: "outstanding_ratio", points: ratioPoints });

  // Kechikish tarixi: har biri 5 ball, maksimum 20.
  const historyPoints = clamp(input.latePaymentCount * 5, 0, 20);
  factors.push({ label: "late_payment_history", points: historyPoints });

  // Oldingi talabnomalar: har biri 7.5 ball, maksimum 15.
  const demandPoints = clamp(input.priorDemandCount * 7.5, 0, 15);
  factors.push({ label: "prior_demands", points: demandPoints });

  const score = Math.round(factors.reduce((sum, f) => sum + f.points, 0));
  const band: RiskBand = score >= 70 ? "high" : score >= 40 ? "medium" : "low";

  return { score, band, factors };
}
