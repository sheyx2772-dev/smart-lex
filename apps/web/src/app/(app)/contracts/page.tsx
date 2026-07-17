import { ContractsHub, type HubContract } from "@/components/contracts/contracts-hub";
import type { ReceivablesData } from "@/components/receivables/receivables-client";
import { apiServer } from "@/lib/api";

function fmtMinor(minor: string, currency = "UZS"): string {
  const abs = BigInt(minor || "0");
  const major = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const frac = (abs % 100n).toString().padStart(2, "0");
  return `${major},${frac} ${currency}`;
}

/**
 * Shartnomalar markazi — platformaning ichki bo'limi (tashqi havola emas):
 * shartnomalar registri (qidiruv + filtr), namunalar, masofadan imzolash va
 * to'lov jadvali. Registr ilovaning o'z ma'lumotlaridan (receivables) quriladi.
 */
export default async function ContractsPage() {
  const res = await apiServer<ReceivablesData>("/api/receivables?page=1&sort=overdue");
  const contracts: HubContract[] = (res.data?.items ?? []).map((r) => {
    const overdueDays = Number(r.overdueDays ?? 0);
    return {
      id: r.id,
      number: r.contractNumber || r.invoiceNumber || "—",
      contractor: r.contractorName,
      tin: r.contractorTin,
      amount: fmtMinor((BigInt(r.outstanding.minor) + BigInt(r.penalty.minor)).toString(), r.currency),
      overdueDays,
      status: overdueDays > 0 ? "overdue" : "active",
    };
  });

  return <ContractsHub contracts={contracts} />;
}
