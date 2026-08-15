"use client";

import { HandCoins } from "@phosphor-icons/react";
import type { PayablesData } from "@/app/(app)/payables/actions";

export function PayablesClient({ data }: { data: PayablesData }) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight">
            <HandCoins weight="fill" className="size-6 text-primary" /> Kreditorlik
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sizning boshqa tashkilotlarga qarzingiz — bu ro&apos;yxat faqat nazorat uchun, undiruv jarayoniga kirmaydi.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-right shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Jami kreditorlik</p>
          <p className="font-display text-xl font-bold tabular text-primary">{data.totalAmount || "0"}</p>
          <p className="text-xs text-muted-foreground">{data.total} ta hujjat</p>
        </div>
      </div>

      {data.items.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-muted-foreground">
          <HandCoins weight="fill" className="size-8" />
          <p className="text-sm">Hozircha kreditorlik yozuvi yo&apos;q.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Yetkazib beruvchi</th>
                <th className="px-4 py-3">STIR</th>
                <th className="px-4 py-3">Hujjat №</th>
                <th className="px-4 py-3">Sana</th>
                <th className="px-4 py-3 text-right">Summa</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{row.contractorName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.contractorTin}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.number}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(row.issuedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular">{row.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
