"use server";

import type { ReceivablesData } from "@/components/receivables/receivables-client";
import type { ReceivableDetail } from "@/components/receivables/types";
import { apiServer } from "@/lib/api";

export async function getReceivableDetail(id: string): Promise<ReceivableDetail | null> {
  const res = await apiServer<ReceivableDetail>(`/api/receivables/${id}`);
  return res.data ?? null;
}

export async function recordPayment(id: string, amountMinor: string, paidAt?: string) {
  return apiServer(`/api/receivables/${id}/payment`, {
    method: "POST",
    body: JSON.stringify({ amountMinor, ...(paidAt ? { paidAt } : {}) }),
  });
}

export async function writeOffReceivable(id: string) {
  return apiServer(`/api/receivables/${id}/write-off`, { method: "POST" });
}

export async function sendReminder(id: string) {
  return apiServer<{ channel: string; address: string }>(`/api/receivables/${id}/reminder`, { method: "POST" });
}

export async function listForFinancing(receivableId: string, requestedDiscountBps?: number) {
  return apiServer<{ id: string }>("/api/financing/list", {
    method: "POST",
    body: JSON.stringify({ receivableId, requestedDiscountBps }),
  });
}

export async function withdrawFromFinancing(listingId: string) {
  return apiServer(`/api/financing/${listingId}/withdraw`, { method: "POST" });
}

export async function fetchReceivables(params: {
  page: number;
  status: string;
  sort: string;
  q: string;
}): Promise<ReceivablesData | null> {
  const sp = new URLSearchParams({ page: String(params.page), sort: params.sort });
  if (params.status && params.status !== "all") sp.set("status", params.status);
  if (params.q.trim()) sp.set("q", params.q.trim());
  const res = await apiServer<ReceivablesData>(`/api/receivables?${sp.toString()}`);
  return res.data ?? null;
}
