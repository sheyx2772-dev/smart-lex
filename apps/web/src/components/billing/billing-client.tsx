"use client";

import { Bank, CheckCircle, CircleNotch, CreditCard, Lightning } from "@phosphor-icons/react";
import { useState } from "react";
import { createClickPayment } from "@/app/(app)/billing/actions";

export interface Sub {
  plan: string | null;
  status: "none" | "trial" | "active" | "expired";
  until: string | null;
  trialUntil: string | null;
}

const PLANS = [
  { name: "Boshlang'ich", price: 1_000_000, features: ["Hujjat tuzish + AI tahlil", "SMS eslatma", "Debitorlik nazorati"] },
  { name: "Standart", price: 2_500_000, features: ["Boshlang'ich hammasi", "Sudga topshirish", "Didox rasmiy yuborish"], popular: true },
  { name: "Professional", price: 5_000_000, features: ["Standart hammasi", "Cheksiz hujjat", "Ustuvor qo'llab-quvvatlash"] },
];

const fmtSum = (n: number) => new Intl.NumberFormat("uz-UZ").format(n) + " so'm";
const fmtDate = (d: string | null) => (d ? new Intl.DateTimeFormat("uz-UZ", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(d)) : "—");

const STATUS: Record<string, { label: string; cls: string }> = {
  none: { label: "Obuna yo'q", cls: "bg-muted text-muted-foreground" },
  trial: { label: "Bepul sinov", cls: "bg-amber-500/15 text-amber-600" },
  active: { label: "Faol obuna", cls: "bg-emerald-500/15 text-emerald-600" },
  expired: { label: "Muddati tugagan", cls: "bg-red-500/15 text-red-500" },
};

export function BillingClient({ subscription, tenant }: { subscription: Sub; tenant: { name: string; tin: string } | null }) {
  const [busy, setBusy] = useState<string | null>(null);
  const st = STATUS[subscription.status] ?? STATUS.none;
  const activeUntil = subscription.status === "active" ? subscription.until : subscription.status === "trial" ? subscription.trialUntil : null;

  async function payClick(plan: string) {
    setBusy(plan);
    const res = await createClickPayment(plan, 1);
    if (res.ok && res.url) {
      window.location.href = res.url;
    } else {
      setBusy(null);
      alert(res.error === "not_configured" ? "Click hozircha sozlanmagan" : "To'lovni boshlab bo'lmadi");
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Obuna va to'lov</h1>
        <p className="mt-1 text-sm text-muted-foreground">Tarifni tanlang va onlayn (Click) yoki bank o'tkazmasi orqali to'lang.</p>
      </div>

      {/* Joriy holat */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Joriy holat</p>
          <div className="mt-1 flex items-center gap-2">
            <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-sm font-semibold ${st.cls}`}>{st.label}</span>
            {subscription.plan && <span className="text-sm font-medium">{subscription.plan}</span>}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{subscription.status === "trial" ? "Sinov tugaydi" : "Amal qiladi"}</p>
          <p className="mt-1 font-display text-lg font-semibold">{fmtDate(activeUntil)}</p>
        </div>
      </div>

      {/* Tariflar */}
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => (
          <div key={p.name} className={`relative flex flex-col rounded-2xl border bg-card p-5 ${p.popular ? "border-primary shadow-lg shadow-primary/10" : "border-border"}`}>
            {p.popular && <span className="absolute -top-2.5 left-5 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">Ommabop</span>}
            <h3 className="font-display text-lg font-semibold">{p.name}</h3>
            <p className="mt-1 font-display text-2xl font-bold">
              {fmtSum(p.price)}
              <span className="text-sm font-normal text-muted-foreground">/oy</span>
            </p>
            <ul className="mt-3 flex-1 space-y-1.5">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle weight="fill" className="mt-0.5 size-4 shrink-0 text-emerald-500" /> {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => payClick(p.name)}
              disabled={busy !== null}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02] disabled:opacity-60"
            >
              {busy === p.name ? <CircleNotch className="size-4 animate-spin" /> : <Lightning weight="fill" className="size-4" />}
              Click orqali to'lash
            </button>
          </div>
        ))}
      </div>

      {/* Bank o'tkazma */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-primary-soft text-primary"><Bank weight="fill" className="size-5" /></span>
          <div>
            <h3 className="font-display text-base font-semibold">Bank o'tkazmasi orqali to'lov</h3>
            <p className="text-xs text-muted-foreground">To'lov topshiriqnomasida firmangiz nomini ({tenant?.name ?? "firma"}) ko'rsating.</p>
          </div>
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Row k="Qabul qiluvchi" v="«MC LEGAL» yuridik firmasi" />
          <Row k="STIR" v="312559000" />
          <Row k="H/r" v="20212000507346035001" mono />
          <Row k="MFO" v="00423" mono />
          <Row k="Bank" v="ATIB «Ipoteka-bank» Mehnat filiali" />
          <Row k="To'lov maqsadi" v="LEX.AI obuna to'lovi" />
        </dl>
        <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <CreditCard className="size-4" /> O'tkazma amalga oshgach, obuna administrator tomonidan tasdiqlanadi (odatda 1 ish kuni ichida).
        </p>
      </div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/50 py-1.5">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={mono ? "font-mono text-xs font-medium" : "text-right font-medium"}>{v}</dd>
    </div>
  );
}
