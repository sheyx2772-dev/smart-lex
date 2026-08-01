"use server";

import { apiServer } from "@/lib/api";

export interface MerchantData {
  click: { connected: boolean; serviceId: string; merchantId: string; secretKey: string };
  payme: { connected: boolean; merchantId: string; secretKey: string };
}

export async function saveMerchant(payload: { click?: Record<string, string>; payme?: Record<string, string> }): Promise<{ ok: boolean }> {
  const res = await apiServer("/api/merchant", { method: "POST", body: JSON.stringify(payload) });
  return { ok: Boolean(res.data) };
}
