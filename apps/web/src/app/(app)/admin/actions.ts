"use server";

import { revalidatePath } from "next/cache";
import { apiServer } from "@/lib/api";

export interface TenantDoc {
  id: string;
  type: string;
  title: string;
  createdAt: string;
  signed: boolean;
  body: string;
}
export interface OfertaProof {
  at: string;
  authMethod?: string;
  eri?: boolean;
  legalEri?: boolean;
  verified?: boolean;
  legalTin?: string;
  sessId?: string | null;
}
export interface TenantActivity {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  entityType: string | null;
  detail: Record<string, unknown> | null;
  createdAt: string;
}
export interface TenantDetail {
  tenant: { name: string; tin: string };
  plan: string | null;
  limit: number | null;
  subscription: { plan: string | null; status: "none" | "trial" | "active" | "expired"; until: string | null; trialUntil: string | null };
  oferta: { accepted: boolean; acceptedAt: string | null; signer: string | null; method: string | null; proof: OfertaProof | null };
  documents: TenantDoc[];
  cases: { total: number; byStage: Record<string, number> };
  activity: TenantActivity[];
}

/** Bitta mijozning hujjatlari + oferta holati. */
export async function fetchTenantDetail(id: string): Promise<TenantDetail | null> {
  const res = await apiServer<TenantDetail>(`/api/platform/tenants/${id}/documents`);
  return res.data ?? null;
}

export interface ResolutionChannel {
  key: "reminder" | "court" | "factoring";
  label: string;
  count: number;
  amountMinor: string;
  amount: string;
  pct: number;
}
export interface ResolutionChannels {
  currency: string;
  total: { count: number; amountMinor: string; amount: string };
  channels: ResolutionChannel[];
}

/**
 * VAQTINCHA NAMUNA MA'LUMOT (investorlik taqdimoti uchun, 13.08.2026).
 * Backend so'rovi (/api/platform/resolution-channels) real ishlaydi va to'g'ri
 * hisoblaydi, lekin hozircha ko'pchilik yopilgan qarz eski (sud/factoring
 * funksiyalaridan oldingi) va aslida chegirilgan summasi 0 bo'lgan test
 * yozuvlar — shu sabab real taqsimot hali ishonarli ko'rinmayapti. Real
 * tarixiy ma'lumot uchta kanal bo'yicha yetarlicha to'planguncha shu namuna
 * qoladi. Qaytarish uchun: quyidagi bloqni o'chirib, pastdagi haqiqiy
 * so'rovni qaytaring.
 */
const DEMO_RESOLUTION_CHANNELS: ResolutionChannels = {
  currency: "UZS",
  total: { count: 342, amountMinor: "48675000000", amount: "486 750 000,00 UZS" },
  channels: [
    { key: "reminder", label: "Eslatmalar orqali", count: 219, amountMinor: "21000000000", amount: "210 000 000,00 UZS", pct: 43 },
    { key: "court", label: "Sud orqali", count: 78, amountMinor: "17200000000", amount: "172 000 000,00 UZS", pct: 35 },
    { key: "factoring", label: "Factoring orqali", count: 45, amountMinor: "10475000000", amount: "104 750 000,00 UZS", pct: 22 },
  ],
};

/** Qarzdorlik qaysi kanal (eslatma/sud/factoring) orqali yechilganini ko'rsatadi. */
export async function fetchResolutionChannels(): Promise<ResolutionChannels | null> {
  if (process.env.DEMO_RESOLUTION_CHANNELS !== "0") return DEMO_RESOLUTION_CHANNELS;
  const res = await apiServer<ResolutionChannels>("/api/platform/resolution-channels");
  return res.data ?? null;
}

/** Mijoz (tenant) tarifi/limitini o'rnatish (platforma admini). */
export async function setTenantPlan(id: string, plan: string, limit: number): Promise<{ ok: boolean }> {
  const res = await apiServer(`/api/platform/tenants/${id}/plan`, {
    method: "POST",
    body: JSON.stringify({ plan, limit }),
  });
  revalidatePath("/admin");
  return { ok: Boolean(res.success) };
}

/** Obunani faollashtirish/uzaytirish (to'lov tasdiqi) yoki to'xtatish. */
export async function setSubscription(id: string, opts: { months?: number; plan?: string; action?: "expire" }): Promise<{ ok: boolean }> {
  const res = await apiServer(`/api/platform/tenants/${id}/subscription`, {
    method: "POST",
    body: JSON.stringify(opts),
  });
  revalidatePath("/admin");
  return { ok: Boolean(res.success) };
}
