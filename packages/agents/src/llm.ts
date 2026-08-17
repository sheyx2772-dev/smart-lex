import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { type LanguageModelV1 } from "ai";

/**
 * Multi-provider LLM tanlash + FALLBACK zanjiri (Vercel AI SDK v4).
 *
 * Pul yo'q — shuning uchun faqat TEKIN provayderlar zanjir qilinadi: biri limitga
 * (429 / quota / rate limit) ursa, chaqiruv avtomatik keyingi modelга o'tadi.
 * Chat: Groq (70b → 8b) → Gemini (flash). Agent (tool-calling): faqat Groq —
 * Gemini "thinking" modeli ko'p-qadamli toolда thought_signature talab qilib xato beradi.
 *
 * Kalit yo'q bo'lsa `null` qaytadi — chaqiruvchi deterministik shablonga o'tadi.
 * Pul/huquqiy HISOB-KITOB hech qachon LLM'da emas — faqat matn generatsiyasi.
 */

/** Xato qayta urinishga (fallback'ga) arziydimi — limit/quota/vaqtincha nosozlik. */
function isRetryable(err: unknown): boolean {
  const e = err as { statusCode?: number; status?: number; message?: unknown; data?: { error?: { code?: number } } };
  const status = e?.statusCode ?? e?.status ?? e?.data?.error?.code;
  const msg = String(e?.message ?? err ?? "").toLowerCase();
  return (
    status === 429 ||
    status === 500 ||
    status === 503 ||
    msg.includes("rate limit") ||
    msg.includes("rate_limit") ||
    msg.includes("too many requests") ||
    msg.includes("quota") ||
    msg.includes("resource_exhausted") ||
    msg.includes("overloaded") ||
    msg.includes("unavailable")
  );
}

const brief = (err: unknown): string => String((err as { message?: unknown })?.message ?? err).slice(0, 140);

/**
 * Bir nechta modelni bitta `LanguageModelV1`ga o'raydi: doGenerate/doStream biror
 * modelда limit/nosozlik bersa — zanjirdagi keyingi modelга o'tadi. Metadata birinchi
 * modeldan olinadi (SDK shu maydonlarni o'qiydi).
 */
function withFallback(models: LanguageModelV1[]): LanguageModelV1 | null {
  const base = models[0];
  if (!base) return null;
  if (models.length === 1) return base;
  const wrapped: LanguageModelV1 = {
    specificationVersion: base.specificationVersion,
    provider: base.provider,
    modelId: `fallback(${models.map((m) => m.modelId).join(" > ")})`,
    defaultObjectGenerationMode: base.defaultObjectGenerationMode,
    supportsUrl: base.supportsUrl?.bind(base),
    async doGenerate(options) {
      let lastErr: unknown = new Error("no model");
      for (let i = 0; i < models.length; i++) {
        const m = models[i];
        if (!m) continue;
        try {
          return await m.doGenerate(options);
        } catch (e) {
          lastErr = e;
          if (i === models.length - 1 || !isRetryable(e)) throw e;
          console.warn(`[llm] "${m.modelId}" → keyingisiga o'tildi: ${brief(e)}`);
        }
      }
      throw lastErr;
    },
    async doStream(options) {
      let lastErr: unknown = new Error("no model");
      for (let i = 0; i < models.length; i++) {
        const m = models[i];
        if (!m) continue;
        try {
          return await m.doStream(options);
        } catch (e) {
          lastErr = e;
          if (i === models.length - 1 || !isRetryable(e)) throw e;
          console.warn(`[llm] "${m.modelId}" (stream) → keyingisiga o'tildi: ${brief(e)}`);
        }
      }
      throw lastErr;
    },
  };
  return wrapped;
}

// ── Provayder bo'yicha model ro'yxatlari (faqat kaliti bor bo'lsa) ──
function groqModels(): LanguageModelV1[] {
  if (!process.env.GROQ_API_KEY) return [];
  // 2026-08: "llama-3.3-70b-versatile"/"llama-3.1-8b-instant" Groq'da o'chirilgan
  // (model_not_found) — GPT-OSS (OpenAI ochiq-og'irlik modeli, Groq'да mezbonlangan)
  // bilan almashtirilди: kuchliroq reasoning + tool-calling, hali ham bepul.
  const primary = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
  const secondary = process.env.GROQ_FALLBACK_MODEL ?? "openai/gpt-oss-20b"; // tezroq — zaxira
  return [...new Set([primary, secondary])].map((id) => groq(id));
}
function geminiModels(): LanguageModelV1[] {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) return [];
  // 2026-08: "gemini-2.0-flash" o'chirilgan (404). "-latest" alias ishlatilyapti —
  // Google versiyani eskirtirganda ham qayta sinash shart bo'lmasin.
  return [google(process.env.GEMINI_MODEL ?? "gemini-flash-latest")];
}
function anthropicModels(): LanguageModelV1[] {
  if (!process.env.ANTHROPIC_API_KEY) return [];
  return [anthropic("claude-sonnet-5")];
}

/** Zanjirni tuzadi. Bepul (Groq, Gemini) oldinda; Anthropic (pullik) oxirida zaxira. */
function buildChain(kind: "chat" | "agent"): LanguageModelV1[] {
  const groqM = groqModels();
  const gemM = kind === "agent" ? [] : geminiModels(); // agent = faqat Groq (tool xatosi tufayli)
  const antM = anthropicModels();
  const pref = process.env.AI_PROVIDER;
  if (pref === "google") return [...gemM, ...groqM, ...antM];
  if (pref === "anthropic") return [...antM, ...groqM, ...gemM];
  return [...groqM, ...gemM, ...antM]; // default: bepul-birinchi
}

/** Umumiy (chat / hujjat generatsiyasi) model — Groq→Gemini fallback zanjiri. */
export function getModel(): LanguageModelV1 | null {
  return withFallback(buildChain("chat"));
}

/** Tool-calling AGENT modeli — Groq zanjiri (70b→8b). Gemini toolда ishlamaydi. */
export function getAgentModel(): LanguageModelV1 | null {
  return withFallback(buildChain("agent"));
}

export function isLlmAvailable(): boolean {
  return getModel() !== null;
}
