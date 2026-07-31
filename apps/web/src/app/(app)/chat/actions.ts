"use server";

import { apiServer } from "@/lib/api";

export interface ChatResult {
  kind: "company" | "receivable" | "document";
  title: string;
  subtitle: string;
  href?: string;
}
export interface ChatReply {
  reply: string;
  results: ChatResult[];
  intent: string;
}

export async function sendChat(message: string): Promise<ChatReply> {
  const res = await apiServer<ChatReply>("/api/chat", { method: "POST", body: JSON.stringify({ message }) });
  return res.data ?? { reply: "", results: [], intent: "error" };
}

export interface AgentStep {
  tool: string;
  args: unknown;
  ok: boolean;
}
/** Lex AI Agent: suhbat tarixi → agent (tool-calling) javobi + bajarilgan qadamlar. */
export async function agentChat(messages: { role: "user" | "assistant"; content: string }[]): Promise<{ reply: string; steps: AgentStep[] }> {
  const res = await apiServer<{ reply: string; steps: AgentStep[] }>("/api/agent/chat", {
    method: "POST",
    body: JSON.stringify({ messages }),
  });
  return res.data ?? { reply: "", steps: [] };
}

/** Studio hujjat-fokusli AI: instruction + (ochiq hujjat matni) → LLM javob (draft yoki tahlil). */
export async function studioAi(instruction: string, document?: string): Promise<{ reply: string }> {
  const res = await apiServer<{ reply: string }>("/api/studio/ai", {
    method: "POST",
    body: JSON.stringify({ instruction, document: document ?? "" }),
  });
  return res.data ?? { reply: "" };
}
