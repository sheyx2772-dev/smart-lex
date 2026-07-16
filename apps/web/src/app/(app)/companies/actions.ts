"use server";

import type { CompaniesData } from "@/components/companies/companies-client";
import { apiServer } from "@/lib/api";

export async function fetchCompanies(params: { page: number; q: string }): Promise<CompaniesData | null> {
  const sp = new URLSearchParams({ page: String(params.page) });
  if (params.q.trim()) sp.set("q", params.q.trim());
  const res = await apiServer<CompaniesData>(`/api/companies?${sp.toString()}`);
  return res.data ?? null;
}
