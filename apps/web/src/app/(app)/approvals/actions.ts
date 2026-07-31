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

/** Talabnoma → Didox 1-qadam: imzolanadigan `toSign`ni oladi. */
export async function didoxPrepare(id: string): Promise<{ available: boolean; toSign?: string; reason?: string; detail?: string }> {
  const res = await apiServer<{ available: boolean; toSign?: string; reason?: string; detail?: string }>(`/api/approvals/${id}/didox/prepare`, { method: "POST" });
  return res.data ?? { available: false, reason: "network" };
}

/** Talabnoma → Didox 2-qadam: E-IMZO PKCS7 → Didox'ga jo'natish. */
export async function didoxSign(id: string, pkcs7: string): Promise<{ status: "sent" | "failed"; error?: string }> {
  const res = await apiServer<{ status: "sent" | "failed"; error?: string }>(`/api/approvals/${id}/didox/sign`, {
    method: "POST",
    body: JSON.stringify({ pkcs7 }),
  });
  revalidatePath("/approvals");
  revalidatePath("/reminders");
  return res.data ?? { status: "failed", error: "network" };
}
