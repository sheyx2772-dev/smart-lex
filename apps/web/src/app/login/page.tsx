"use client";

import {
  ArrowRight,
  Buildings,
  CheckCircle,
  Eye,
  EyeSlash,
  FileText,
  Gauge,
  Gavel,
  type Icon,
  Lightning,
  Quotes,
  Robot,
  ShieldCheck,
  Sparkle,
  Star,
  Truck,
  UploadSimple,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FEATURES: { key: string; icon: Icon }[] = [
  { key: "agent", icon: Robot },
  { key: "didox", icon: FileText },
  { key: "court", icon: Gavel },
  { key: "scoring", icon: Gauge },
  { key: "eimzo", icon: ShieldCheck },
];
const STEPS: { key: string; icon: Icon }[] = [
  { key: "s1", icon: UploadSimple },
  { key: "s2", icon: Robot },
  { key: "s3", icon: FileText },
  { key: "s4", icon: Gavel },
];
const CARDS: { key: string; icon: Icon }[] = [
  { key: "agent", icon: Robot },
  { key: "studio", icon: FileText },
  { key: "didox", icon: FileText },
  { key: "court", icon: Gavel },
  { key: "enforcement", icon: Truck },
  { key: "scoring", icon: Gauge },
];
const PLANS = ["starter", "standard", "pro"] as const;
const REVIEWS = ["r1", "r2", "r3"] as const;

export default function LoginPage() {
  const t = useTranslations("login");
  const l = useTranslations("landing");
  const tApp = useTranslations("app");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validate(): boolean {
    const next: { email?: string; password?: string } = {};
    if (!email.trim()) next.email = t("emailRequired");
    else if (!EMAIL_RE.test(email)) next.email = t("emailInvalid");
    if (!password) next.password = t("passwordRequired");
    else if (password.length < 6) next.password = t("passwordShort");
    setErrors(next);
    return Object.keys(next).length === 0;
  }
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setLoading(true);
    const res = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const data = await res.json();
    if (data.success) {
      router.push("/agent");
      router.refresh();
    } else {
      setError(data.message ?? t("error"));
      setLoading(false);
    }
  }
  function toLogin() {
    document.getElementById("kirish")?.scrollIntoView({ behavior: "smooth" });
  }

  const field =
    "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10";

  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-slate-900">
      {/* ── Navbar ─────────────────────────────── */}
      <header className="sticky top-4 z-30 mx-auto flex w-[min(1120px,92%)] items-center justify-between rounded-2xl border border-white/70 bg-white/85 px-4 py-2.5 shadow-lg shadow-blue-900/5 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-md shadow-blue-500/30">
            <Sparkle weight="fill" className="size-5 text-white" />
          </div>
          <span className="font-display text-[17px] font-bold tracking-tight">{tApp("name")}</span>
        </div>
        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
          <a href="#imkoniyatlar" className="transition-colors hover:text-slate-900">{l("navFeatures")}</a>
          <a href="#qanday" className="transition-colors hover:text-slate-900">{l("navHow")}</a>
          <a href="#narxlar" className="transition-colors hover:text-slate-900">{l("navPricing")}</a>
        </nav>
        <div className="flex items-center gap-2.5">
          <LocaleSwitcher />
          <button onClick={toLogin} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition-colors hover:bg-blue-700">
            {t("submit")}
          </button>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-blue-50 via-white to-white" />
        <div className="pointer-events-none absolute -left-40 -top-20 -z-10 size-[440px] rounded-full bg-blue-300/40 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 top-32 -z-10 size-[380px] rounded-full bg-indigo-300/40 blur-3xl" />
        <div id="kirish" className="mx-auto grid w-[min(1120px,92%)] items-center gap-10 py-16 lg:grid-cols-[1.05fr_420px] lg:py-24">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-3 py-1 text-xs font-medium text-blue-700 shadow-sm">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-500 opacity-70" />
                <span className="relative inline-flex size-2 rounded-full bg-blue-500" />
              </span>
              {t("trustBadge")}
            </div>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              {t("heroTitle1")}
              <br />
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{t("heroTitle2")}</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-slate-500 lg:mx-0">{t("heroDesc")}</p>
            <div className="mt-7 flex flex-wrap justify-center gap-2.5 lg:justify-start">
              {FEATURES.map((f) => {
                const Ic = f.icon;
                return (
                  <span key={f.key} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm">
                    <Ic weight="fill" className="size-3.5 text-blue-600" /> {t(`feat.${f.key}` as never)}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Login karta */}
          <div className="mx-auto w-full max-w-[420px] rounded-3xl border border-white/80 bg-white/95 p-7 shadow-2xl shadow-blue-900/10 backdrop-blur">
            <div className="mb-6">
              <h2 className="font-display text-2xl font-bold tracking-tight">{t("title")}</h2>
              <p className="mt-1.5 text-sm text-slate-500">{t("subtitle")}</p>
            </div>
            <form onSubmit={onSubmit} noValidate className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium text-slate-600">{t("email")}</label>
                <input id="email" type="email" autoComplete="email" placeholder={t("emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => errors.email && validate()} className={cn(field, errors.email && "border-red-400")} />
                {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium text-slate-600">{t("password")}</label>
                <div className="relative">
                  <input id="password" type={show ? "text" : "password"} autoComplete="current-password" placeholder={t("passwordPlaceholder")} value={password} onChange={(e) => setPassword(e.target.value)} onBlur={() => errors.password && validate()} className={cn(field, "pr-12", errors.password && "border-red-400")} />
                  <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:text-slate-600" title={show ? t("hidePassword") : t("showPassword")}>
                    {show ? <EyeSlash className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
              </div>
              {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>}
              <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 disabled:opacity-60">
                {loading ? t("signingIn") : t("submit")}
                {!loading && <ArrowRight weight="bold" className="size-4" />}
              </button>
            </form>
          </div>
        </div>

        {/* Stat strip */}
        <div className="mx-auto grid w-[min(1120px,92%)] grid-cols-2 gap-4 pb-16 sm:grid-cols-4">
          {(["stat1", "stat2", "stat3", "stat4"] as const).map((k) => (
            <div key={k} className="rounded-2xl border border-slate-100 bg-white p-5 text-center shadow-sm">
              <p className="font-display text-3xl font-extrabold text-blue-600">{l(`${k}v` as never)}</p>
              <p className="mt-1 text-xs text-slate-500">{l(`${k}l` as never)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Qanday ishlaydi ─────────────────────── */}
      <section id="qanday" className="bg-slate-50 py-20">
        <div className="mx-auto w-[min(1120px,92%)]">
          <Head kicker={l("howKicker")} title={l("howTitle")} desc={l("howDesc")} />
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => {
              const Ic = s.icon;
              return (
                <div key={s.key} className="relative rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                  <span className="absolute right-5 top-5 font-display text-3xl font-extrabold text-blue-100">{i + 1}</span>
                  <span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-600"><Ic weight="fill" className="size-6" /></span>
                  <h3 className="mt-4 font-display text-lg font-semibold">{l(`${s.key}t` as never)}</h3>
                  <p className="mt-1.5 text-sm text-slate-500">{l(`${s.key}d` as never)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Imkoniyatlar ───────────────────────── */}
      <section id="imkoniyatlar" className="py-20">
        <div className="mx-auto w-[min(1120px,92%)]">
          <Head kicker={l("featKicker")} title={l("featTitle")} desc={l("featDesc")} />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CARDS.map((c) => {
              const Ic = c.icon;
              return (
                <div key={c.key} className="group rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/5">
                  <span className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/30"><Ic weight="fill" className="size-6" /></span>
                  <h3 className="mt-4 font-display text-lg font-semibold">{l(`card.${c.key}.t` as never)}</h3>
                  <p className="mt-1.5 text-sm text-slate-500">{l(`card.${c.key}.d` as never)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Sharhlar ───────────────────────────── */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto w-[min(1120px,92%)]">
          <Head kicker={l("revKicker")} title={l("revTitle")} desc={l("revDesc")} />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {REVIEWS.map((r) => (
              <div key={r} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                <Quotes weight="fill" className="size-7 text-blue-200" />
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{l(`${r}text` as never)}</p>
                <div className="mt-4 flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-full bg-blue-100 font-display font-bold text-blue-700">{l(`${r}name` as never).slice(0, 1)}</span>
                  <div>
                    <p className="text-sm font-semibold">{l(`${r}name` as never)}</p>
                    <p className="text-xs text-slate-500">{l(`${r}role` as never)}</p>
                  </div>
                  <div className="ml-auto flex gap-0.5 text-amber-400">
                    {[0, 1, 2, 3, 4].map((i) => <Star key={i} weight="fill" className="size-3.5" />)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Narxlar ────────────────────────────── */}
      <section id="narxlar" className="py-20">
        <div className="mx-auto w-[min(1120px,92%)]">
          <Head kicker={l("priceKicker")} title={l("priceTitle")} desc={l("priceDesc")} />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {PLANS.map((p) => {
              const featured = p === "standard";
              return (
                <div key={p} className={cn("relative rounded-2xl border p-7 shadow-sm", featured ? "border-blue-500 bg-blue-600 text-white shadow-xl shadow-blue-600/20" : "border-slate-100 bg-white")}>
                  {featured && <span className="absolute right-5 top-5 rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium">{l("popular")}</span>}
                  <p className={cn("text-sm font-semibold", featured ? "text-blue-100" : "text-blue-600")}>{l(`plan.${p}.name` as never)}</p>
                  <p className="mt-3 font-display text-3xl font-extrabold">{l(`plan.${p}.price` as never)}</p>
                  <p className={cn("mt-1 text-xs", featured ? "text-blue-100" : "text-slate-500")}>{l(`plan.${p}.per` as never)}</p>
                  <ul className="mt-5 space-y-2.5 text-sm">
                    {[0, 1, 2, 3].map((i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle weight="fill" className={cn("mt-0.5 size-4 shrink-0", featured ? "text-white" : "text-blue-600")} /> {l(`plan.${p}.f${i}` as never)}
                      </li>
                    ))}
                  </ul>
                  <button onClick={toLogin} className={cn("mt-6 w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors", featured ? "bg-white text-blue-700 hover:bg-blue-50" : "bg-blue-600 text-white hover:bg-blue-700")}>
                    {l("choose")}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Yakuniy CTA ────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto w-[min(1120px,92%)]">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 px-8 py-14 text-center text-white shadow-xl shadow-blue-600/20">
            <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-white/10 blur-2xl" />
            <Lightning weight="fill" className="mx-auto size-9" />
            <h2 className="mt-4 font-display text-3xl font-extrabold sm:text-4xl">{l("ctaTitle")}</h2>
            <p className="mx-auto mt-3 max-w-xl text-blue-100">{l("ctaDesc")}</p>
            <button onClick={toLogin} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-[15px] font-semibold text-blue-700 shadow-lg transition-transform hover:scale-[1.03]">
              {t("submit")} <ArrowRight weight="bold" className="size-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────── */}
      <footer className="border-t border-slate-100 py-10">
        <div className="mx-auto flex w-[min(1120px,92%)] flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600"><Sparkle weight="fill" className="size-4 text-white" /></div>
            <span className="font-display font-bold">{tApp("name")}</span>
          </div>
          <p className="text-xs text-slate-400">{l("footer")}</p>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Buildings className="size-3.5" /> Multi-tenant · RLS · E-IMZO
          </div>
        </div>
      </footer>
    </div>
  );
}

function Head({ kicker, title, desc }: { kicker: string; title: string; desc: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">{kicker}</p>
      <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h2>
      <p className="mt-3 text-[15px] text-slate-500">{desc}</p>
    </div>
  );
}
