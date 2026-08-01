"use client";

import { Bank, CalendarBlank, CheckCircle, CircleNotch, Handshake, ShieldCheck, Warning } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { negotiateDebt, type NegotiationOffer } from "@/app/pay/[id]/actions";

export interface DebtData {
  creditor: { name: string; tin: string; bankAccount: string | null; bankMfo: string | null };
  debtorName: string;
  invoiceNumber: string;
  principalMinor: string;
  penaltyMinor: string;
  currency: string;
  overdueDays: number;
  status: string;
}

const fmt = (minor: string, cur: string) => new Intl.NumberFormat("uz-UZ").format(Number(minor) / 100) + " " + (cur === "UZS" ? "so'm" : cur);

export function DebtorPortal({ id, data }: { id: string; data: DebtData | null }) {
  const [offer, setOffer] = useState<NegotiationOffer | null>(null);
  const [busy, start] = useTransition();

  if (!data) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
        <Warning weight="fill" className="size-12 text-amber-500" />
        <h1 className="font-display text-xl font-bold">Qarz topilmadi</h1>
        <p className="text-sm text-muted-foreground">Havola eskirgan yoki noto'g'ri bo'lishi mumkin. Iltimos, firmага murojaat qiling.</p>
      </div>
    );
  }

  const total = (Number(data.principalMinor) + Number(data.penaltyMinor)).toString();
  function negotiate(type: "installment" | "settlement") {
    start(async () => setOffer(await negotiateDebt(id, type)));
  }

  return (
    <div className="mx-auto min-h-screen max-w-md space-y-4 p-4 sm:py-8">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
          <ShieldCheck weight="fill" className="size-3.5 text-emerald-500" /> Rasmiy to'lov sahifasi
        </span>
        <h1 className="mt-3 font-display text-lg font-bold">{data.creditor.name}</h1>
        <p className="text-sm text-muted-foreground">STIR {data.creditor.tin}</p>
      </div>

      {/* Debt card */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-red-500/10 via-card to-card p-6 text-center">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Sizning qarzingiz</p>
        <p className="mt-1 font-display text-3xl font-extrabold">{fmt(total, data.currency)}</p>
        <div className="mt-3 flex justify-center gap-4 text-xs text-muted-foreground">
          <span>Asosiy: {fmt(data.principalMinor, data.currency)}</span>
          {Number(data.penaltyMinor) > 0 && <span>Penya: {fmt(data.penaltyMinor, data.currency)}</span>}
        </div>
        {data.overdueDays > 0 && (
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-red-500/15 px-2.5 py-1 text-xs font-semibold text-red-500">
            <CalendarBlank weight="fill" className="size-3.5" /> {data.overdueDays} kun kechikkan
          </span>
        )}
        {data.invoiceNumber && <p className="mt-2 text-[11px] text-muted-foreground">Hisob-faktura № {data.invoiceNumber}</p>}
      </div>

      {/* Bank details */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Bank weight="fill" className="size-4 text-primary" /> To'lov rekvizitlari
        </div>
        <dl className="space-y-1 text-sm">
          <Row k="Qabul qiluvchi" v={data.creditor.name} />
          <Row k="STIR" v={data.creditor.tin} />
          {data.creditor.bankAccount && <Row k="Hisob raqam" v={data.creditor.bankAccount} mono />}
          {data.creditor.bankMfo && <Row k="MFO" v={data.creditor.bankMfo} mono />}
          <Row k="To'lov maqsadi" v={`${data.invoiceNumber || "qarz"} bo'yicha to'lov`} />
        </dl>
      </div>

      {/* AI negotiation */}
      <div className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-4">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
          <Handshake weight="fill" className="size-4 text-primary" /> To'lashga qiynalyapsizmi?
        </div>
        <p className="mb-3 text-xs text-muted-foreground">AI yordamchi siz uchun to'lov yechimini taklif qiladi.</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => negotiate("installment")}
            disabled={busy}
            className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-semibold transition-colors hover:border-primary/50 disabled:opacity-60"
          >
            Bo'lib to'lash
          </button>
          <button
            onClick={() => negotiate("settlement")}
            disabled={busy}
            className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-semibold transition-colors hover:border-primary/50 disabled:opacity-60"
          >
            Kelishuv (chegirma)
          </button>
        </div>

        {busy && (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <CircleNotch className="size-4 animate-spin" /> AI taklif tayyorlamoqda…
          </p>
        )}
        {offer && !busy && (
          <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
              <CheckCircle weight="fill" className="size-4" /> Taklif tayyor
            </div>
            <p className="mt-1 text-sm">{offer.text}</p>
            {offer.schedule && (
              <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                {offer.schedule.map((s) => (
                  <li key={s.month}>
                    {s.month}-oy: {new Intl.NumberFormat("uz-UZ").format(s.amount)} so'm
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">Bu taklif firmага yuborildi. Rasmiylashtirish uchun yuqoridagi rekvizitlar bo'yicha to'lang yoki firma bilan bog'laning.</p>
          </div>
        )}
      </div>

      <p className="flex items-center justify-center gap-1.5 pt-2 text-center text-[11px] text-muted-foreground">
        <ShieldCheck weight="fill" className="size-3.5 text-emerald-500" /> LEX.AI orqali himoyalangan
      </p>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/40 py-1 last:border-0">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={mono ? "font-mono text-xs font-medium" : "text-right font-medium"}>{v}</dd>
    </div>
  );
}
