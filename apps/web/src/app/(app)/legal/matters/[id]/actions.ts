"use server";

import { revalidatePath } from "next/cache";
import { apiServer } from "@/lib/api";

export interface RiskFinding {
  area: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  reason: string;
}
export interface RiskAnalysis {
  riskLevel: "low" | "medium" | "high" | "critical";
  findings: RiskFinding[];
  missingClauses: string[];
  unusualClauses: string[];
  analyzedAt: string;
}
export interface MatterDetail {
  matter: {
    id: string;
    matterNumber: string;
    title: string;
    type: string;
    status: string;
    priority: string;
    riskLevel: string | null;
    description: string | null;
    dueDate: string | null;
    closedAt: string | null;
    createdAt: string;
    contractorId: string | null;
    contractorName: string | null;
    contractorTin: string | null;
    contractorPhone: string | null;
    contractorEmail: string | null;
    contractId: string | null;
    contractNumber: string | null;
  };
  documents: { id: string; type: string; title: string; createdAt: string; extracted: { riskAnalysis?: RiskAnalysis } | null }[];
  approvals: { id: string; type: string; status: string; payload: Record<string, unknown>; createdAt: string; decidedAt: string | null }[];
  tasks: { id: string; category: string; title: string; reason: string; status: string; createdAt: string }[];
  activity: { id: string; actorType: string; action: string; detail: Record<string, unknown> | null; createdAt: string }[];
}

export async function fetchMatterDetail(id: string): Promise<MatterDetail | null> {
  const res = await apiServer<MatterDetail>(`/api/legal/matters/${id}`);
  return res.data ?? null;
}

export async function patchMatter(id: string, patch: { status?: string; priority?: string }) {
  const res = await apiServer(`/api/legal/matters/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  if (res.success) {
    revalidatePath(`/legal/matters/${id}`);
    revalidatePath("/legal/matters");
  }
  return res;
}

export async function submitMatterDraft(id: string, draft: { body: string; note?: string; docType?: string }) {
  const res = await apiServer<{ queued: boolean; id: string }>(`/api/legal/matters/${id}/draft-approval`, { method: "POST", body: JSON.stringify(draft) });
  if (res.success) revalidatePath(`/legal/matters/${id}`);
  return res;
}
