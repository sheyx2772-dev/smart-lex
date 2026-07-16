import { type CollectionStage } from "@lex/shared";
import { daysBetween } from "./time";

/**
 * Collection siyosati bo'yicha qaysi bosqich ishga tushishini deterministik aniqlash.
 * Tenant har bosqichni to'lov muddatiga nisbatan (kun) belgilaydi:
 *   offsetDays < 0  => muddatdan OLDIN (masalan -5 = 5 kun oldin yumshoq eslatma)
 *   offsetDays >= 0 => muddatdan KEYIN (masalan +30 = talabnoma)
 */
export interface CollectionStep {
  stage: CollectionStage;
  offsetDays: number;
  /** Bu bosqich rahbar tasdig'ini talab qiladimi? (talabnoma/sud => true) */
  requiresApproval: boolean;
}

export interface CollectionDecisionInput {
  steps: CollectionStep[];
  dueDate: Date;
  now: Date;
  /** Allaqachon bajarilgan bosqichlar (takroran ishga tushmasligi uchun). */
  executedStages: readonly CollectionStage[];
}

/**
 * Muddati kelgan, lekin hali bajarilmagan bosqichlarni qaytaradi (offsetDays bo'yicha tartibli).
 * Odatda bittasi qaytadi, lekin cron kechiksa bir nechta ham bo'lishi mumkin.
 */
export function dueCollectionSteps(input: CollectionDecisionInput): CollectionStep[] {
  const daysFromDue = daysBetween(input.dueDate, input.now); // now - dueDate
  const executed = new Set(input.executedStages);

  return input.steps
    .filter((step) => !executed.has(step.stage))
    .filter((step) => daysFromDue >= step.offsetDays)
    .sort((a, b) => a.offsetDays - b.offsetDays);
}

/** Standart collection siyosati (tenant o'zi sozlamaguncha default). */
export const DEFAULT_COLLECTION_STEPS: CollectionStep[] = [
  { stage: "soft_reminder", offsetDays: -5, requiresApproval: false },
  { stage: "firm_reminder", offsetDays: 1, requiresApproval: false },
  { stage: "demand_letter", offsetDays: 30, requiresApproval: true },
  { stage: "court", offsetDays: 60, requiresApproval: true },
];
