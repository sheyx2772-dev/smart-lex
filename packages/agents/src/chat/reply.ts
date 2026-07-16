import { type Locale } from "@lex/shared";
import { generateText } from "ai";
import { getModel } from "../llm";

const SYS: Record<Locale, string> = {
  uz: "Sen Lex AI yordamchisisan — O'zbekistondagi qarzdorlik va yuridik jarayonlar bo'yicha yordam berasan. Foydalanuvchi savoliga FAQAT berilgan MA'LUMOTGA tayanib, o'zbek tilida qisqa, aniq va do'stona javob ber. QAT'IY: raqamlar, summalar va nomlarni o'zgartirma, yangi fakt yoki raqam o'ylab topma. Ma'lumot bo'sh bo'lsa, foydalanuvchiga nima so'rashi mumkinligini ayt. Javob 1-3 jumla bo'lsin, ro'yxatni takrorlama (u alohida ko'rsatiladi).",
  ru: "Ты AI-ассистент Lex — помогаешь по долгам и юридическим процессам в Узбекистане. Отвечай на вопрос ТОЛЬКО на основе предоставленных ДАННЫХ, кратко и дружелюбно на русском. СТРОГО: не меняй числа, суммы и имена, не выдумывай новых фактов. Если данных нет — подскажи, что можно спросить. Ответ 1-3 предложения, не повторяй список (он показывается отдельно).",
  en: "You are the Lex AI assistant for debt and legal processes in Uzbekistan. Answer the question based ONLY on the provided DATA, concise and friendly, in English. STRICT: never change numbers, amounts or names, invent no new facts. If there is no data, suggest what the user can ask. Keep it to 1-3 sentences, don't repeat the list (it is shown separately).",
};

/**
 * Chat javobini LLM bilan tabiiy tilda yozadi. Ma'lumot deterministik topilgan
 * (tenant-scoped DB), LLM faqat uni tabiiy jumlaga aylantiradi. Kalit yo'q/xato → fallback.
 */
export async function phraseChatReply(opts: { locale: Locale; question: string; context: string; fallback: string }): Promise<string> {
  const model = getModel();
  if (!model) return opts.fallback;
  try {
    const { text } = await generateText({
      model,
      system: SYS[opts.locale],
      prompt: `Savol / Question: ${opts.question}\n\nMa'lumot / Data:\n${opts.context || "(bo'sh / empty)"}`,
    });
    const out = text.trim();
    return out.length > 3 ? out : opts.fallback;
  } catch {
    return opts.fallback;
  }
}
