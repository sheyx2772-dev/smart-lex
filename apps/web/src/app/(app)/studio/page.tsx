import { Suspense } from "react";
import type { ReceivablesData } from "@/components/receivables/receivables-client";
import { type Creditor, DocumentStudio, type StudioDebtor } from "@/components/studio/document-studio";
import { apiServer } from "@/lib/api";

function fmtMinor(minor: string, currency = "UZS"): string {
  const abs = BigInt(minor || "0");
  const major = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const frac = (abs % 100n).toString().padStart(2, "0");
  return `${major},${frac} ${currency}`;
}

interface SettingsResp {
  profile?: { fullName?: string } | null;
  company?: {
    name?: string;
    tin?: string;
    legalAddress?: string;
    bankAccount?: string;
    bankMfo?: string;
    phone?: string;
    settings?: { signatory?: { name?: string; position?: string }; city?: string } | null;
  } | null;
}

/**
 * Hujjat tayyorlash studiyasi. Qarzdorlar VA kreditor (firma) rekvizitlari uzatiladi —
 * hujjat ochilganda summalar, davlat boji, sana, rekvizitlar AVTOMATIK to'ladi
 * (foydalanuvchi matn ichidan [joy] qidirmaydi). Deterministik hisob — LLM'da emas.
 */
export default async function StudioPage() {
  const [recRes, setRes] = await Promise.all([
    apiServer<ReceivablesData>("/api/receivables?page=1&sort=overdue"),
    apiServer<SettingsResp>("/api/settings"),
  ]);

  const debtors: StudioDebtor[] = (recRes.data?.items ?? []).slice(0, 50).map((r) => {
    const totalMinor = BigInt(r.outstanding.minor) + BigInt(r.penalty.minor);
    const dutyMinor = (totalMinor * 2n) / 100n; // davlat boji — da'vo narxining 2% (qonuniy stavka)
    return {
      id: r.id,
      name: r.contractorName,
      tin: r.contractorTin,
      invoiceNumber: r.invoiceNumber,
      contractNumber: r.contractNumber ?? "",
      principal: r.outstanding.formatted,
      penalty: r.penalty.formatted,
      total: fmtMinor(totalMinor.toString(), r.currency),
      overdueDays: String(r.overdueDays),
      stateDuty: fmtMinor(dutyMinor.toString(), r.currency),
    };
  });

  const co = setRes.data?.company ?? null;
  const creditor: Creditor = {
    name: co?.name ?? "",
    tin: co?.tin ?? "",
    address: co?.legalAddress ?? "",
    bankAccount: co?.bankAccount ?? "",
    bankMfo: co?.bankMfo ?? "",
    phone: co?.phone ?? "",
    director: co?.settings?.signatory?.name || setRes.data?.profile?.fullName || "",
    city: co?.settings?.city ?? "",
  };

  return (
    <Suspense fallback={null}>
      <DocumentStudio debtors={debtors} creditor={creditor} />
    </Suspense>
  );
}
