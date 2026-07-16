"use server";

import { revalidatePath } from "next/cache";
import { apiServer } from "@/lib/api";

export async function generateReconciliation(contractorId: string) {
  const res = await apiServer<{ documentId: string; actNumber: string }>(
    `/api/companies/${contractorId}/reconciliation`,
    { method: "POST", body: JSON.stringify({}) },
  );
  if (res.success) {
    revalidatePath(`/companies/${contractorId}`);
    revalidatePath("/documents");
  }
  return res;
}

export async function generateLawsuit(contractorId: string) {
  const res = await apiServer<{ approvalId: string; court: string; stateDuty: string; total: string }>(
    `/api/companies/${contractorId}/lawsuit`,
    { method: "POST", body: JSON.stringify({}) },
  );
  if (res.success) {
    revalidatePath(`/companies/${contractorId}`);
    revalidatePath("/approvals");
    revalidatePath("/");
  }
  return res;
}
