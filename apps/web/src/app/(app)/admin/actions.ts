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
export interface TenantDetail {
  tenant: { name: string; tin: string };
  oferta: { accepted: boolean; acceptedAt: string | null; signer: string | null; method: string | null };
  documents: TenantDoc[];
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
