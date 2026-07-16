import { type Money, type ReceivableStatus } from "@lex/shared";
import { isPositive, subtract, zero } from "./money";
import { overdueDays } from "./time";

/**
 * Debitorlik holatini invoice va to'lovlardan deterministik aniqlash.
 * Bu funksiya AI EMAS — sof qoidalar. Agentlar shu natijaga tayanadi.
 */

export interface ReceivableInput {
  /** Invoice bo'yicha umumiy summa. */
  invoiced: Money;
  /** Qabul qilingan to'lovlar yig'indisi. */
  paid: Money;
  /** To'lov muddati. */
  dueDate: Date;
  /** Hisoblash sanasi. */
  now: Date;
}

export interface ReceivableState {
  status: ReceivableStatus;
  /** Qolgan qarz (invoiced - paid), 0 dan kichik bo'lsa 0 ga tenglashtiriladi. */
  outstanding: Money;
  /** Muddatidan o'tgan kunlar (0 agar hali kelmagan yoki to'langan). */
  overdueDays: number;
  /** Qarilik guruhi (aging bucket) — dashboard diagrammasi uchun. */
  agingBucket: AgingBucket;
}

export const AGING_BUCKETS = ["current", "1_30", "31_60", "61_90", "90_plus"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

function bucketFor(days: number): AgingBucket {
  if (days <= 0) return "current";
  if (days <= 30) return "1_30";
  if (days <= 60) return "31_60";
  if (days <= 90) return "61_90";
  return "90_plus";
}

export function evaluateReceivable(input: ReceivableInput): ReceivableState {
  const { invoiced, paid, dueDate, now } = input;
  const rawOutstanding = subtract(invoiced, paid);
  const outstanding = isPositive(rawOutstanding) ? rawOutstanding : zero(invoiced.currency);

  // To'liq to'langan.
  if (!isPositive(outstanding)) {
    return { status: "paid", outstanding: zero(invoiced.currency), overdueDays: 0, agingBucket: "current" };
  }

  const days = overdueDays(dueDate, now);
  const partiallyPaid = isPositive(paid);

  let status: ReceivableStatus;
  if (days > 0) {
    status = "overdue";
  } else if (partiallyPaid) {
    status = "partial";
  } else {
    status = "pending";
  }

  return { status, outstanding, overdueDays: days, agingBucket: bucketFor(days) };
}
