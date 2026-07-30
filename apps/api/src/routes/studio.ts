import { getModel } from "@lex/agents";
import { type Locale, ok } from "@lex/shared";
import { generateText } from "ai";
import { Hono } from "hono";
import { type Variables } from "../lib/context";

/**
 * Studio AI — HUJJAT-fokusли yordamchi (chat'дан farqi: DB emas, ochiq HUJJAT konteksti).
 * Ikki rejim:
 *   - draft: hujjat matnи so'raladi (talabnoma/da'vo/shartnoma...) → to'liq tayyor matn
 *   - tahlil: berilgan hujjat tahlil qilinadi (xavfli bandlar, muvofiqlik, tavsiya)
 * Imzo/pul HISOB-KITOB LLM'да emas — faqat matn. Kalit yo'q → xabar qaytaradi.
 */
export const studioRoutes = new Hono<{ Variables: Variables }>();

const SYS: Record<Locale, string> = {
  uz: "Sen Lex AI — O'zbekiston huquqiga ixtisoslashgan yuridik hujjat yordamchisisan. Foydalanuvchi so'roviga ko'ra huquqiy hujjat (talabnoma, da'vo arizasi, shartnoma, akt, javob xati va h.k.) tuzasan yoki berilgan hujjatni tahlil qilasan (xavfli bandlar, huquqiy muvofiqlik, tavsiyalar). Javob O'zbekiston Respublikasi qonunchiligiga (FK, Iqtisodiy protsessual kodeks va h.k.) mos, aniq va professional bo'lsin. Hujjat matni so'ralsa — TO'LIQ, tayyor matn ber; to'ldiriladigan joylarni [kvadrat qavs]да qoldir. QAT'IY: aniq raqam/summa/nom/sanani O'YLAB TOPMA — noaniq bo'lsa [joy] qoldir.",
  ru: "Ты Lex AI — юридический ассистент по праву Узбекистана. По запросу составляешь юридический документ (требование, исковое заявление, договор, акт, ответное письмо и т.д.) или анализируешь предоставленный документ (рисковые пункты, юридическое соответствие, рекомендации). Ответ по законодательству РУз (ГК, ЭПК и т.д.), точный и профессиональный. Если просят текст документа — дай ПОЛНЫЙ готовый текст, заполняемые поля в [квадратных скобках]. СТРОГО: не выдумывай числа/суммы/имена/даты — если неясно, оставь [место].",
  en: "You are Lex AI, a legal document assistant specialized in Uzbekistan law. On request you draft a legal document (demand letter, court claim, contract, act, reply letter, etc.) or analyze a provided document (risky clauses, legal compliance, recommendations). Answer per Uzbek legislation (Civil Code, Economic Procedure Code, etc.), precise and professional. If a document text is requested, give the FULL ready text; leave fillable fields in [brackets]. STRICT: never invent exact numbers/amounts/names/dates — leave [placeholder] if unknown.",
};

studioRoutes.post("/studio/ai", async (c) => {
  const locale = c.get("locale");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const instruction = String(body.instruction ?? "").trim();
  const document = String(body.document ?? "").trim();
  if (!instruction) return c.json(ok({ reply: "" }, "common.ok", locale));

  const model = getModel();
  if (!model) {
    const msg = locale === "ru" ? "AI пока не настроен (нет ключа LLM)." : locale === "en" ? "AI is not configured yet (no LLM key)." : "AI hozircha sozlanmagan (LLM kaliti yo'q).";
    return c.json(ok({ reply: msg }, "common.ok", locale));
  }

  try {
    const prompt = document
      ? `Hujjat / Document:\n"""\n${document.slice(0, 12000)}\n"""\n\nVazifa / Task: ${instruction}`
      : instruction;
    const { text } = await generateText({ model, system: SYS[locale] ?? SYS.uz, prompt });
    return c.json(ok({ reply: text.trim() }, "common.ok", locale));
  } catch {
    const msg = locale === "ru" ? "Ошибка AI. Повторите." : locale === "en" ? "AI error. Try again." : "AI xatosi. Qayta urinib ko'ring.";
    return c.json(ok({ reply: msg }, "common.ok", locale));
  }
});
