"use server";

import { API_URL } from "@/lib/api";

export interface NegotiationOffer {
  type: string;
  text: string;
  acceptMinor: number;
  schedule?: { month: number; amount: number }[];
}

/** Qarzdor bo'lib-to'lash / kelishuv so'raydi — AI qoidalarga ko'ra taklif qaytaradi (public). */
export async function negotiateDebt(id: string, type: "installment" | "settlement", months?: number): Promise<NegotiationOffer | null> {
  try {
    const res = await fetch(`${API_URL}/pay/${id}/negotiate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, months }),
      cache: "no-store",
    });
    const json = (await res.json()) as { success?: boolean; data?: { offer?: NegotiationOffer } };
    return json?.success && json.data?.offer ? json.data.offer : null;
  } catch {
    return null;
  }
}
