"use server";

import { apiServer } from "@/lib/api";

export interface LegalTask {
  id: string;
  category: "urgent" | "recommendation" | "auto_check";
  title: string;
  reason: string;
  legalMatterId: string | null;
  contractorId: string | null;
  documentId: string | null;
  createdAt: string;
  contractorName: string | null;
  matterTitle: string | null;
}

export async function fetchLegalTasks(): Promise<LegalTask[]> {
  const res = await apiServer<LegalTask[]>("/api/legal/tasks");
  return res.data ?? [];
}

export async function resolveLegalTask(id: string) {
  return apiServer(`/api/legal/tasks/${id}/resolve`, { method: "POST", body: "{}" });
}

export async function runLegalTaskAgent(id: string) {
  return apiServer<{ draft: string; approvalId: string | null }>(`/api/legal/tasks/${id}/agent-run`, { method: "POST", body: "{}" });
}
