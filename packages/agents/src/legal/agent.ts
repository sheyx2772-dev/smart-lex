import { type Locale } from "@lex/shared";
import { generateText, jsonSchema, tool } from "ai";
import { getAgentModel } from "../llm";

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
3. TASHQI yoki QAYTMAS amallarni (talabnomani rasmiy yuborish, sudga da'vo berish, qarzni hisobdan chiqarish) o'zing bajarma. Avval hujjatni tayyorla, so'ng queueApproval asbobi bilan uni Tasdiqlar bo'limiga qo'y va foydalanuvchiga "Tasdiqlar bo'limida tasdiqlang" deb ayt.
4. Javob o'zbek tilida, aniq, professional va qisqa bo'lsin. Nima qilganingni sodda tushuntir.
5. Huquqiy asos kerak bo'lsa, kodeks NOMINI yoz (Fuqarolik kodeksi, Iqtisodiy protsessual kodeks); modda raqamini o'ylab topma.`,
  ru: `Ты — Lex AI Agent, агент по взысканию долгов и юридическим документам (право Узбекистана). Задача — реально выполнять цель пользователя с помощью ИНСТРУМЕНТОВ.
Правила:
1. Сначала прочитай нужные ДАННЫЕ инструментом (например список долгов), только потом отвечай или действуй. Не выдумывай числа/суммы/имена/даты — используй реальные значения из инструментов.
2. Нужен документ — составь полный текст инструментом draftDocument.
3. ВНЕШНИЕ и НЕОБРАТИМЫЕ действия (официальная отправка требования, подача иска в суд, списание долга) сам не выполняй. Сначала подготовь документ, затем инструментом queueApproval поставь его в раздел «Подтверждения» и скажи пользователю подтвердить там.
4. Отвечай по-русски, точно, профессионально и кратко. Понятно объясняй, что сделал.
5. Для правового основания указывай НАЗВАНИЕ кодекса (Гражданский кодекс, ЭПК); номер статьи не выдумывай.`,
  en: `You are the Lex AI Agent for Uzbekistan debt collection and legal documents. Goal: actually accomplish the user's objective using TOOLS.
Rules:
1. First read needed DATA with a tool (e.g. list of debts), only then answer or act. Never invent numbers/amounts/names/dates — use real values from tools.
2. If a document is needed, produce the full text with the draftDocument tool.
3. Do NOT perform EXTERNAL or IRREVERSIBLE actions (officially send a demand, file a court claim, write off a debt) yourself. First prepare the document, then use the queueApproval tool to queue it in the Approvals section and tell the user to confirm there.
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
  const model = getAgentModel();
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

  // QO'LDA tool-calling halqasi: har qadamda maxSteps=1 (bitta model chaqiruvi).
  // Asbob natijasini modelning XOM functionCall qismi sifatida EMAS, oddiy MATN
  // sifatida qaytaramiz — shunda Gemini "thought_signature" talab qilmaydi.
  const msgs: { role: "user" | "assistant"; content: string }[] = opts.messages.map((m) => ({ role: m.role, content: m.content }));
  const maxRounds = Math.max(1, Math.min(opts.maxSteps ?? 5, 8));
  const sys = SYS[opts.locale] ?? SYS.uz;
  let finalText = "";
  try {
    for (let round = 0; round < maxRounds; round++) {
      const lastRound = round === maxRounds - 1;
      const r = await generateText({
        model,
        system: sys,
        messages: msgs,
        tools: lastRound ? undefined : aiTools, // oxirgi aylanada matn javobga majburlaymiz
        maxSteps: 1,
      });
      const calls = r.toolCalls ?? [];
      if (lastRound || calls.length === 0) {
        finalText = r.text;
        break;
      }
      // Asbob natijalarini oddiy matn sifatida kontekstga qo'shamiz.
      const summary = (r.toolResults ?? [])
        .map((tr) => {
          const t = tr as { toolName?: string; result?: unknown };
          return `Asbob "${t.toolName}" natijasi:\n${JSON.stringify(t.result ?? null).slice(0, 6000)}`;
        })
        .join("\n\n");
      msgs.push({ role: "assistant", content: `[asboblar chaqirildi: ${calls.map((c) => (c as { toolName?: string }).toolName).join(", ")}]` });
      msgs.push({ role: "user", content: `${summary}\n\nShu HAQIQIY natijalar asosida javobni yakunla yoki kerak bo'lsa boshqa asbobni chaqir. Raqam va nomlarni o'zgartirma, o'ylab topma.` });
      finalText = r.text;
    }
    return { text: (finalText || "").trim(), steps };
  } catch (e) {
    console.error("[runAgent] error:", (e as Error)?.stack ?? e);
    return {
      text: opts.locale === "ru" ? "Ошибка AI. Повторите." : opts.locale === "en" ? "AI error. Try again." : "AI xatosi. Qayta urinib ko'ring.",
      steps,
    };
  }
}
