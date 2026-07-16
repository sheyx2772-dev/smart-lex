import { Suspense } from "react";
import type { ReceivablesData } from "@/components/receivables/receivables-client";
import { DocumentStudio, type StudioDebtor } from "@/components/studio/document-studio";
import { apiServer } from "@/lib/api";

function fmtMinor(minor: string, currency = "UZS"): string {
  const abs = BigInt(minor || "0");
  const major = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const frac = (abs % 100n).toString().padStart(2, "0");
  return `${major},${frac} ${currency}`;
}

/**
 * Hujjat tayyorlash studiyasi — Tuzuk.ai uslubidagi ikki panelli ish maydoni:
 * chapda hujjat muharriri, o'ngda AI yordamchi. ?template=<key> — boshqa
 * bo'limlardan kerakli shablonni ochish uchun. Qarzdorlar ro'yxati shablonni
 * avtomatik to'ldirish uchun uzatiladi (qo'lda tahrir ham saqlanadi).
 */
export default async function StudioPage() {
  const res = await apiServer<ReceivablesData>("/api/receivables?page=1&sort=overdue");
  const debtors: StudioDebtor[] = (res.data?.items ?? []).slice(0, 50).map((r) => ({
    id: r.id,
    name: r.contractorName,
    tin: r.contractorTin,
    invoiceNumber: r.invoiceNumber,
    contractNumber: r.contractNumber ?? "",
    principal: r.outstanding.formatted,
    penalty: r.penalty.formatted,
    total: fmtMinor((BigInt(r.outstanding.minor) + BigInt(r.penalty.minor)).toString(), r.currency),
    overdueDays: String(r.overdueDays),
  }));

  return (
    <Suspense fallback={null}>
      <DocumentStudio debtors={debtors} />
    </Suspense>
  );
}
