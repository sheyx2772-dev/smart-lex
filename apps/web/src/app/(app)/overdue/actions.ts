"use server";

import type { OverdueData } from "@/components/overdue/overdue-client";
import { apiServer } from "@/lib/api";

export async function fetchOverdue(params: { page: number; aging: string }): Promise<OverdueData | null> {
  const sp = new URLSearchParams({ page: String(params.page) });
  if (params.aging && params.aging !== "all") sp.set("aging", params.aging);
  const res = await apiServer<OverdueData>(`/api/overdue?${sp.toString()}`);
  return res.data ?? null;
}
