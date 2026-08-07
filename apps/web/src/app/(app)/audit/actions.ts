"use server";

import type { AuditAnchor, AuditChainStatus, AuditData } from "@/components/audit/audit-client";
import { apiServer } from "@/lib/api";

export async function fetchAudit(params: { page: number; actor: string; q: string }): Promise<AuditData | null> {
  const sp = new URLSearchParams({ page: String(params.page) });
  if (params.actor && params.actor !== "all") sp.set("actor", params.actor);
  if (params.q.trim()) sp.set("q", params.q.trim());
  const res = await apiServer<AuditData>(`/api/audit?${sp.toString()}`);
  return res.data ?? null;
}

export async function fetchAuditChainStatus(): Promise<AuditChainStatus | null> {
  const res = await apiServer<AuditChainStatus>("/api/audit/verify");
  return res.data ?? null;
}

export async function fetchAuditAnchors(): Promise<AuditAnchor[]> {
  const res = await apiServer<{ items: AuditAnchor[] }>("/api/audit/anchors");
  return res.data?.items ?? [];
}
