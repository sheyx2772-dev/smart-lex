/**
 * Sana/muddat yordamchilari — kun aniqligida, UTC bo'yicha deterministik.
 * `now` HAR DOIM parametr sifatida uzatiladi (testlar barqaror bo'lishi uchun global
 * Date.now() ishlatilmaydi).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Sanani UTC yarim tunga tenglashtiradi (vaqt qismini tashlaydi). */
export function startOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * `to - from` kunlarda (butun son). Vaqt qismi hisobga olinmaydi.
 * @example daysBetween(2026-01-01, 2026-01-06) -> 5
 */
export function daysBetween(from: Date, to: Date): number {
  const a = startOfDayUtc(from).getTime();
  const b = startOfDayUtc(to).getTime();
  return Math.round((b - a) / MS_PER_DAY);
}

/** Sanaga `days` kun qo'shadi. */
export function addDays(date: Date, days: number): Date {
  const d = startOfDayUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * To'lov muddati o'tgan kunlar soni (0 dan kichik bo'lmaydi).
 * `dueDate` — to'lov muddati, `now` — hozirgi sana.
 * @returns muddatdan keyingi kunlar; hali kelmagan bo'lsa 0.
 */
export function overdueDays(dueDate: Date, now: Date): number {
  return Math.max(0, daysBetween(dueDate, now));
}

/** To'lov muddatigacha qolgan kunlar (o'tib ketgan bo'lsa manfiy). */
export function daysUntilDue(dueDate: Date, now: Date): number {
  return daysBetween(now, dueDate);
}

/** Muddat o'tganmi? (dueDate < now, kun aniqligida). */
export function isOverdue(dueDate: Date, now: Date): boolean {
  return overdueDays(dueDate, now) > 0;
}
