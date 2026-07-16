"use server";

import { revalidatePath } from "next/cache";
import { apiServer } from "@/lib/api";

interface Sig {
  pkcs7: string;
  signerName: string;
  certSerial: string;
  signedAt: string;
  provider: "eimzo" | "mock";
}

export async function decideApproval(id: string, decision: "approved" | "rejected", body?: string, signature?: Sig) {
  const res = await apiServer(`/api/approvals/${id}/decide`, {
    method: "POST",
    body: JSON.stringify({ decision, ...(body !== undefined ? { body } : {}), ...(signature ? { signature } : {}) }),
  });
  revalidatePath("/approvals");
  revalidatePath("/");
  revalidatePath("/companies");
  revalidatePath("/reminders");
  return res;
}
