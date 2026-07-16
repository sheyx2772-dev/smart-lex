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
