"use server";

import { revalidatePath } from "next/cache";
import { apiServer } from "@/lib/api";

export interface FinancingListingRow {
  id: string;
  status: string;
  amountMinor: string;
  currency: string;
  riskScoreAtListing: number;
  suggestedDiscountBps: number;
  requestedDiscountBps: number | null;
  matchedPartnerName: string | null;
  matchedDiscountBps: number | null;
  createdAt: string;
  contractorName: string;
  invoiceNumber: string | null;
  tenantId: string;
  tenantName: string;
}

export async function fetchFinancingListings(): Promise<FinancingListingRow[]> {
  const res = await apiServer<{ items: FinancingListingRow[] }>("/api/platform/financing");
  return res.data?.items ?? [];
}

export async function matchFinancingListing(
  id: string,
  tenantId: string,
  opts: { matchedPartnerName: string; matchedDiscountBps?: number; status: "matched" | "completed" },
): Promise<{ ok: boolean }> {
  const res = await apiServer(`/api/platform/financing/${id}/match`, {
    method: "POST",
    body: JSON.stringify({ tenantId, ...opts }),
  });
  revalidatePath("/admin/financing");
  return { ok: Boolean(res.success) };
}
