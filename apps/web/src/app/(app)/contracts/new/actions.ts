"use server";

import { revalidatePath } from "next/cache";
import { apiServer } from "@/lib/api";

interface CreatePayload {
  contractor: { name: string; tin: string; phone?: string };
  number: string;
  signedAt?: string;
  penaltyDailyBps: number;
  penaltyCapBps?: number | null;
  invoice: { number: string; amountMinor: string; issuedAt: string; dueDate: string };
}

export async function createContract(payload: CreatePayload) {
  const res = await apiServer<{ contractorId: string }>("/api/contracts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (res.success) {
    revalidatePath("/companies");
    revalidatePath("/receivables");
    revalidatePath("/");
  }
  return res;
}
