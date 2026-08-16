import { type Locale } from "@lex/shared";
import { generateText } from "ai";
import { getModel } from "../llm";
import { lawContextText } from "./law-base";
import { LEGAL_KB } from "./studio";

export interface ContractRiskFinding {
  area: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  reason: string;
}
export interface ContractRiskResult {
  riskLevel: "low" | "medium" | "high" | "critical";
  findings: ContractRiskFinding[];
  missingClauses: string[];
  unusualClauses: string[];
  analyzedAt: string;
}

const EMPTY: Omit<ContractRiskResult, "analyzedAt"> = { riskLevel: "low", findings: [], missingClauses: [], unusualClauses: [] };

function extractJson(text: string): Record<string, unknown> | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}
const RISK_LEVELS = new Set(["low", "medium", "high", "critical"]);
const asRisk = (v: unknown): ContractRiskResult["riskLevel"] => (RISK_LEVELS.has(String(v)) ? (v as ContractRiskResult["riskLevel"]) : "low");
const asStrArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map(String) : []);

/**
 * Shartnoma matnini AI orqali huquqiy xavf nuqtai nazaridan tahlil qiladi — aniq
 * qiymatlarni O'YLAB TOPMAYDI, faqat matndagi bandlarga asoslanadi. Natija
 * documents.extracted.riskAnalysis'ga saqlanadi (schema o'zgarishisiz).
 */
export async function analyzeContractRisk(text: string, locale: Locale): Promise<ContractRiskResult> {
  const model = getModel();
  if (!model || !text.trim()) return { ...EMPTY, analyzedAt: new Date().toISOString() };

  const kb = LEGAL_KB[locale] ?? LEGAL_KB.uz;
  const law = lawContextText(text.slice(0, 2500));
  const prompt = [
    kb,
    law,
    "",
    "Quyidagi shartnoma matnini huquqiy XAVF nuqtai nazaridan tahlil qil. FAQAT JSON qaytar (izohsiz, kod bloksiz):",
    "{",
    '  "riskLevel": "low"|"medium"|"high"|"critical",   // umumiy xavf darajasi',
    '  "findings": [{"area": string, "riskLevel": "low"|"medium"|"high"|"critical", "reason": string}],',
    '  "missingClauses": string[],   // shartnomada yo\'q, lekin bo\'lishi kerak bo\'lgan muhim bandlar',
    '  "unusualClauses": string[]    // g\'ayrioddiy yoki bir tomonlama noqulay bandlar',
    "}",
    "Faqat matnda haqiqatan mavjud bo'lgan bandlarga tayan; raqam/summa/sana O'YLAB TOPMA. Huquqiy asos kerak bo'lsa kodeks NOMINI yoz, modda raqamini taxmin qilma.",
    "",
    "SHARTNOMA MATNI:",
    text.slice(0, 12000),
  ].join("\n");

  try {
    const { text: raw } = await generateText({ model, temperature: 0, prompt });
    const j = extractJson(raw);
    if (!j) return { ...EMPTY, analyzedAt: new Date().toISOString() };
    const findings = Array.isArray(j.findings)
      ? (j.findings as unknown[])
          .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
          .map((f) => ({ area: String(f.area ?? ""), riskLevel: asRisk(f.riskLevel), reason: String(f.reason ?? "") }))
          .filter((f) => f.area && f.reason)
      : [];
    return {
      riskLevel: asRisk(j.riskLevel),
      findings,
      missingClauses: asStrArr(j.missingClauses),
      unusualClauses: asStrArr(j.unusualClauses),
      analyzedAt: new Date().toISOString(),
    };
  } catch (e) {
    console.error("[analyzeContractRisk] error:", (e as Error)?.stack ?? e);
    return { ...EMPTY, analyzedAt: new Date().toISOString() };
  }
}
