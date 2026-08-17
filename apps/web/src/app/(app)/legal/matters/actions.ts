"use server";

import { apiServer } from "@/lib/api";

export interface MatterListItem {
  id: string;
  matterNumber: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  riskLevel: string | null;
  dueDate: string | null;
  contractorName: string | null;
  updatedAt: string;
}
export interface MatterListData {
  items: MatterListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export async function fetchLegalMatters(params: { filter: string; page: number }): Promise<MatterListData | null> {
  const sp = new URLSearchParams({ page: String(params.page) });
  if (params.filter) sp.set("filter", params.filter);
  const res = await apiServer<MatterListData>(`/api/legal/matters?${sp.toString()}`);
  return res.data ?? null;
}
