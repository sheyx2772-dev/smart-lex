"use server";

import { apiServer } from "@/lib/api";

/** Click to'lov buyurtmasi → to'lov URL (foydalanuvchi shu URLga o'tadi). */
export async function createClickPayment(plan: string, months: number): Promise<{ ok: boolean; url?: string; error?: string }> {
  const res = await apiServer<{ ok: boolean; url?: string; error?: string }>("/api/payment/click/create", {
    method: "POST",
    body: JSON.stringify({ plan, months }),
  });
  return res.data ?? { ok: false, error: "network" };
}
