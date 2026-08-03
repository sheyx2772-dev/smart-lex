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

/** Kengaytma cabinet.sud.uz'dan olgan X-AUTH-TOKEN'ni serverga saqlaydi. */
export async function connectCourtToken(token: string) {
  return apiServer<{ connected: boolean }>("/api/court/token", { method: "POST", body: JSON.stringify({ token }) });
}

export async function getCourtTokenStatus() {
  const res = await apiServer<{ connected: boolean; at: string | null }>("/api/court/token");
  return res.data ?? { connected: false, at: null };
}

export interface SudEntity {
  entity_id: string;
  name: string;
  entity_type: "PERSON" | "ORGANIZATION";
  tin?: string;
}

export async function getCourtEntities(id: string) {
  const res = await apiServer<{ available: boolean; reason?: string; detail?: string; entities?: SudEntity[] }>(`/api/court/${id}/file/entities`);
  return res.data ?? { available: false, reason: "error" };
}

export async function prepareCourtFiling(id: string, entityId: string) {
  const res = await apiServer<{ available: boolean; reason?: string; detail?: string; summary?: { defendantName: string; defendantTin: string } }>(
    `/api/court/${id}/file/prepare`,
    { method: "POST", body: JSON.stringify({ entityId }) },
  );
  return res.data ?? { available: false, reason: "error" };
}

export async function submitCourtFiling(id: string) {
  const res = await apiServer<{ available: boolean; reason?: string; detail?: string; caseId?: string }>(`/api/court/${id}/file/submit`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (res.data?.available) revalidatePath("/court");
  return res.data ?? { available: false, reason: "error" };
}
