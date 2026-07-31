"use client";

import { Bank, CaretRight, CheckCircle, CircleNotch, ShieldCheck, X } from "@phosphor-icons/react";
import { useState } from "react";
import { createClickPayment, createPaymePayment } from "@/app/(app)/billing/actions";

export interface Sub {
  plan: string | null;
  status: "none" | "trial" | "active" | "expired";
  until: string | null;
  trialUntil: string | null;
}
interface Plan {
  name: string;
  price: number;
  features: string[];
  popular?: boolean;
}

const PLANS: Plan[] = [
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

/** Click brendli logo (inline SVG). */
function ClickLogo() {
  return (
    <span className="inline-flex items-center gap-1.5 font-bold">
      <span className="grid size-6 place-items-center rounded-md bg-white/20 text-[13px]">C</span>
      Click
    </span>
  );
}
function PaymeLogo() {
  return (
    <span className="inline-flex items-center gap-1.5 font-bold">
      <span className="grid size-6 place-items-center rounded-md bg-white/20 text-[13px]">P</span>
      Payme
    </span>
  );
}

export function BillingClient({ subscription, tenant }: { subscription: Sub; tenant: { name: string; tin: string } | null }) {
  const [checkout, setCheckout] = useState<Plan | null>(null);
  const [busy, setBusy] = useState<"click" | "payme" | null>(null);
  const [showBank, setShowBank] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const st = STATUS[subscription.status] ?? STATUS.none;
  const activeUntil = subscription.status === "active" ? subscription.until : subscription.status === "trial" ? subscription.trialUntil : null;

  function openCheckout(p: Plan) {
    setCheckout(p);
    setShowBank(false);
    setErr(null);
    setBusy(null);
  }
  async function pay(provider: "click" | "payme") {
    if (!checkout || busy) return;
    setBusy(provider);
    setErr(null);
    const res = provider === "click" ? await createClickPayment(checkout.name, 1) : await createPaymePayment(checkout.name, 1);
    if (res.ok && res.url) {
      window.location.href = res.url;
    } else {
      setBusy(null);
      setErr(res.error === "not_configured" ? `${provider === "click" ? "Click" : "Payme"} hozircha sozlanmagan` : "To'lovni boshlab bo'lmadi");
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Obuna va to'lov</h1>
        <p className="mt-1 text-sm text-muted-foreground">Tarifni tanlang — keyin to'lov usulini (Click, Payme yoki bank o'tkazma) tanlaysiz.</p>
      </div>

      {/* Joriy holat */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary-soft/50 via-card to-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Joriy holat</p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-sm font-semibold ${st.cls}`}>{st.label}</span>
              {subscription.plan && <span className="text-sm font-medium">{subscription.plan}</span>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{subscription.status === "trial" ? "Sinov tugaydi" : "Amal qiladi"}</p>
            <p className="mt-1 font-display text-lg font-semibold">{fmtDate(activeUntil)}</p>
          </div>
        </div>
      </div>

      {/* Tariflar */}
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => (
          <div key={p.name} className={`relative flex flex-col rounded-2xl border bg-card p-5 transition-shadow hover:shadow-lg ${p.popular ? "border-primary shadow-md shadow-primary/10" : "border-border"}`}>
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
              onClick={() => openCheckout(p)}
              className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-transform hover:scale-[1.02] ${p.popular ? "bg-primary text-primary-foreground" : "border border-border bg-background hover:border-primary/40"}`}
            >
              Tanlash <CaretRight weight="bold" className="size-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Checkout modal — to'lov usulini tanlash */}
      {checkout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !busy && setCheckout(null)}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold">To'lov usuli</h3>
                <p className="text-sm text-muted-foreground">
                  {checkout.name} · <span className="font-semibold text-foreground">{fmtSum(checkout.price)}/oy</span>
                </p>
              </div>
              <button onClick={() => setCheckout(null)} disabled={busy !== null} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-50">
                <X className="size-4" />
              </button>
            </div>

            {!showBank ? (
              <div className="space-y-2.5">
                {/* Click */}
                <button
                  onClick={() => pay("click")}
                  disabled={busy !== null}
                  className="flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-white transition-transform hover:scale-[1.01] disabled:opacity-60"
                  style={{ background: "linear-gradient(90deg,#0F86D6,#26A9F0)" }}
                >
                  <ClickLogo />
                  {busy === "click" ? <CircleNotch className="size-5 animate-spin" /> : <CaretRight weight="bold" className="size-5" />}
                </button>
                {/* Payme */}
                <button
                  onClick={() => pay("payme")}
                  disabled={busy !== null}
                  className="flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-white transition-transform hover:scale-[1.01] disabled:opacity-60"
                  style={{ background: "linear-gradient(90deg,#00B8A9,#2CD4C4)" }}
                >
                  <PaymeLogo />
                  {busy === "payme" ? <CircleNotch className="size-5 animate-spin" /> : <CaretRight weight="bold" className="size-5" />}
                </button>
                {/* Bank */}
                <button
                  onClick={() => setShowBank(true)}
                  disabled={busy !== null}
                  className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-3.5 font-semibold transition-colors hover:border-primary/40 disabled:opacity-60"
                >
                  <span className="inline-flex items-center gap-2">
                    <Bank weight="fill" className="size-5 text-primary" /> Bank o'tkazmasi
                  </span>
                  <CaretRight weight="bold" className="size-5 text-muted-foreground" />
                </button>
                {err && <p className="pt-1 text-center text-xs text-red-500">{err}</p>}
                <p className="pt-1 text-center text-[11px] text-muted-foreground">To'lov xavfsiz — Click/Payme rasmiy sahifasida amalga oshiriladi.</p>
              </div>
            ) : (
              <div>
                <button onClick={() => setShowBank(false)} className="mb-3 text-xs font-medium text-primary hover:underline">← usullarga qaytish</button>
                <dl className="space-y-1.5 rounded-xl border border-border bg-muted/20 p-4 text-sm">
                  <Row k="Qabul qiluvchi" v="«MC LEGAL» yuridik firmasi" />
                  <Row k="STIR" v="312559000" />
                  <Row k="H/r" v="20212000507346035001" mono />
                  <Row k="MFO" v="00423" mono />
                  <Row k="Bank" v="ATIB «Ipoteka-bank» Mehnat filiali" />
                  <Row k="Summa" v={fmtSum(checkout.price)} />
                  <Row k="To'lov maqsadi" v={`LEX.AI obuna — ${tenant?.name ?? "firma"}`} />
                </dl>
                <p className="mt-3 text-[11px] text-muted-foreground">O'tkazmadan so'ng obuna administrator tomonidan tasdiqlanadi (1 ish kuni ichida). To'lov maqsadida firma nomingizni ko'rsating.</p>
              </div>
            )}
          </div>
        </div>
      )}

      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck weight="fill" className="size-4 text-emerald-500" /> To'lovlar «MC LEGAL» firmasi hisobiga o'tkaziladi.
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
