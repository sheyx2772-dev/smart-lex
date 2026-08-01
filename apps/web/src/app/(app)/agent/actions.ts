"use server";

import { apiServer } from "@/lib/api";

/** Autopilot sozlamasini saqlash (mode / aggressiveness). */
export async function saveAgentConfig(mode: string, aggressiveness: string): Promise<{ ok: boolean }> {
  const res = await apiServer("/api/agent/autopilot/config", {
    method: "POST",
    body: JSON.stringify({ mode, aggressiveness }),
  });
  return { ok: Boolean(res.data) };
}

/** Agentni hoziroq bir marta ishga tushirish (qarzlarni ko'rib chiqadi, qaror qabul qiladi). */
export async function runAgentNow(): Promise<{ ok: boolean }> {
  const res = await apiServer("/api/agent/run", { method: "POST", body: JSON.stringify({}) });
  return { ok: Boolean(res.data) };
}
