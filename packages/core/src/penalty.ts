import { type Money } from "@lex/shared";
import { add, min, money, percentBps, zero } from "./money";
import { overdueDays } from "./time";

/**
 * Penya (muddatidan o'tgan to'lov uchun jarima) hisoblash.
 *
 * O'zbekiston amaliyotida penya odatda shartnomada kunlik foiz sifatida belgilanadi
 * (masalan 0.05%/kun) va ko'pincha asosiy qarzning ma'lum foizi bilan cheklanadi (cap).
 * Barcha hisob butun son (bigint) bilan — moliyaviy aniqlik uchun.
 */

export interface PenaltyTerms {
  /** Kunlik penya stavkasi, basis point (1 bps = 0.01%). Masalan 0.05%/kun = 5 bps. */
  dailyRateBps: number;
  /**
   * Ixtiyoriy yuqori chegara — asosiy qarzning basis point'i.
   * Masalan qarzning 50% dan oshmasin => 5000 bps. `undefined` => cheksiz.
   */
  capBps?: number;
}

export interface PenaltyResult {
  /** Muddatidan o'tgan kunlar soni. */
  days: number;
  /** Cap qo'llanishidan oldingi hisoblangan penya. */
  gross: Money;
  /** Cap qo'llanilgandan keyingi yakuniy penya. */
  penalty: Money;
  /** Cap qo'llanildimi? */
  capped: boolean;
}

/**
 * @param principal  asosiy qarz (muddatidan o'tgan qism)
 * @param terms      penya shartlari
 * @param dueDate    to'lov muddati
 * @param now        hisoblash sanasi
 */
export function calcPenalty(
  principal: Money,
  terms: PenaltyTerms,
  dueDate: Date,
  now: Date,
): PenaltyResult {
  const days = overdueDays(dueDate, now);

  if (days === 0 || principal.minor <= 0n) {
    const z = zero(principal.currency);
    return { days, gross: z, penalty: z, capped: false };
  }

  // gross = principal * dailyRateBps/10000 * days
  const perDay = percentBps(principal, terms.dailyRateBps);
  const gross = money(perDay.minor * BigInt(days), principal.currency);

  if (terms.capBps === undefined) {
    return { days, gross, penalty: gross, capped: false };
  }

  const cap = percentBps(principal, terms.capBps);
  const penalty = min(gross, cap);
  return { days, gross, penalty, capped: penalty.minor < gross.minor };
}

/** Umumiy qarz = asosiy + penya (+ ixtiyoriy qonuniy foiz). */
export function totalDebt(principal: Money, penalty: Money, interest?: Money): Money {
  const withPenalty = add(principal, penalty);
  return interest ? add(withPenalty, interest) : withPenalty;
}
