import type { ReceivablesData } from "@/components/receivables/receivables-client";
import { ScoringClient, type ScoringInput } from "@/components/scoring/scoring-client";
import { apiServer } from "@/lib/api";

/**
 * Mijoz skoringi — qarzdorning ichki xatti-harakati bo'yicha kredit balli
 * (to'lov intizomi, qarz yuki, undiruv tarixi). ABBOT uslubidagi skorkart;
 * tashqi manbalar (KATM, MyID, INPS) keyin ulanadi.
 */
export default async function ScoringPage() {
  const res = await apiServer<ReceivablesData>("/api/receivables?page=1&sort=overdue");
  const clients: ScoringInput[] = (res.data?.items ?? []).map((r) => ({
    id: r.id,
    name: r.contractorName,
    tin: r.contractorTin,
    invoiceNumber: r.invoiceNumber,
    overdueDays: r.overdueDays,
    outstandingMinor: r.outstanding.minor,
    invoiceMinor: r.invoiceAmount.minor,
    reminderCount: r.reminderCount,
  }));
  return <ScoringClient clients={clients} />;
}
