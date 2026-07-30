import { type Locale } from "@lex/shared";
import { generateText, streamText } from "ai";
import { getModel } from "../llm";

/**
 * Studio HUJJAT-fokusли AI (chat'дан farqi: DB emas, ochiq HUJJAT konteksti).
 * Ikki rejim: draft (hujjat matni tuzish) yoki tahlil (berilgan hujjatni tekshirish).
 * Pul/huquqiy HISOB-KITOB LLM'да emas — faqat matn. Kalit yo'q → xabar qaytaradi.
 */
const SYS: Record<Locale, string> = {
  uz: "Sen Lex AI — O'zbekiston huquqiga ixtisoslashgan yuridik hujjat yordamchisisan. Foydalanuvchi so'roviga ko'ra huquqiy hujjat (talabnoma, da'vo arizasi, shartnoma, akt, javob xati va h.k.) tuzasan yoki berilgan hujjatni tahlil qilasan (xavfli bandlar, huquqiy muvofiqlik, tavsiyalar). Javob O'zbekiston Respublikasi qonunchiligiga (FK, Iqtisodiy protsessual kodeks va h.k.) mos, aniq va professional bo'lsin. Hujjat matni so'ralsa — TO'LIQ, tayyor matn ber; to'ldiriladigan joylarni [kvadrat qavs]да qoldir. QAT'IY: aniq raqam/summa/nom/sanani O'YLAB TOPMA — noaniq bo'lsa [joy] qoldir.",
  ru: "Ты Lex AI — юридический ассистент по праву Узбекистана. По запросу составляешь юридический документ (требование, исковое заявление, договор, акт, ответное письмо и т.д.) или анализируешь предоставленный документ (рисковые пункты, юридическое соответствие, рекомендации). Ответ по законодательству РУз (ГК, ЭПК и т.д.), точный и профессиональный. Если просят текст документа — дай ПОЛНЫЙ готовый текст, заполняемые поля в [квадратных скобках]. СТРОГО: не выдумывай числа/суммы/имена/даты — если неясно, оставь [место].",
  en: "You are Lex AI, a legal document assistant specialized in Uzbekistan law. On request you draft a legal document (demand letter, court claim, contract, act, reply letter, etc.) or analyze a provided document (risky clauses, legal compliance, recommendations). Answer per Uzbek legislation (Civil Code, Economic Procedure Code, etc.), precise and professional. If a document text is requested, give the FULL ready text; leave fillable fields in [brackets]. STRICT: never invent exact numbers/amounts/names/dates — leave [placeholder] if unknown.",
};

export async function studioReply(opts: { locale: Locale; instruction: string; document?: string }): Promise<string> {
  const model = getModel();
  if (!model) {
    return opts.locale === "ru"
      ? "AI пока не настроен (нет ключа LLM)."
      : opts.locale === "en"
        ? "AI is not configured yet (no LLM key)."
        : "AI hozircha sozlanmagan (LLM kaliti yo'q).";
  }
  try {
    const doc = (opts.document ?? "").trim();
    const prompt = doc
      ? `Hujjat / Document:\n"""\n${doc.slice(0, 12000)}\n"""\n\nVazifa / Task: ${opts.instruction}`
      : opts.instruction;
    const { text } = await generateText({ model, system: SYS[opts.locale] ?? SYS.uz, prompt });
    return text.trim();
  } catch {
    return opts.locale === "ru" ? "Ошибка AI. Повторите." : opts.locale === "en" ? "AI error. Try again." : "AI xatosi. Qayta urinib ko'ring.";
  }
}

/** Kalit yo'q holati uchun xabar (streaming yo'lida route matn qaytarishi uchun). */
export function studioNoKeyMessage(locale: Locale): string {
  return locale === "ru"
    ? "AI пока не настроен (нет ключа LLM)."
    : locale === "en"
      ? "AI is not configured yet (no LLM key)."
      : "AI hozircha sozlanmagan (LLM kaliti yo'q).";
}

/**
 * Studio AI — STREAMING variant (javob harfma-harf keladi).
 * `ai` importi shu paketda qoladi; API route qaytgan AsyncIterable'ni o'qib uzatadi.
 * Kalit yo'q bo'lsa null qaytaradi (route studioNoKeyMessage yozadi).
 */
export function studioReplyStream(opts: { locale: Locale; instruction: string; document?: string }): AsyncIterable<string> | null {
  const model = getModel();
  if (!model) return null;
  const doc = (opts.document ?? "").trim();
  const prompt = doc
    ? `Hujjat / Document:\n"""\n${doc.slice(0, 12000)}\n"""\n\nVazifa / Task: ${opts.instruction}`
    : opts.instruction;
  const result = streamText({ model, system: SYS[opts.locale] ?? SYS.uz, prompt });
  return result.textStream;
}
