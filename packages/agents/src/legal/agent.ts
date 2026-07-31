import { type Locale } from "@lex/shared";
import { generateText, jsonSchema, tool } from "ai";
import { getModel } from "../llm";

/**
 * Lex AI Agent — LLM + ASBOBLAR (tool-calling) halqasi.
 * Agent o'zi o'qiydi, rejalaydi va hujjat tuzadi; tashqi/qaytmas amallar (yuborish,
 * sudga berish) esa foydalanuvchi tasdig'idan o'tadi (bu yerda emas — API qatlamida).
 * Asbob EXECUTE'lari API'dan beriladi (DB shu yerda yo'q). Bu paket faqat "aql".
 */
export interface AgentToolDef {
  name: string;
  description: string;
  /** JSON Schema (object) — asbob parametrlari. */
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}
export interface AgentRunStep {
  tool: string;
  args: unknown;
  ok: boolean;
}

const SYS: Record<Locale, string> = {
  uz: `Sen — Lex AI Agent, O'zbekiston qarz undirish va yuridik hujjatlar bo'yicha ish qiladigan agentsan. Vazifang: foydalanuvchi maqsadini ASBOBLAR yordamida amalda bajarish.
Qoidalar:
1. Avval kerakli MA'LUMOTNI asbob orqali o'qi (masalan, qarzlar ro'yxati), keyingina javob ber yoki harakat qil. Raqam/summa/nom/sanani O'YLAB TOPMA — faqat asboblardan olingan haqiqiy qiymatlarni ishlat.
2. Hujjat kerak bo'lsa — draftDocument asbobidan foydalanib to'liq matn tuz.
3. TASHQI yoki QAYTMAS amallarni (Didox'ga yuborish, sudga berish, xabar jo'natish) o'zing bajarma — ularni tayyorla va foydalanuvchidan tasdiq so'ra.
4. Javob o'zbek tilida, aniq, professional va qisqa bo'lsin. Nima qilganingni sodda tushuntir.
5. Huquqiy asos kerak bo'lsa, kodeks NOMINI yoz (Fuqarolik kodeksi, Iqtisodiy protsessual kodeks); modda raqamini o'ylab topma.`,
  ru: `Ты — Lex AI Agent, агент по взысканию долгов и юридическим документам (право Узбекистана). Задача — реально выполнять цель пользователя с помощью ИНСТРУМЕНТОВ.
Правила:
1. Сначала прочитай нужные ДАННЫЕ инструментом (например список долгов), только потом отвечай или действуй. Не выдумывай числа/суммы/имена/даты — используй реальные значения из инструментов.
2. Нужен документ — составь полный текст инструментом draftDocument.
3. ВНЕШНИЕ и НЕОБРАТИМЫЕ действия (отправка через Didox, подача в суд, отправка сообщения) сам не выполняй — подготовь и запроси подтверждение пользователя.
4. Отвечай по-русски, точно, профессионально и кратко. Понятно объясняй, что сделал.
5. Для правового основания указывай НАЗВАНИЕ кодекса (Гражданский кодекс, ЭПК); номер статьи не выдумывай.`,
  en: `You are the Lex AI Agent for Uzbekistan debt collection and legal documents. Goal: actually accomplish the user's objective using TOOLS.
Rules:
1. First read needed DATA with a tool (e.g. list of debts), only then answer or act. Never invent numbers/amounts/names/dates — use real values from tools.
2. If a document is needed, produce the full text with the draftDocument tool.
3. Do NOT perform EXTERNAL or IRREVERSIBLE actions (send via Didox, file to court, send a message) yourself — prepare them and ask the user for approval.
4. Answer concisely and professionally. Clearly explain what you did.
5. For legal basis cite the code NAME (Civil Code, Economic Procedure Code); never invent an article number.`,
};

function noKey(locale: Locale): string {
  return locale === "ru" ? "AI пока не настроен (нет ключа LLM)." : locale === "en" ? "AI is not configured yet (no LLM key)." : "AI hozircha sozlanmagan (LLM kaliti yo'q).";
}

export async function runAgent(opts: {
  locale: Locale;
  messages: { role: "user" | "assistant"; content: string }[];
  tools: AgentToolDef[];
  maxSteps?: number;
}): Promise<{ text: string; steps: AgentRunStep[] }> {
  const model = getModel();
  if (!model) return { text: noKey(opts.locale), steps: [] };

  const steps: AgentRunStep[] = [];
  const aiTools = Object.fromEntries(
    opts.tools.map((td) => [
      td.name,
      tool({
        description: td.description,
        parameters: jsonSchema(td.parameters as Parameters<typeof jsonSchema>[0]),
        execute: async (args: Record<string, unknown>) => {
          try {
            const result = await td.execute(args ?? {});
            steps.push({ tool: td.name, args, ok: true });
            return result;
          } catch (e) {
            steps.push({ tool: td.name, args, ok: false });
            return { error: String((e as Error)?.message ?? e) };
          }
        },
      }),
    ]),
  );

  try {
    const { text } = await generateText({
      model,
      system: SYS[opts.locale] ?? SYS.uz,
      messages: opts.messages,
      tools: aiTools,
      maxSteps: opts.maxSteps ?? 6,
      // Gemini "thinking"ni o'chiramiz — aks holda ko'p-qadamli tool-callingда
      // thought_signature talab qilinadi va SDK uni qaytara olmay xato beradi.
      // (Boshqa providerlar bu namespace'ni e'tiborsiz qoldiradi.)
      providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } },
    });
    return { text: text.trim(), steps };
  } catch (e) {
    console.error("[runAgent] error:", (e as Error)?.stack ?? e);
    return {
      text: `__AGENT_ERR__ ${String((e as Error)?.message ?? e)}`.slice(0, 400),
      steps,
    };
  }
}
