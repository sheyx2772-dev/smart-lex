"use server";

import { apiServer } from "@/lib/api";

type PayRes = { ok: boolean; url?: string; error?: string };

/** Click to'lov buyurtmasi → to'lov URL (foydalanuvchi shu URLga o'tadi). */
export async function createClickPayment(plan: string, months: number): Promise<PayRes> {
  const res = await apiServer<PayRes>("/api/payment/click/create", { method: "POST", body: JSON.stringify({ plan, months }) });
  return res.data ?? { ok: false, error: "network" };
}

/** Payme to'lov buyurtmasi → checkout URL. */
export async function createPaymePayment(plan: string, months: number): Promise<PayRes> {
  const res = await apiServer<PayRes>("/api/payment/payme/create", { method: "POST", body: JSON.stringify({ plan, months }) });
  return res.data ?? { ok: false, error: "network" };
}
