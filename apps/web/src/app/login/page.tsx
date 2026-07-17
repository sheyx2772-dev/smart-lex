"use client";

import {
  ArrowRight,
  Brain,
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
  SealCheck,
  ShieldCheck,
  ShieldWarning,
  Sparkle,
  Star,
  TrendUp,
  Truck,
  UploadSimple,
  X,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  const rootRef = useRef<HTMLDivElement>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    const els = rootRef.current?.querySelectorAll("[data-reveal]");
    if (!els?.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) e.target.classList.add("in");
      },
      { threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const openLogin = () => setLoginOpen(true);

  return (
    <div ref={rootRef} className="relative min-h-screen overflow-hidden bg-white text-slate-900">
      <style>{`
        @keyframes lxAurora {0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(40px,-30px) scale(1.15)}66%{transform:translate(-30px,20px) scale(.92)}}
        @keyframes lxFloat {0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
        @keyframes lxMarquee {from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes lxIn {from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}
        [data-reveal]{opacity:0;transform:translateY(26px);transition:opacity .7s ease,transform .7s ease}
        [data-reveal].in{opacity:1;transform:none}
        .lx-aurora{animation:lxAurora 16s ease-in-out infinite}
        .lx-float{animation:lxFloat 6s ease-in-out infinite}
        .lx-marquee{animation:lxMarquee 26s linear infinite}
        .lx-in{animation:lxIn .3s ease}
      `}</style>

      {/* ── Navbar ─────────────────────────────── */}
      <header className="sticky top-4 z-30 mx-auto flex w-[min(1120px,92%)] items-center justify-between rounded-2xl border border-white/70 bg-white/80 px-4 py-2.5 shadow-lg shadow-blue-900/5 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-500/30">
            <Sparkle weight="fill" className="size-5 text-white" />
          </div>
          <span className="font-display text-[17px] font-bold tracking-tight">{tApp("name")}</span>
        </div>
        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
          <a href="#imkoniyatlar" className="transition-colors hover:text-blue-600">{l("navFeatures")}</a>
          <a href="#qanday" className="transition-colors hover:text-blue-600">{l("navHow")}</a>
          <a href="#narxlar" className="transition-colors hover:text-blue-600">{l("navPricing")}</a>
        </nav>
        <div className="flex items-center gap-2.5">
          <LocaleSwitcher />
          <button onClick={openLogin} className="rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition-transform hover:scale-105">
            {t("submit")}
          </button>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-blue-50/80 via-white to-white" />
        <div className="lx-aurora pointer-events-none absolute -left-40 -top-24 -z-10 size-[460px] rounded-full bg-blue-400/30 blur-3xl" />
        <div className="lx-aurora pointer-events-none absolute -right-36 top-24 -z-10 size-[420px] rounded-full bg-indigo-400/30 blur-3xl" style={{ animationDelay: "-6s" }} />
        <div className="lx-aurora pointer-events-none absolute bottom-0 left-1/3 -z-10 size-[380px] rounded-full bg-sky-400/20 blur-3xl" style={{ animationDelay: "-11s" }} />
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(#1e293b 1px,transparent 1px),linear-gradient(90deg,#1e293b 1px,transparent 1px)", backgroundSize: "44px 44px" }} />

        <div className="mx-auto grid w-[min(1120px,92%)] items-center gap-10 py-16 lg:grid-cols-[1.05fr_460px] lg:py-24">
          <div data-reveal className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-3 py-1 text-xs font-medium text-blue-700 shadow-sm backdrop-blur">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-500 opacity-70" />
                <span className="relative inline-flex size-2 rounded-full bg-blue-500" />
              </span>
              {t("trustBadge")}
            </div>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.04] tracking-tight sm:text-5xl lg:text-6xl">
              {t("heroTitle1")}
              <br />
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 bg-clip-text text-transparent">{t("heroTitle2")}</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-slate-500 lg:mx-0">{t("heroDesc")}</p>
            <div className="mt-7 flex flex-wrap justify-center gap-2.5 lg:justify-start">
              <button onClick={openLogin} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-transform hover:scale-[1.03]">
                {t("submit")} <ArrowRight weight="bold" className="size-4" />
              </button>
              <a href="#qanday" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-blue-300">
                {l("navHow")}
              </a>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-2 lg:justify-start">
              {FEATURES.map((f) => {
                const Ic = f.icon;
                return (
                  <span key={f.key} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm">
                    <Ic weight="fill" className="size-3.5 text-blue-600" /> {t(`feat.${f.key}` as never)}
                  </span>
                );
              })}
            </div>
          </div>

          {/* O'ng: app-preview mokap (login EMAS) */}
          <div className="relative" data-reveal>
            <AppPreview l={l} />
            <div className="lx-float absolute -left-6 top-10 z-10 hidden rounded-2xl border border-white/80 bg-white/95 px-3.5 py-2.5 shadow-xl shadow-blue-900/10 backdrop-blur lg:block">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600"><TrendUp weight="fill" className="size-4" /></span>
                <div><p className="text-xs font-semibold">{l("stat3v")}</p><p className="text-[10px] text-slate-400">{l("stat3l")}</p></div>
              </div>
            </div>
            <div className="lx-float absolute -bottom-5 -right-4 z-10 hidden rounded-2xl border border-white/80 bg-white/95 px-3.5 py-2.5 shadow-xl shadow-blue-900/10 backdrop-blur lg:block" style={{ animationDelay: "-3s" }}>
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-blue-50 text-blue-600"><SealCheck weight="fill" className="size-4" /></span>
                <div><p className="text-xs font-semibold">{l("s4t")}</p><p className="text-[10px] text-slate-400">{l("s4d")}</p></div>
              </div>
            </div>
          </div>
        </div>

        {/* Marquee — integratsiyalar */}
        <div className="relative border-y border-slate-100 bg-slate-50/70 py-4">
          <div className="flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
            <div className="lx-marquee flex shrink-0 items-center gap-10 pr-10">
              {[...FEATURES, ...FEATURES, ...FEATURES, ...FEATURES].map((f, i) => {
                const Ic = f.icon;
                return (
                  <span key={i} className="inline-flex items-center gap-2 whitespace-nowrap text-sm font-semibold text-slate-400">
                    <Ic weight="fill" className="size-4 text-blue-500" /> {t(`feat.${f.key}` as never)}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── Stat strip ─────────────────────────── */}
      <section className="py-16">
        <div data-reveal className="mx-auto grid w-[min(1120px,92%)] grid-cols-2 gap-4 sm:grid-cols-4">
          {(["stat1", "stat2", "stat3", "stat4"] as const).map((k) => (
            <div key={k} className="rounded-2xl border border-slate-100 bg-gradient-to-b from-white to-blue-50/40 p-6 text-center shadow-sm">
              <p className="font-display text-3xl font-extrabold text-blue-600">{l(`${k}v` as never)}</p>
              <p className="mt-1 text-xs text-slate-500">{l(`${k}l` as never)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Qanday ishlaydi ─────────────────────── */}
      <section id="qanday" className="bg-slate-50 py-20">
        <div className="mx-auto w-[min(1120px,92%)]">
          <div data-reveal><Head kicker={l("howKicker")} title={l("howTitle")} desc={l("howDesc")} /></div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => {
              const Ic = s.icon;
              return (
                <div key={s.key} data-reveal style={{ transitionDelay: `${i * 90}ms` }} className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                  <span className="absolute right-4 top-3 font-display text-5xl font-extrabold text-blue-50">{i + 1}</span>
                  <span className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/30"><Ic weight="fill" className="size-6" /></span>
                  <h3 className="relative mt-4 font-display text-lg font-semibold">{l(`${s.key}t` as never)}</h3>
                  <p className="relative mt-1.5 text-sm text-slate-500">{l(`${s.key}d` as never)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Imkoniyatlar ───────────────────────── */}
      <section id="imkoniyatlar" className="py-20">
        <div className="mx-auto w-[min(1120px,92%)]">
          <div data-reveal><Head kicker={l("featKicker")} title={l("featTitle")} desc={l("featDesc")} /></div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CARDS.map((c, i) => {
              const Ic = c.icon;
              return (
                <div key={c.key} data-reveal style={{ transitionDelay: `${(i % 3) * 90}ms` }} className="group relative rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1.5 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-500/10">
                  <span className="absolute inset-x-6 top-0 h-1 rounded-b-full bg-gradient-to-r from-blue-500 to-indigo-600 opacity-0 transition-opacity group-hover:opacity-100" />
                  <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 transition-transform group-hover:scale-110"><Ic weight="fill" className="size-6" /></span>
                  <h3 className="mt-4 font-display text-lg font-semibold">{l(`card.${c.key}.t` as never)}</h3>
                  <p className="mt-1.5 text-sm text-slate-500">{l(`card.${c.key}.d` as never)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Sharhlar ───────────────────────────── */}
      <section className="bg-gradient-to-b from-white to-blue-50/50 py-20">
        <div className="mx-auto w-[min(1120px,92%)]">
          <div data-reveal><Head kicker={l("revKicker")} title={l("revTitle")} desc={l("revDesc")} /></div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {REVIEWS.map((r, i) => (
              <div key={r} data-reveal style={{ transitionDelay: `${i * 90}ms` }} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                <Quotes weight="fill" className="size-8 text-blue-200" />
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{l(`${r}text` as never)}</p>
                <div className="mt-4 flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 font-display font-bold text-white">{l(`${r}name` as never).slice(0, 1)}</span>
                  <div>
                    <p className="text-sm font-semibold">{l(`${r}name` as never)}</p>
                    <p className="text-xs text-slate-500">{l(`${r}role` as never)}</p>
                  </div>
                  <div className="ml-auto flex gap-0.5 text-amber-400">{[0, 1, 2, 3, 4].map((s) => <Star key={s} weight="fill" className="size-3.5" />)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Narxlar ────────────────────────────── */}
      <section id="narxlar" className="py-20">
        <div className="mx-auto w-[min(1120px,92%)]">
          <div data-reveal><Head kicker={l("priceKicker")} title={l("priceTitle")} desc={l("priceDesc")} /></div>
          <div className="mt-12 grid items-start gap-5 md:grid-cols-3">
            {PLANS.map((p, i) => {
              const featured = p === "standard";
              return (
                <div key={p} data-reveal style={{ transitionDelay: `${i * 90}ms` }} className={cn("relative rounded-2xl border p-7 shadow-sm", featured ? "border-transparent bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-2xl shadow-blue-600/25 md:-translate-y-3" : "border-slate-100 bg-white")}>
                  {featured && <span className="absolute right-5 top-5 rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium">{l("popular")}</span>}
                  <p className={cn("text-sm font-semibold", featured ? "text-blue-100" : "text-blue-600")}>{l(`plan.${p}.name` as never)}</p>
                  <p className="mt-3 font-display text-3xl font-extrabold">{l(`plan.${p}.price` as never)}</p>
                  <p className={cn("mt-1 text-xs", featured ? "text-blue-100" : "text-slate-500")}>{l(`plan.${p}.per` as never)}</p>
                  <ul className="mt-5 space-y-2.5 text-sm">
                    {[0, 1, 2, 3].map((k) => (
                      <li key={k} className="flex items-start gap-2">
                        <CheckCircle weight="fill" className={cn("mt-0.5 size-4 shrink-0", featured ? "text-white" : "text-blue-600")} /> {l(`plan.${p}.f${k}` as never)}
                      </li>
                    ))}
                  </ul>
                  <button onClick={openLogin} className={cn("mt-6 w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors", featured ? "bg-white text-blue-700 hover:bg-blue-50" : "bg-blue-600 text-white hover:bg-blue-700")}>{l("choose")}</button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Yakuniy CTA ────────────────────────── */}
      <section className="py-20">
        <div data-reveal className="mx-auto w-[min(1120px,92%)]">
          <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 px-8 py-16 text-center text-white shadow-2xl shadow-blue-600/25">
            <div className="lx-aurora pointer-events-none absolute -right-16 -top-16 size-72 rounded-full bg-white/15 blur-2xl" />
            <div className="lx-aurora pointer-events-none absolute -bottom-20 -left-10 size-72 rounded-full bg-sky-300/20 blur-2xl" style={{ animationDelay: "-8s" }} />
            <Lightning weight="fill" className="lx-float mx-auto size-10" />
            <h2 className="mt-4 font-display text-3xl font-extrabold sm:text-4xl">{l("ctaTitle")}</h2>
            <p className="mx-auto mt-3 max-w-xl text-blue-100">{l("ctaDesc")}</p>
            <button onClick={openLogin} className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-[15px] font-semibold text-blue-700 shadow-lg transition-transform hover:scale-[1.04]">
              {t("submit")} <ArrowRight weight="bold" className="size-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────── */}
      <footer className="border-t border-slate-100 py-10">
        <div className="mx-auto flex w-[min(1120px,92%)] flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600"><Sparkle weight="fill" className="size-4 text-white" /></div>
            <span className="font-display font-bold">{tApp("name")}</span>
          </div>
          <p className="text-xs text-slate-400">{l("footer")}</p>
          <div className="flex items-center gap-1.5 text-xs text-slate-400"><Buildings className="size-3.5" /> Multi-tenant · RLS · E-IMZO</div>
        </div>
      </footer>

      {/* ── Login modal (Kirish bosilganda) ─────── */}
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
    </div>
  );
}

/** Hero'dagi mahsulot ko'rinishi (mokap) — original, testora nusxasi emas. */
function AppPreview({ l }: { l: ReturnType<typeof useTranslations> }) {
  const tiles = [
    { icon: Brain, tone: "text-blue-600 bg-blue-50", v: "3", k: l("stat2l") },
    { icon: ShieldWarning, tone: "text-amber-600 bg-amber-50", v: "2", k: l("s1t") },
    { icon: SealCheck, tone: "text-violet-600 bg-violet-50", v: "2", k: l("navFeatures") },
    { icon: TrendUp, tone: "text-emerald-600 bg-emerald-50", v: "0", k: l("stat3l") },
  ];
  return (
    <div className="relative mx-auto w-full max-w-[460px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-blue-900/15">
      <div className="pointer-events-none absolute -inset-px -z-10 rounded-3xl bg-gradient-to-br from-blue-400/40 to-indigo-500/40 blur-md" />
      {/* Oyna sarlavhasi */}
      <div className="flex items-center gap-2 px-4 py-3 text-white" style={{ background: "linear-gradient(135deg,#232a44,#1b2136)" }}>
        <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600"><Robot weight="fill" className="size-4" /></span>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-none">AI Agent</p>
          <p className="mt-0.5 text-[10px] text-white/50">ALFA TRADE MCHJ</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
          <span className="size-1.5 rounded-full bg-emerald-400" /> Faol
        </span>
      </div>
      {/* Kontent */}
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-2.5">
          {tiles.map((x, i) => {
            const Ic = x.icon;
            return (
              <div key={i} className="rounded-xl border border-slate-100 p-3">
                <span className={cn("grid size-7 place-items-center rounded-lg", x.tone)}><Ic weight="fill" className="size-4" /></span>
                <p className="mt-2 font-display text-xl font-bold">{x.v}</p>
                <p className="truncate text-[10px] text-slate-400">{x.k}</p>
              </div>
            );
          })}
        </div>
        <div className="rounded-xl border border-slate-100 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">GLOBAL SNAB MCHJ</p>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">Risk 63</span>
          </div>
          <div className="mt-2.5 space-y-1.5">
            {[72, 54, 40].map((w, i) => (
              <div key={i} className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600" style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Login — faqat "Kirish" bosilganda ochiladigan modal. */
function LoginModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("login");
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

  const field =
    "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="lx-in w-full max-w-[420px] rounded-3xl border border-white/80 bg-white p-7 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-500/30">
              <Sparkle weight="fill" className="size-5 text-white" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight">{t("title")}</h2>
              <p className="text-xs text-slate-500">{t("subtitle")}</p>
            </div>
          </div>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><X className="size-4" /></button>
        </div>

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="lm-email" className="text-sm font-medium text-slate-600">{t("email")}</label>
            <input id="lm-email" type="email" autoComplete="email" placeholder={t("emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => errors.email && validate()} className={cn(field, errors.email && "border-red-400")} />
            {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="lm-pw" className="text-sm font-medium text-slate-600">{t("password")}</label>
            <div className="relative">
              <input id="lm-pw" type={show ? "text" : "password"} autoComplete="current-password" placeholder={t("passwordPlaceholder")} value={password} onChange={(e) => setPassword(e.target.value)} onBlur={() => errors.password && validate()} className={cn(field, "pr-12", errors.password && "border-red-400")} />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:text-slate-600" title={show ? t("hidePassword") : t("showPassword")}>
                {show ? <EyeSlash className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
          </div>
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>}
          <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 px-4 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:shadow-xl disabled:opacity-60">
            {loading ? t("signingIn") : t("submit")}
            {!loading && <ArrowRight weight="bold" className="size-4" />}
          </button>
        </form>
      </div>
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
