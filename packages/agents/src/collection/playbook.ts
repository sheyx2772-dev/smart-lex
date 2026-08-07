import { type StrategyType } from "@lex/shared";

export interface PlaybookPhase {
  phase: number;
  name: string;
  durationDays: number;
  actions: { type: string; template?: string; channel?: string; eImzo?: boolean; aiCopilot?: boolean }[];
  conditions?: { proceedIf?: string; escalateIf?: string };
}

export interface PlaybookExitCondition {
  if: string;
  action: string;
  generateReceipt?: boolean;
  after?: string;
}

export interface PlaybookTemplate {
  strategyType: StrategyType;
  phases: PlaybookPhase[];
  exitConditions: PlaybookExitCondition[];
}

const SOFT: PlaybookTemplate = {
  strategyType: "soft_escalation",
  phases: [
    {
      phase: 1,
      name: "Do'stona eslatma",
      durationDays: 7,
      actions: [
        { type: "sms", template: "reminder_1", channel: "eskiz" },
        { type: "email", template: "reminder_email_1" },
        { type: "telegram", template: "payment_link", channel: "payme" },
      ],
      conditions: { proceedIf: "no_payment_after_7d", escalateIf: "no_response_and_10d_passed" },
    },
    {
      phase: 2,
      name: "Rasmiy talab",
      durationDays: 10,
      actions: [
        { type: "didox_talabnoma", template: "formal_demand", eImzo: true },
        { type: "phone_call", template: "formal_call_v2", aiCopilot: true },
      ],
    },
    {
      phase: 3,
      name: "Huquqiy boshlash",
      durationDays: 30,
      actions: [
        { type: "e_sud_daavo", channel: "economic_court_tashkent" },
        { type: "asset_search", channel: "fmb_open_data" },
      ],
    },
  ],
  exitConditions: [
    { if: "payment_received", action: "close_case", generateReceipt: true },
    { if: "bankruptcy_declared", action: "convert_to_bankruptcy_claim" },
    { if: "debtor_not_found", action: "skip_tracing", after: "use_gosposhlina_search" },
  ],
};

const STANDARD: PlaybookTemplate = {
  strategyType: "standard",
  phases: [
    {
      phase: 1,
      name: "Eslatma zanjir",
      durationDays: 5,
      actions: [
        { type: "sms", template: "reminder_1", channel: "eskiz" },
        { type: "telegram", template: "payment_link" },
      ],
      conditions: { proceedIf: "no_payment_after_5d" },
    },
    {
      phase: 2,
      name: "Qat'iy talab",
      durationDays: 14,
      actions: [
        { type: "firm_reminder", template: "firm_1", channel: "sms" },
        { type: "didox_talabnoma", template: "formal_demand", eImzo: true },
      ],
    },
    {
      phase: 3,
      name: "Sudga tayyorgarlik",
      durationDays: 21,
      actions: [{ type: "e_sud_warning", template: "pre_filing_notice" }],
    },
    {
      phase: 4,
      name: "Sud",
      durationDays: 45,
      actions: [{ type: "e_sud_daavo", channel: "economic_court" }],
    },
  ],
  exitConditions: [
    { if: "payment_received", action: "close_case", generateReceipt: true },
    { if: "settlement_accepted", action: "close_case" },
  ],
};

const AGGRESSIVE: PlaybookTemplate = {
  strategyType: "aggressive",
  phases: [
    {
      phase: 1,
      name: "Tezkor eslatma",
      durationDays: 3,
      actions: [
        { type: "sms", template: "urgent_1", channel: "eskiz" },
        { type: "telegram", template: "payment_link" },
        { type: "email", template: "urgent_email" },
      ],
    },
    {
      phase: 2,
      name: "Didox talabnoma",
      durationDays: 7,
      actions: [{ type: "didox_talabnoma", template: "formal_demand", eImzo: true }],
    },
    {
      phase: 3,
      name: "Sud + aktiv qidiruv",
      durationDays: 30,
      actions: [
        { type: "e_sud_daavo", channel: "economic_court" },
        { type: "asset_search", channel: "fmb_open_data" },
      ],
    },
  ],
  exitConditions: [
    { if: "payment_received", action: "close_case", generateReceipt: true },
    { if: "settlement_below_threshold", action: "reject_and_continue" },
  ],
};

const LEGAL: PlaybookTemplate = {
  strategyType: "legal",
  phases: [
    {
      phase: 1,
      name: "Oxirgi ogohlantirish",
      durationDays: 5,
      actions: [{ type: "didox_talabnoma", template: "final_notice", eImzo: true }],
    },
    {
      phase: 2,
      name: "Sud arizasi",
      durationDays: 14,
      actions: [{ type: "e_sud_daavo", channel: "economic_court" }],
    },
    {
      phase: 3,
      name: "Ijro",
      durationDays: 60,
      actions: [{ type: "enforcement", channel: "bailiff" }],
    },
  ],
  exitConditions: [
    { if: "payment_received", action: "close_case", generateReceipt: true },
    { if: "judgment_favorable", action: "initiate_enforcement" },
  ],
};

const TEMPLATES: Record<StrategyType, PlaybookTemplate> = {
  soft_escalation: SOFT,
  standard: STANDARD,
  aggressive: AGGRESSIVE,
  legal: LEGAL,
};

export function buildPlaybook(strategy: StrategyType, caseId: string): PlaybookTemplate & { caseId: string } {
  const t = TEMPLATES[strategy] ?? STANDARD;
  return { ...t, caseId };
}

export function phaseProgress(currentPhase: number, totalPhases: number): number {
  if (totalPhases <= 0) return 0;
  return Math.round((Math.min(currentPhase, totalPhases) / totalPhases) * 100);
}
