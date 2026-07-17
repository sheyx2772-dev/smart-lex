"use server";

import { revalidatePath } from "next/cache";
import { apiServer } from "@/lib/api";

export interface NewContractInput {
  contractor: { name: string; tin: string; phone?: string; legalAddress?: string; email?: string };
  number: string;
  signedAt?: string;
  penaltyDailyBps: number;
  invoice: { number: string; amountMinor: string; issuedAt: string; dueDate: string };
}

/**
 * Yangi qarzdorlik ishi — qarzdor + shartnoma + hisob-faktura yaratadi va
 * darhol receivable (kuzatuv obyekti) hosil qiladi. Ish shundan keyin
 * Debitorlik / Muddati o'tgan / Skoring bo'limlarida ko'rinadi.
 */
export async function createContract(input: NewContractInput) {
  const res = await apiServer<{ contractorId: string; contractId: string; invoiceId: string; status: string }>("/api/contracts", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (res.success) {
    revalidatePath("/receivables");
    revalidatePath("/overdue");
    revalidatePath("/contracts");
    revalidatePath("/scoring");
    revalidatePath("/");
  }
  return res;
}
