"use server";

import type { AuditData } from "@/components/audit/audit-client";
import { apiServer } from "@/lib/api";

export async function fetchAudit(params: { page: number; actor: string; q: string }): Promise<AuditData | null> {
  const sp = new URLSearchParams({ page: String(params.page) });
  if (params.actor && params.actor !== "all") sp.set("actor", params.actor);
  if (params.q.trim()) sp.set("q", params.q.trim());
  const res = await apiServer<AuditData>(`/api/audit?${sp.toString()}`);
  return res.data ?? null;
}
