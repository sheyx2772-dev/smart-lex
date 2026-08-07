import { type CaseState } from "@lex/shared";

/** Ruxsat etilgan holat o'tishlari (AI-triggered). */
const TRANSITIONS: Record<string, CaseState[]> = {
  created: ["intake_complete", "scoring"],
  intake_complete: ["scoring"],
  scoring: ["strategy_assigned"],
  strategy_assigned: ["pre_legal", "legal"],
  pre_legal: ["debtor_responded", "escalate", "settled", "recovered", "closed"],
  debtor_responded: ["negotiation", "settled", "escalate"],
  negotiation: ["settled", "escalate", "pre_legal"],
  escalate: ["legal", "pre_legal"],
  legal: ["court_filed", "settled", "written_off"],
  court_filed: ["judgment", "settled"],
  judgment: ["enforcement", "settled", "recovered"],
  enforcement: ["recovered", "written_off"],
  settled: ["closed"],
  recovered: ["closed"],
  written_off: ["closed"],
  closed: [],
};

export function canTransition(from: CaseState, to: CaseState): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

/** Collection bosqichidan case holatiga mapping. */
export function stateFromCollectionProgress(executedStages: string[], overdueDays: number): CaseState {
  if (executedStages.includes("court")) return "legal";
  if (executedStages.includes("demand_letter")) return "escalate";
  if (executedStages.includes("firm_reminder")) return "pre_legal";
  if (executedStages.includes("soft_reminder")) return "pre_legal";
  if (overdueDays > 0) return "strategy_assigned";
  return "scoring";
}
