/**
 * Foydalanuvchi (tenant) sozlaydigan hujjat shablonlari.
 * Tenant o'z shablonini bersa — generatsiyada o'sha ishlatiladi (kodga tegmasdan).
 * Bermasa — koddagi default generator.
 *
 * O'zgaruvchilar `{...}` bilan yoziladi va generatsiyada DETERMINISTIK qiymatlar bilan
 * to'ldiriladi (pul/sana kod tomonidan hisoblanadi — LLM emas).
 */

export type DocTemplateType = "demand_letter" | "court_claim" | "reconciliation_act";

/** {var} larni qiymatlar bilan almashtiradi (topilmagani bo'sh qoladi). */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : ""));
}

/** Har hujjat turi uchun mavjud o'zgaruvchilar (UI chiplari uchun). */
export const DOC_TEMPLATE_VARS: Record<DocTemplateType, string[]> = {
  demand_letter: ["kreditor", "qarzdor", "shartnoma", "fakturalar", "asosiy_qarz", "penya", "jami", "kun", "muddat", "imzolovchi"],
  court_claim: ["sud", "davogar", "davogar_stir", "javobgar", "javobgar_stir", "javobgar_manzil", "shartnoma", "fakturalar", "asosiy_qarz", "penya", "jami", "davlat_boji", "kun", "imzolovchi"],
  reconciliation_act: ["kreditor", "kreditor_stir", "qarzdor", "qarzdor_stir", "akt_raqami", "sana", "saldo", "jadval"],
};

/** Boshlang'ich (default) shablonlar — UI'da ko'rsatiladi, tenant tahrirlaydi. */
export const DEFAULT_DOC_TEMPLATES: Record<DocTemplateType, string> = {
  demand_letter: `Hurmatli {qarzdor}!

"{kreditor}" (kreditor) Siz bilan tuzilgan shartnoma bo'yicha muddati o'tgan qarzdorlik yuzaga kelganini ma'lum qiladi.

Shartnoma: № {shartnoma}
Hisob-fakturalar: {fakturalar}

Asosiy qarz: {asosiy_qarz}
Penya ({kun} kun): {penya}
Jami to'lanishi lozim: {jami}

Ushbu talabnoma olingan kundan boshlab {muddat} (kalendar) kun ichida yuqoridagi qarzni to'liq to'lashingizni talab qilamiz.

Belgilangan muddatda to'lov amalga oshirilmasa, kreditor O'zbekiston Respublikasi qonunchiligiga muvofiq qarzni majburiy undirish yuzasidan iqtisodiy sudga da'vo arizasi bilan murojaat qilish huquqini o'zida saqlab qoladi.

Hurmat bilan,
{kreditor}
{imzolovchi}`,

  court_claim: `{sud}ga

Da'vogar: "{davogar}", STIR: {davogar_stir}
Javobgar: "{javobgar}", STIR: {javobgar_stir}, manzil: {javobgar_manzil}
Da'vo narxi: {jami}
To'langan davlat boji: {davlat_boji}

DA'VO ARIZASI
(qarzdorlikni majburiy undirish to'g'risida)

Da'vogar va javobgar o'rtasida {shartnoma} shartnoma tuzilgan. {fakturalar} hisob-fakturalar bo'yicha javobgar zimmasiga to'lov majburiyati yuklatilgan.

Javobgar to'lovni belgilangan muddatda bajarmagan. Asosiy qarz {asosiy_qarz} ni tashkil etadi. Muddat {kun} kun o'tgan, penya {penya} ni tashkil etadi.

Asos: O'zbekiston Respublikasi Fuqarolik kodeksi va Iqtisodiy protsessual kodeksi.

SO'RAYMAN:
Javobgardan da'vogar foydasiga jami {jami} (asosiy qarz {asosiy_qarz} va penya {penya}) undirilsin.
To'langan davlat boji {davlat_boji} javobgar zimmasiga yuklatilsin.

Da'vogar nomidan: {imzolovchi}
_________________ (imzo, sana)`,

  reconciliation_act: `SOLISHTIRMA DALOLATNOMA (AKT-SVERKA) № {akt_raqami}
"{kreditor}" (kreditor) va "{qarzdor}" (qarzdor) o'rtasida
{sana} holatiga
Kreditor STIR: {kreditor_stir}    Qarzdor STIR: {qarzdor_stir}

{jadval}

Yakuniy qoldiq (saldo): {saldo}

Yuqoridagi hisob-kitoblarga ko'ra, "{qarzdor}" ning qarzdorligi {saldo} ni tashkil etadi.

Kreditor nomidan: _________________ (imzo, sana)
Qarzdor nomidan: _________________ (imzo, sana)`,
};
