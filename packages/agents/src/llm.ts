import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { type LanguageModelV1 } from "ai";

/**
 * Multi-provider LLM tanlash (Vercel AI SDK). Kalit yo'q bo'lsa `null` qaytadi —
 * chaqiruvchi kod deterministik shablonga o'tadi (offline/kalitsiz ishlash uchun).
 * Pul/huquqiy HISOB-KITOB hech qachon LLM'da emas — faqat matn generatsiyasi.
 *
 * AI_PROVIDER = anthropic | google | groq
 */
export function getModel(): LanguageModelV1 | null {
  const provider = process.env.AI_PROVIDER ?? "anthropic";

  if (provider === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    return anthropic("claude-sonnet-5");
  }
  if (provider === "google" && process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return google(process.env.GEMINI_MODEL ?? "gemini-flash-latest");
  }
  if (provider === "groq" && process.env.GROQ_API_KEY) {
    return groq(process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile");
  }

  // Fallback: qaysi kalit bor bo'lsa o'shani ishlatadi.
  if (process.env.GROQ_API_KEY) return groq(process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile");
  if (process.env.ANTHROPIC_API_KEY) return anthropic("claude-sonnet-5");
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) return google("gemini-2.0-flash");
  return null;
}

/**
 * Tool-calling AGENT uchun model — Groq afzal (funksiya-chaqiruvni toza va tez
 * qo'llaydi), keyin Anthropic, oxirida umumiy getModel(). Gemini "thinking" modeli
 * ko'p-qadamli toolда thought_signature talab qilib xato beradi, shu bois agentда emas.
 */
export function getAgentModel(): LanguageModelV1 | null {
  if (process.env.GROQ_API_KEY) return groq(process.env.GROQ_AGENT_MODEL ?? process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile");
  if (process.env.ANTHROPIC_API_KEY) return anthropic("claude-sonnet-5");
  return getModel();
}

export function isLlmAvailable(): boolean {
  return getModel() !== null;
}
