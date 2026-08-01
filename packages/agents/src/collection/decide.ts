import { type Locale } from "@lex/shared";
import { generateText } from "ai";
import { getModel } from "../llm";

/**
 * AI UNDIRUV-MIYASI — har bir qarzdor uchun "keyingi eng yaxshi harakat"ni hal qiladi.
 * Qat'iy kunlik jadval emas: summa, kechikish, risk, tarix va oldingi javoblarни
 * hisobga olib INDIVIDUAL strategiya beradi + qarorni TUSHUNTIRADI (explainability) +
 * undirish ehtimolini baholaydi. LLM yo'q/xato bo'lsa — deterministik zaxira qaror.
 */

export type CollectionAction = "wait" | "soft_reminder" | "firm_reminder" | "call" | "demand_letter" | "court" | "settlement_offer";
export type ContactChannel = "sms" | "email" | "telegram";

export interface CollectionContext {
  locale: Locale;
  creditorName: string;
  debtorName: string;
  amountMajor: number; // asosiy birlikda (so'm), tiyin emas
  penaltyMajor?: number;
  currency: string;
  overdueDays: number;
  agingBucket: string;
  riskScore: number; // 0-100 (mavjud calcRisk)
  executedStages: string[]; // allaqachon bajarilgan bosqichlar
  availableChannels: ContactChannel[];
  respondedBefore?: boolean; // qarzdor oldingi eslatmaga javob berganmi
  partialPaid?: boolean; // qisman to'laganmi
}

export interface CollectionDecision {
  action: CollectionAction;
  channel: ContactChannel | "none";
  tone: "friendly" | "firm" | "formal";
  recoveryScore: number; // 0-100 — hozir harakat qilinsa undirish ehtimoli
  priority: "high" | "medium" | "low";
  reason: string; // NEGA shu qaror — foydalanuvchi tiliда qisqa tushuntirish
  draftMessage?: string; // yuboriladigan xabar matni (agar action = xabar bo'lsa)
  settlementPercent?: number; // settlement_offer bo'lsa — minimal qabul foizi
  source: "ai" | "rule";
}

const ACTIONS: CollectionAction[] = ["wait", "soft_reminder", "firm_reminder", "call", "demand_letter", "court", "settlement_offer"];

const SYS: Record<Locale, string> = {
  uz: "Sen LEX.AI avtonom undiruv strategisisan — O'zbekistondagi yuridik firma nomidan qarz undirasan. Sengа bitta qarzdor holati JSON'da beriladi. Sen FAQAT bitta JSON obyekt qaytarasan (boshqa matn yo'q), maydonlar: action (wait|soft_reminder|firm_reminder|call|demand_letter|court|settlement_offer), channel (sms|email|telegram|none), tone (friendly|firm|formal), recoveryScore (0-100 butun), priority (high|medium|low), reason (o'zbekcha, 1 qisqa jumla — NEGA shu qaror), draftMessage (o'zbekcha, professional, summani aniq yozgan holda; wait/court bo'lsa bo'sh), settlementPercent (settlement_offer bo'lsa 50-90 oralig'ida, aks holda 0). Qoidalar: eskalatsiyani executedStages va kechikish kunlariga qarab oshir; recoveryScore realistik bo'lsin (yuqori risk/ko'p kechikish = past ehtimol); channel faqat availableChannels'dan; raqam/summa/nom o'ylab topma. Faqat JSON.",
  ru: "Ты автономный стратег взыскания LEX.AI — взыскиваешь долг от имени юрфирмы в Узбекистане. Тебе дают состояние одного должника в JSON. Верни ТОЛЬКО один JSON-объект (без другого текста), поля: action (wait|soft_reminder|firm_reminder|call|demand_letter|court|settlement_offer), channel (sms|email|telegram|none), tone (friendly|firm|formal), recoveryScore (0-100 целое), priority (high|medium|low), reason (по-русски, 1 короткое предложение — ПОЧЕМУ), draftMessage (по-русски, профессионально, с точной суммой; для wait/court пусто), settlementPercent (для settlement_offer 50-90, иначе 0). Правила: эскалируй по executedStages и дням просрочки; recoveryScore реалистичен; channel только из availableChannels; не выдумывай числа/суммы/имена. Только JSON.",
  en: "You are LEX.AI's autonomous collections strategist, recovering debt for a law firm in Uzbekistan. You get one debtor's state as JSON. Return ONLY one JSON object (no other text), fields: action (wait|soft_reminder|firm_reminder|call|demand_letter|court|settlement_offer), channel (sms|email|telegram|none), tone (friendly|firm|formal), recoveryScore (0-100 integer), priority (high|medium|low), reason (one short sentence — WHY), draftMessage (professional, exact amount; empty for wait/court), settlementPercent (50-90 for settlement_offer, else 0). Rules: escalate by executedStages and overdue days; realistic recoveryScore; channel only from availableChannels; never invent numbers/amounts/names. JSON only.",
};

function clampScore(n: unknown, dflt: number): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return dflt;
  return Math.max(0, Math.min(100, Math.round(v)));
}

/** Deterministik zaxira — LLM yo'q/xato bo'lganda mavjud undiruv zinasini takrorlaydi. */
export function ruleDecision(ctx: CollectionContext): CollectionDecision {
  const done = new Set(ctx.executedStages);
  const channel = ctx.availableChannels[0] ?? "none";
  // Risk yuqori + kechikish ko'p → undirish ehtimoli past.
  const recoveryScore = Math.max(5, Math.min(95, Math.round(100 - ctx.riskScore * 0.6 - Math.min(ctx.overdueDays, 120) * 0.3)));
  const priority: CollectionDecision["priority"] = ctx.amountMajor >= 10_000_000 || ctx.overdueDays >= 60 ? "high" : ctx.overdueDays >= 30 ? "medium" : "low";
  let action: CollectionAction = "wait";
  let tone: CollectionDecision["tone"] = "friendly";
  if (!done.has("soft_reminder")) {
    action = "soft_reminder";
    tone = "friendly";
  } else if (!done.has("firm_reminder") && ctx.overdueDays >= 15) {
    action = "firm_reminder";
    tone = "firm";
  } else if (!done.has("demand_letter") && ctx.overdueDays >= 30) {
    action = "demand_letter";
    tone = "formal";
  } else if (!done.has("court") && ctx.overdueDays >= 60) {
    action = "court";
    tone = "formal";
  }
  return {
    action,
    channel: action === "wait" || action === "court" || action === "demand_letter" ? "none" : channel,
    tone,
    recoveryScore,
    priority,
    reason:
      action === "wait"
        ? "Barcha bosqichlar bajarilgan — javob kutilmoqda"
        : `${ctx.overdueDays} kun kechikish, ${done.size} bosqich bajarilgan — keyingi qadam: ${action}`,
    source: "rule",
  };
}

function extractJson(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** AI qarori (fallback zanjiri orqali ishonchli). Xato/kalitsiz → ruleDecision. */
export async function decideCollectionAction(ctx: CollectionContext): Promise<CollectionDecision> {
  const model = getModel();
  const fallback = ruleDecision(ctx);
  if (!model) return fallback;
  try {
    const { text } = await generateText({
      model,
      temperature: 0.2,
      system: SYS[ctx.locale],
      prompt: JSON.stringify({
        creditor: ctx.creditorName,
        debtor: ctx.debtorName,
        amount: ctx.amountMajor,
        penalty: ctx.penaltyMajor ?? 0,
        currency: ctx.currency,
        overdueDays: ctx.overdueDays,
        agingBucket: ctx.agingBucket,
        riskScore: ctx.riskScore,
        executedStages: ctx.executedStages,
        availableChannels: ctx.availableChannels,
        respondedBefore: ctx.respondedBefore ?? false,
        partialPaid: ctx.partialPaid ?? false,
      }),
    });
    const j = extractJson(text);
    if (!j) return fallback;
    const action = ACTIONS.includes(j.action as CollectionAction) ? (j.action as CollectionAction) : fallback.action;
    let channel = j.channel === "none" || ctx.availableChannels.includes(j.channel as ContactChannel) ? (j.channel as ContactChannel | "none") : fallback.channel;
    if (action === "wait" || action === "court" || action === "demand_letter") channel = "none";
    const tone = (["friendly", "firm", "formal"] as const).includes(j.tone as "friendly") ? (j.tone as CollectionDecision["tone"]) : fallback.tone;
    const priority = (["high", "medium", "low"] as const).includes(j.priority as "high") ? (j.priority as CollectionDecision["priority"]) : fallback.priority;
    const draft = typeof j.draftMessage === "string" && j.draftMessage.trim().length > 4 ? j.draftMessage.trim() : undefined;
    const settlement = action === "settlement_offer" ? Math.max(50, Math.min(90, clampScore(j.settlementPercent, 70))) : undefined;
    return {
      action,
      channel,
      tone,
      recoveryScore: clampScore(j.recoveryScore, fallback.recoveryScore),
      priority,
      reason: typeof j.reason === "string" && j.reason.trim() ? j.reason.trim() : fallback.reason,
      draftMessage: draft,
      settlementPercent: settlement,
      source: "ai",
    };
  } catch {
    return fallback;
  }
}
