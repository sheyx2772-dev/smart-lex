"use server";

import { revalidatePath } from "next/cache";
import type { CourtData } from "@/components/court/court-client";
import { apiServer } from "@/lib/api";

export async function fetchCourt(): Promise<CourtData> {
  const res = await apiServer<CourtData>("/api/court");
  return res.data ?? { items: [], total: 0 };
}

export async function setCourtStatus(id: string, status: string) {
  const res = await apiServer(`/api/court/${id}/status`, { method: "POST", body: JSON.stringify({ status }) });
  if (res.success) revalidatePath("/court");
  return res;
}
