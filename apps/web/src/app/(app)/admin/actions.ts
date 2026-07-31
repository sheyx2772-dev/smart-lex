"use server";

import { revalidatePath } from "next/cache";
import { apiServer } from "@/lib/api";

/** Mijoz (tenant) tarifi/limitini o'rnatish (platforma admini). */
export async function setTenantPlan(id: string, plan: string, limit: number): Promise<{ ok: boolean }> {
  const res = await apiServer(`/api/platform/tenants/${id}/plan`, {
    method: "POST",
    body: JSON.stringify({ plan, limit }),
  });
  revalidatePath("/admin");
  return { ok: Boolean(res.success) };
}
