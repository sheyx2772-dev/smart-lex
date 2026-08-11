/**
 * Moliyalashtirish bozori (factoring marketplace) uchun taklif hisob-kitobi —
 * DETERMINISTIK (LLM emas), xuddi risk.ts kabi shaffof va izohlanadigan qoida asosida.
 * SmartLex bu yerda pul yoki talabni o'ziga OLMAYDI — faqat DS-Score asosida qaysi
 * qarzlar bank/NBKT (nobank kredit tashkiloti) uchun sotishga yaroqli ekanini va
 * taxminiy chegirma stavkasini ko'rsatadi. Haqiqiy moliyalashtirish (pul o'tkazish +
 * talab tsessiyasi) platformadan TASHQARIDA, xaridor bilan to'g'ridan-to'g'ri bo'ladi.
 */

export type FactoringBand = "low" | "medium" | "not_eligible";

export interface FactoringQuote {
  eligible: boolean;
  band: FactoringBand;
  /** Taklif etiladigan chegirma, bazis punktda (100 = 1%). */
  suggestedDiscountBps: number;
}

const NOT_ELIGIBLE_THRESHOLD = 60; // riskScore >= 60 — undiruv/sud yo'liga mosroq, sotishga emas.
const LOW_RISK_THRESHOLD = 40;

/**
 * riskScore — receivables.riskScore (0..100, yuqori = xavfliroq, qarang packages/core/src/risk.ts).
 * Past xavfli (0-39) qarzlar uchun kichik chegirma taklif etiladi (xaridor uchun jozibali,
 * sotuvchi uchun arzon), o'rtacha xavflilar (40-59) uchun kattaroq. 60+ — bozorga chiqarilmaydi.
 */
export function suggestFactoringQuote(riskScore: number): FactoringQuote {
  if (riskScore >= NOT_ELIGIBLE_THRESHOLD) {
    return { eligible: false, band: "not_eligible", suggestedDiscountBps: 0 };
  }
  if (riskScore < LOW_RISK_THRESHOLD) {
    return { eligible: true, band: "low", suggestedDiscountBps: 400 }; // ~4%
  }
  return { eligible: true, band: "medium", suggestedDiscountBps: 750 }; // ~7.5%
}
