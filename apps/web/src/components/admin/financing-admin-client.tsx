"use client";

import { Buildings, CheckCircle, HandCoins } from "@phosphor-icons/react";
import { useState } from "react";
import { matchFinancingListing, type FinancingListingRow } from "@/app/(app)/admin/financing/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const fmt = (minor: string, cur: string) => new Intl.NumberFormat("uz-UZ").format(Number(minor) / 100) + " " + cur;
const pct = (bps: number | null) => (bps == null ? "—" : `${(bps / 100).toFixed(1)}%`);

export function FinancingAdminClient({ items }: { items: FinancingListingRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [partner, setPartner] = useState("");
  const [discount, setDiscount] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitMatch(item: FinancingListingRow, status: "matched" | "completed") {
    if (busy || !partner.trim()) return;
    setBusy(true);
    await matchFinancingListing(item.id, item.tenantId, {
      matchedPartnerName: partner.trim(),
      matchedDiscountBps: discount ? Math.round(Number(discount) * 100) : undefined,
      status,
    });
    setBusy(false);
    setOpenId(null);
    setPartner("");
    setDiscount("");
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight">
          <HandCoins weight="fill" className="size-6 text-primary" /> Factoring bozori (B2B)
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          B2B mijozlar ro'yxatga qo'ygan qarzlar — bank/NBKT (nobank kredit tashkiloti) hamkorlar bilan qo'lda moslashtiring. SmartLex talab huquqi yoki pulni o'ziga olmaydi; haqiqiy bitim (moliyalashtirish + talab tsessiyasi) platformadan tashqarida, xaridor bilan to'g'ridan-to'g'ri bo'ladi.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-muted-foreground">
          <HandCoins weight="fill" className="size-8" />
          <p className="text-sm">Hozircha bozorga qo'yilgan qarz yo'q.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                    <Buildings weight="fill" className="size-5" />
                  </div>
                  <div>
                    <p className="font-display text-base font-semibold">{item.contractorName}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.tenantName} {item.invoiceNumber ? `· ${item.invoiceNumber}` : ""}
                    </p>
                  </div>
                </div>
                <Badge tone={item.status === "listed" ? "primary" : "success"}>{item.status}</Badge>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <p className="text-[11px] text-muted-foreground">Summa</p>
                  <p className="tabular text-sm font-semibold">{fmt(item.amountMinor, item.currency)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Risk-skor</p>
                  <p className="tabular text-sm font-semibold">{item.riskScoreAtListing}/100</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Taklif etilgan</p>
                  <p className="tabular text-sm font-semibold">{pct(item.suggestedDiscountBps)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Mijoz so'ragan</p>
                  <p className="tabular text-sm font-semibold">{pct(item.requestedDiscountBps)}</p>
                </div>
              </div>

              {item.matchedPartnerName ? (
                <p className="mt-4 flex items-center gap-1.5 text-sm text-success">
                  <CheckCircle weight="fill" className="size-4" /> {item.matchedPartnerName} — {pct(item.matchedDiscountBps)}
                </p>
              ) : openId === item.id ? (
                <div className="mt-4 space-y-2.5 border-t border-border pt-4">
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <Input placeholder="Bank/NBKT nomi" value={partner} onChange={(e) => setPartner(e.target.value)} autoFocus />
                    <Input placeholder="Kelishilgan chegirma, % (ixtiyoriy)" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => submitMatch(item, "matched")} disabled={busy || !partner.trim()}>
                      {busy ? "..." : "Moslashtirildi deb belgilash"}
                    </Button>
                    <Button variant="outline" onClick={() => setOpenId(null)} disabled={busy}>
                      Bekor qilish
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" onClick={() => setOpenId(item.id)} className="mt-4">
                  Xaridor bilan moslashtirish
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
