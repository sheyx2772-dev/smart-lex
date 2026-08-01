"use client";

import { Bank, CaretRight, CheckCircle, CircleNotch, Crown, Lightning, LockKey, SealCheck, ShieldCheck, Sparkle, X } from "@phosphor-icons/react";
import { useState } from "react";
import { createClickPayment, createPaymePayment } from "@/app/(app)/billing/actions";
import { CardScheme, ClickLogo, PaymeLogo } from "./logos";

export interface Sub {
  plan: string | null;
  status: "none" | "trial" | "active" | "expired";
  until: string | null;
  trialUntil: string | null;
}
interface Plan {
  name: string;
  price: number;
  tagline: string;
  features: string[];
  popular?: boolean;
  Icon: typeof Lightning;
}

const PLANS: Plan[] = [
  { name: "Boshlang'ich", price: 1_000_000, tagline: "Yakka amaliyot uchun", Icon: Lightning, features: ["Hujjat tuzish + AI tahlil", "SMS eslatma", "Debitorlik nazorati"] },
  { name: "Standart", price: 2_500_000, tagline: "O'sayotgan firmalar uchun", Icon: Sparkle, popular: true, features: ["Boshlang'ich hammasi", "Sudga topshirish", "Didox orqali rasmiy yuborish"] },
  { name: "Professional", price: 5_000_000, tagline: "Yuqori yuklamali jamoalar", Icon: Crown, features: ["Standart hammasi", "Cheksiz hujjat", "Ustuvor qo'llab-quvvatlash"] },
];

const fmtSum = (n: number) => new Intl.NumberFormat("uz-UZ").format(n) + " so'm";
const fmtDate = (d: string | null) => (d ? new Intl.DateTimeFormat("uz-UZ", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(d)) : "—");
const daysLeft = (d: string | null) => (d ? Math.max(0, Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000)) : 0);
const STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  none: { label: "Obuna yo'q", cls: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
  trial: { label: "Bepul sinov", cls: "bg-amber-500/15 text-amber-600", dot: "bg-amber-500" },
  active: { label: "Faol obuna", cls: "bg-emerald-500/15 text-emerald-600", dot: "bg-emerald-500" },
  expired: { label: "Muddati tugagan", cls: "bg-red-500/15 text-red-500", dot: "bg-red-500" },
};

export function BillingClient({ subscription, tenant }: { subscription: Sub; tenant: { name: string; tin: string } | null }) {
  const [checkout, setCheckout] = useState<Plan | null>(null);
  const [busy, setBusy] = useState<"click" | "payme" | null>(null);
  const [showBank, setShowBank] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const st = STATUS[subscription.status] ?? STATUS.none;
  const activeUntil = subscription.status === "active" ? subscription.until : subscription.status === "trial" ? subscription.trialUntil : null;
  const left = daysLeft(activeUntil);

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
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-10">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/12 via-card to-card p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 size-48 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkle weight="fill" className="size-3.5" /> LEX.AI obuna
            </span>
            <h1 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">Kuchli imkoniyatlarni oching</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">Tarifni tanlang — so'ng to'lovni Click, Payme yoki bank o'tkazmasi orqali xavfsiz amalga oshiring.</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card/70 px-3.5 py-2.5 backdrop-blur">
            <ShieldCheck weight="fill" className="size-5 text-emerald-500" />
            <div className="leading-tight">
              <p className="text-xs font-semibold">SSL himoyalangan</p>
              <p className="text-[11px] text-muted-foreground">Rasmiy to'lov shlyuzi</p>
            </div>
          </div>
        </div>

        {/* Joriy holat */}
        <div className="relative mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card/80 p-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className={`grid size-11 place-items-center rounded-xl ${st.cls}`}>
              <span className={`size-2.5 rounded-full ${st.dot}`} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center rounded-lg px-2.5 py-0.5 text-sm font-semibold ${st.cls}`}>{st.label}</span>
                {subscription.plan && <span className="text-sm font-medium">{subscription.plan}</span>}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {subscription.status === "trial" ? "Bepul sinov muddati" : subscription.status === "active" ? "Obuna amal qiladi" : subscription.status === "expired" ? "Obunani yangilang" : "Faollashtirish uchun tarif tanlang"}
              </p>
            </div>
          </div>
          {activeUntil && (
            <div className="text-right">
              <p className="font-display text-lg font-bold">{fmtDate(activeUntil)}</p>
              <p className="text-xs text-muted-foreground">{left} kun qoldi</p>
            </div>
          )}
        </div>
      </div>

      {/* Tariflar */}
      <div className="grid items-stretch gap-4 md:grid-cols-3">
        {PLANS.map((p) => {
          const isCur = subscription.plan === p.name && (subscription.status === "active" || subscription.status === "trial");
          return (
            <div
              key={p.name}
              className={`relative flex flex-col rounded-3xl border p-6 transition-all hover:-translate-y-0.5 ${
                p.popular ? "border-primary/60 bg-gradient-to-b from-primary/10 to-card shadow-xl shadow-primary/10 md:-my-1 md:scale-[1.015]" : "border-border bg-card hover:shadow-lg"
              }`}
            >
              {p.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-primary-foreground shadow-md">
                  <Crown weight="fill" className="size-3.5" /> Eng ommabop
                </span>
              )}
              <div className="flex items-center gap-2.5">
                <span className={`grid size-10 place-items-center rounded-xl ${p.popular ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                  <p.Icon weight="fill" className="size-5" />
                </span>
                <div>
                  <h3 className="font-display text-base font-bold leading-tight">{p.name}</h3>
                  <p className="text-[11px] text-muted-foreground">{p.tagline}</p>
                </div>
              </div>

              <div className="mt-5">
                <span className="font-display text-3xl font-extrabold tracking-tight">{new Intl.NumberFormat("uz-UZ").format(p.price)}</span>
                <span className="ml-1 text-sm text-muted-foreground">so'm/oy</span>
              </div>

              <ul className="mt-5 flex-1 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircle weight="fill" className={`mt-0.5 size-4 shrink-0 ${p.popular ? "text-primary" : "text-emerald-500"}`} /> <span className="text-foreground/90">{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => openCheckout(p)}
                disabled={isCur}
                className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-all disabled:cursor-default disabled:opacity-60 ${
                  isCur ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-600" : p.popular ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:scale-[1.02]" : "border border-border bg-background hover:border-primary/50 hover:scale-[1.02]"
                }`}
              >
                {isCur ? (
                  <>
                    <SealCheck weight="fill" className="size-4" /> Joriy tarif
                  </>
                ) : (
                  <>
                    Tanlash <CaretRight weight="bold" className="size-4" />
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Ishonch banneri — qabul qilinadigan to'lov usullari */}
      <div className="rounded-3xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck weight="fill" className="size-5 text-emerald-500" />
            <div>
              <p className="text-sm font-semibold">Xavfsiz to'lov usullari</p>
              <p className="text-xs text-muted-foreground">To'lov O'zbekistonning rasmiy shlyuzlari orqali qabul qilinadi</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex h-9 items-center rounded-xl border border-border bg-white px-3 shadow-sm">
              <ClickLogo className="h-5 w-auto" variant="dark" />
            </span>
            <span className="inline-flex h-9 items-center rounded-xl border border-border bg-white px-3.5 shadow-sm">
              <PaymeLogo className="h-7 w-auto" />
            </span>
            <span className="mx-0.5 h-6 w-px bg-border" />
            <CardScheme name="UzCard" />
            <CardScheme name="Humo" />
            <CardScheme name="Visa" />
            <CardScheme name="Mastercard" />
          </div>
        </div>
      </div>

      {/* Checkout modal */}
      {checkout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => !busy && setCheckout(null)}>
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* modal header */}
            <div className="relative bg-gradient-to-br from-primary/15 to-card p-5">
              <button onClick={() => setCheckout(null)} disabled={busy !== null} className="absolute right-4 top-4 grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-50">
                <X className="size-4" />
              </button>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">To'lov · {checkout.name}</p>
              <p className="mt-1 font-display text-2xl font-extrabold">
                {fmtSum(checkout.price)}
                <span className="ml-1 text-sm font-normal text-muted-foreground">/oy</span>
              </p>
            </div>

            <div className="p-5">
              {!showBank ? (
                <div className="space-y-2.5">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">To'lov usulini tanlang</p>
                  {/* Click */}
                  <button
                    onClick={() => pay("click")}
                    disabled={busy !== null}
                    className="flex w-full items-center justify-between rounded-2xl border border-[#0065FF]/30 bg-white px-4 py-4 shadow-sm transition-all hover:border-[#0065FF] hover:shadow-md disabled:opacity-60"
                  >
                    <ClickLogo className="h-6 w-auto" variant="dark" />
                    <span className="grid size-8 place-items-center rounded-full bg-[#0065FF] text-white">
                      {busy === "click" ? <CircleNotch className="size-4 animate-spin" /> : <CaretRight weight="bold" className="size-4" />}
                    </span>
                  </button>
                  {/* Payme */}
                  <button
                    onClick={() => pay("payme")}
                    disabled={busy !== null}
                    className="flex w-full items-center justify-between rounded-2xl border border-[#00C0C9]/45 bg-white px-4 py-4 shadow-sm transition-all hover:border-[#00C0C9] hover:shadow-md disabled:opacity-60"
                  >
                    <PaymeLogo className="h-8 w-auto" />
                    <span className="grid size-8 place-items-center rounded-full text-white" style={{ background: "#00C0C9" }}>
                      {busy === "payme" ? <CircleNotch className="size-4 animate-spin" /> : <CaretRight weight="bold" className="size-4" />}
                    </span>
                  </button>
                  {/* Bank */}
                  <button
                    onClick={() => setShowBank(true)}
                    disabled={busy !== null}
                    className="flex w-full items-center justify-between rounded-2xl border border-border bg-background px-4 py-4 font-semibold transition-colors hover:border-primary/40 disabled:opacity-60"
                  >
                    <span className="inline-flex items-center gap-2.5">
                      <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
                        <Bank weight="fill" className="size-4" />
                      </span>
                      Bank o'tkazmasi
                    </span>
                    <CaretRight weight="bold" className="size-5 text-muted-foreground" />
                  </button>
                  {err && <p className="pt-1 text-center text-xs text-red-500">{err}</p>}
                  <div className="flex items-center justify-center gap-1.5 pt-2 text-[11px] text-muted-foreground">
                    <LockKey weight="fill" className="size-3.5 text-emerald-500" /> To'lov Click/Payme rasmiy himoyalangan sahifasida amalga oshiriladi
                  </div>
                </div>
              ) : (
                <div>
                  <button onClick={() => setShowBank(false)} className="mb-3 text-xs font-medium text-primary hover:underline">← usullarga qaytish</button>
                  <dl className="space-y-1.5 rounded-2xl border border-border bg-muted/20 p-4 text-sm">
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
