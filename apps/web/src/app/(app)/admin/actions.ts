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
