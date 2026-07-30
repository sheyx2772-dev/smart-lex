"use client";

import {
  ArrowRight,
  ArrowUpRight,
  Buildings,
  CheckCircle,
  Eye,
  EyeSlash,
  FileText,
  Gauge,
  Gavel,
  type Icon,
  Lightning,
  List,
  Plus,
  Quotes,
  Robot,
  ShieldCheck,
  Sparkle,
  Star,
  Truck,
  User,
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
const STEPS = ["s1", "s2", "s3", "s4"] as const;
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
const MARQUEE = ["DIDOX", "E-SUD", "E-IMZO", "TUZUK", "HYBRID POST", "TRUSTCONTRACT"];

export default function LoginPage() {
  const t = useTranslations("login");
  const l = useTranslations("landing");
  const tApp = useTranslations("app");
  const rootRef = useRef<HTMLDivElement>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [progress, setProgress] = useState(0);

  // Scroll'da yo'qolib-paydo bo'lish (ikki tomonlama) + progress chizig'i
  useEffect(() => {
    const els = rootRef.current?.querySelectorAll("[data-reveal]");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) e.target.classList.toggle("in", e.isIntersecting);
      },
      { threshold: 0.15 },
    );
    els?.forEach((el) => io.observe(el));

    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? window.scrollY / max : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // One-ID callback xato bilan qaytarsa (?oneid_error=...) — login oynasini ochamiz.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("oneid_error")) setLoginOpen(true);
  }, []);

  const openLogin = () => {
    setMenuOpen(false);
    setLoginOpen(true);
  };

  return (
    <div ref={rootRef} className="relative min-h-screen overflow-hidden bg-black text-white antialiased selection:bg-white selection:text-black">
      <style>{`
        @keyframes lxMarquee {from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes lxMarqueeR {from{transform:translateX(-50%)}to{transform:translateX(0)}}
        @keyframes lxIn {from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}
        @keyframes lxWave {0%,100%{transform:translateX(0)}50%{transform:translateX(-30px)}}
        @keyframes lxDot {0%,100%{opacity:.35;transform:scale(.8)}50%{opacity:1;transform:scale(1.25)}}
        @keyframes lxDrift {0%,100%{transform:translate(0,0)}33%{transform:translate(5vw,-4vh)}66%{transform:translate(-4vw,4vh)}}
        @keyframes lxFloatY {0%,100%{transform:translateY(0)}50%{transform:translateY(-16px)}}
        @keyframes lxSpin {to{transform:rotate(360deg)}}
        [data-reveal]{opacity:0;transform:translateY(50px) scale(.965);filter:blur(14px);transition:opacity .9s cubic-bezier(.16,.84,.24,1),transform .9s cubic-bezier(.16,.84,.24,1),filter .9s cubic-bezier(.16,.84,.24,1);will-change:opacity,transform,filter}
        [data-reveal="left"]{transform:translateX(-64px)}
        [data-reveal="right"]{transform:translateX(64px)}
        [data-reveal].in{opacity:1;transform:none;filter:blur(0)}
        .lx-marquee{animation:lxMarquee 30s linear infinite}
        .lx-marquee-r{animation:lxMarqueeR 46s linear infinite}
        .lx-in{animation:lxIn .3s ease}
        .lx-wave{animation:lxWave 10s ease-in-out infinite}
        .lx-dot{animation:lxDot 2.6s ease-in-out infinite}
        .lx-drift{animation:lxDrift 26s ease-in-out infinite}
        .lx-floaty{animation:lxFloatY 5s ease-in-out infinite}
        .lx-cond{font-stretch:condensed;letter-spacing:-.02em}
        .lx-stroke{-webkit-text-stroke:1.5px rgba(255,255,255,.85);color:transparent}
        @media (min-width:1024px){.lx-stroke{-webkit-text-stroke-width:2px}}
        @media (prefers-reduced-motion:reduce){.lx-marquee,.lx-marquee-r,.lx-wave,.lx-dot,.lx-drift,.lx-floaty{animation:none}}
      `}</style>

      {/* Scroll progress chizig'i */}
      <div className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-white" style={{ transform: `scaleX(${progress})` }} />

      {/* Jonli fon: video (public/home-bg.mp4 bo'lsa) yoki oqadigan to'lqin */}
      <HeroBg />
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="lx-drift absolute -left-40 top-0 size-[540px] rounded-full bg-white/[0.06] blur-[130px]" />
        <div className="lx-drift absolute right-0 top-1/3 size-[460px] rounded-full bg-white/[0.05] blur-[130px]" style={{ animationDelay: "-8s" }} />
        <div className="lx-drift absolute bottom-0 left-1/3 size-[420px] rounded-full bg-white/[0.04] blur-[130px]" style={{ animationDelay: "-16s" }} />
        <div className="absolute inset-0 opacity-[0.045]" style={{ backgroundImage: "radial-gradient(#fff 1px,transparent 1px)", backgroundSize: "26px 26px" }} />
      </div>

      {/* ── Navbar ─────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-black/70 backdrop-blur-xl">
        <div className="mx-auto flex w-[min(1240px,92%)] items-center justify-between py-4">
          <a href="#" aria-label={tApp("name")}>
            <BrandMark name={tApp("name")} className="font-display text-2xl font-extrabold tracking-tight" />
          </a>
          <nav className="hidden items-center gap-9 text-xs font-semibold uppercase tracking-widest text-white/60 lg:flex">
            <a href="#jarayon" className="transition-colors hover:text-white">{l("navHow")}</a>
            <a href="#imkoniyatlar" className="transition-colors hover:text-white">{l("navFeatures")}</a>
            <a href="#narxlar" className="transition-colors hover:text-white">{l("navPricing")}</a>
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block"><LocaleSwitcher variant="ghost" /></div>
            <button onClick={openLogin} className="group inline-flex items-center gap-2 rounded-full py-1.5 pl-4 pr-1.5 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:text-white/70 sm:hidden">
              <User weight="bold" className="size-4" /> {t("submit")}
            </button>
            <button onClick={openLogin} className="group hidden items-center gap-2.5 rounded-full border border-white/30 py-1.5 pl-5 pr-1.5 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:border-white sm:inline-flex">
              {t("submit")}
              <span className="grid size-7 place-items-center rounded-full bg-white text-black transition-transform group-hover:translate-x-0.5">
                <ArrowRight weight="bold" className="size-3.5" />
              </span>
            </button>
            <button onClick={() => setMenuOpen((o) => !o)} className="grid size-10 place-items-center rounded-full border border-white/15 lg:hidden">
              {menuOpen ? <X weight="bold" className="size-5" /> : <List weight="bold" className="size-5" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="border-t border-white/10 bg-black px-[4%] py-5 lg:hidden">
            <nav className="flex flex-col gap-4 text-sm font-semibold uppercase tracking-widest text-white/70">
              <a href="#jarayon" onClick={() => setMenuOpen(false)}>{l("navHow")}</a>
              <a href="#imkoniyatlar" onClick={() => setMenuOpen(false)}>{l("navFeatures")}</a>
              <a href="#narxlar" onClick={() => setMenuOpen(false)}>{l("navPricing")}</a>
              <div className="pt-2"><LocaleSwitcher variant="ghost" /></div>
            </nav>
          </div>
        )}
      </header>

      {/* ── Hero ───────────────────────────────── */}
      <section className="relative z-10 overflow-hidden pt-28 lg:pt-40">
        {/* Monoxrom to'lqin grafika */}
        <svg className="lx-wave pointer-events-none absolute inset-x-0 top-20 -z-10 h-[420px] w-[110%] opacity-40" style={{ left: "-5%" }} viewBox="0 0 1440 420" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="lxg" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#fff" stopOpacity="0" />
              <stop offset="50%" stopColor="#fff" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 26, 52, 78, 104].map((o, i) => (
            <path key={i} fill="none" stroke="url(#lxg)" strokeWidth="1" d={`M0,${200 + o} C360,${120 + o} 720,${300 + o} 1080,${180 + o} S1440,${240 + o} 1440,${240 + o}`} opacity={1 - i * 0.14} />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-gradient-to-b from-white/[0.06] to-transparent" />
        {/* Suzuvchi dekor ikonlar */}
        <Sparkle weight="fill" className="lx-floaty pointer-events-none absolute right-[8%] top-40 -z-10 size-6 text-white/20" />
        <Plus weight="bold" className="lx-floaty pointer-events-none absolute left-[6%] top-72 -z-10 size-5 text-white/15" style={{ animationDelay: "-2s" }} />

        <div className="mx-auto w-[min(1240px,92%)]">
          <div data-reveal className="flex items-center gap-4">
            <span className="h-px w-12 bg-white/50" />
            <span className="text-[11px] font-bold uppercase tracking-[0.32em] text-white/60">{t("trustBadge")}</span>
          </div>

          <h1 data-reveal className="lx-cond mt-8 font-display font-extrabold uppercase leading-[0.86] tracking-tight text-white [text-shadow:0_2px_40px_rgba(0,0,0,0.55)]" style={{ fontSize: "clamp(2.75rem,10vw,8.5rem)" }}>
            <span className="block">{t("heroTitle1")}</span>
            <span className="block">{t("heroTitle2")}</span>
          </h1>

          <div className="mt-10 flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
            <p data-reveal className="max-w-xl text-base leading-relaxed text-white/55">{t("heroDesc")}</p>
            <div data-reveal className="flex flex-wrap items-center gap-3">
              <button onClick={openLogin} className="group inline-flex items-center gap-2.5 rounded-full bg-white px-7 py-4 text-sm font-bold uppercase tracking-widest text-black transition-transform hover:scale-[1.03]">
                {t("submit")} <ArrowUpRight weight="bold" className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </button>
              <a href="#jarayon" className="inline-flex items-center gap-2.5 rounded-full border border-white/20 px-7 py-4 text-sm font-bold uppercase tracking-widest text-white transition-colors hover:border-white/60">
                {l("navHow")}
              </a>
            </div>
          </div>

          {/* Integratsiya chiplari */}
          <div data-reveal className="mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-3 lg:grid-cols-5">
            {FEATURES.map((f, i) => {
              const Ic = f.icon;
              return (
                <div key={f.key} className="flex items-center gap-2.5 bg-black px-5 py-5 transition-colors hover:bg-white/[0.04]">
                  <Ic weight="light" className="lx-floaty size-5 text-white/70" style={{ animationDelay: `${i * 0.5}s` }} />
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/70">{t(`feat.${f.key}` as never)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Yirik marquee band — ikki qatlam */}
        <div className="mt-24 space-y-3 overflow-hidden border-y border-white/10 py-8">
          <div className="flex whitespace-nowrap">
            <div className="lx-marquee flex shrink-0 items-center">
              {[...MARQUEE, ...MARQUEE].map((w, i) => (
                <span key={i} className="lx-stroke lx-cond mx-8 font-display text-5xl font-extrabold uppercase tracking-tight sm:text-7xl">
                  {w}<span className="mx-8 align-middle text-white/25" style={{ WebkitTextStroke: "0" }}>◆</span>
                </span>
              ))}
            </div>
          </div>
          <div className="flex whitespace-nowrap">
            <div className="lx-marquee-r flex shrink-0 items-center">
              {[...MARQUEE, ...MARQUEE].map((w, i) => (
                <span key={i} className="lx-cond mx-8 font-display text-5xl font-extrabold uppercase tracking-tight text-white/[0.07] sm:text-7xl">
                  {w}<span className="mx-8 align-middle">◆</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Jarayon (01–04) ────────────────────── */}
      <section id="jarayon" className="relative z-10 bg-white py-24 text-black lg:py-32">
        <div className="mx-auto grid w-[min(1240px,92%)] gap-10 lg:grid-cols-[0.85fr_1.25fr] lg:gap-16">
          <div data-reveal className="lg:sticky lg:top-28 lg:self-start">
            <div className="flex items-center gap-4">
              <span className="lx-cond font-display text-2xl font-extrabold text-black/25">01</span>
              <span className="h-px w-10 bg-black/40" />
              <span className="text-[11px] font-bold uppercase tracking-[0.32em] text-black/60">{l("howKicker")}</span>
            </div>
            <h2 className="lx-cond mt-6 font-display font-extrabold uppercase leading-[0.92] tracking-tight" style={{ fontSize: "clamp(2rem,5vw,3.75rem)" }}>{l("howTitle")}</h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-black/55">{l("howDesc")}</p>
          </div>
          <div className="border-t border-black/10">
            {STEPS.map((s, i) => (
              <div key={s} data-reveal style={{ transitionDelay: `${i * 80}ms` }} className="group flex items-start gap-5 border-b border-black/10 py-8 transition-colors hover:bg-black/[0.03] md:gap-8 md:py-9">
                <span className="lx-cond font-display text-4xl font-extrabold text-black/15 transition-colors group-hover:text-black md:text-5xl">0{i + 1}</span>
                <div>
                  <h3 className="font-display text-xl font-bold uppercase tracking-tight md:text-2xl">{l(`${s}t` as never)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-black/55">{l(`${s}d` as never)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Imkoniyatlar ───────────────────────── */}
      <section id="imkoniyatlar" className="relative z-10 border-t border-white/10 bg-black py-24 lg:py-32">
        <div className="mx-auto w-[min(1240px,92%)]">
          <SectionHead index="02" kicker={l("featKicker")} title={l("featTitle")} desc={l("featDesc")} />
          <div className="mt-14 grid auto-rows-[210px] gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CARDS.map((c, i) => {
              const Ic = c.icon;
              const wide = i === 0;
              const tall = i === 3;
              return (
                <div
                  key={c.key}
                  data-reveal
                  style={{ transitionDelay: `${(i % 3) * 80}ms` }}
                  className={cn(
                    "group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/12 bg-black p-7 transition-colors hover:bg-white hover:text-black",
                    wide && "sm:col-span-2",
                    tall && "lg:row-span-2",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <Ic weight="light" className={cn("transition-transform group-hover:scale-110", tall ? "size-10" : "size-8")} />
                    <span className="lx-cond font-display text-2xl font-extrabold text-white/15 transition-colors group-hover:text-black/20">0{i + 1}</span>
                  </div>
                  <div>
                    <h3 className={cn("font-display font-bold uppercase tracking-tight", tall ? "text-2xl" : "text-xl")}>{l(`card.${c.key}.t` as never)}</h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-white/50 transition-colors group-hover:text-black/60">{l(`card.${c.key}.d` as never)}</p>
                    <ArrowUpRight weight="bold" className="mt-4 size-5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Statistika (sanab chiqadi) ─────────── */}
      <section className="relative z-10 bg-white py-20 text-black">
        <div className="mx-auto grid w-[min(1240px,92%)] grid-cols-2 gap-y-12 lg:grid-cols-4">
          {(["stat1", "stat2", "stat3", "stat4"] as const).map((k, i) => (
            <div key={k} data-reveal style={{ transitionDelay: `${i * 90}ms` }} className="border-l border-black/15 pl-6">
              <CountUp value={l(`${k}v` as never)} className="lx-cond block font-display text-5xl font-extrabold tracking-tight lg:text-6xl" />
              <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-black/50">{l(`${k}l` as never)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Sharhlar ───────────────────────────── */}
      <section className="relative z-10 border-t border-white/10 bg-black py-24 lg:py-32">
        <div className="mx-auto w-[min(1240px,92%)]">
          <SectionHead index="03" kicker={l("revKicker")} title={l("revTitle")} desc={l("revDesc")} />
          <div className="mt-14 grid gap-6 lg:grid-cols-2">
            {/* Katta featured sharh */}
            <div data-reveal="left" className="flex flex-col justify-between rounded-2xl border border-white/10 bg-black p-8 lg:p-10">
              <div>
                <Quotes weight="fill" className="size-10 text-white/25" />
                <p className="mt-6 font-display text-2xl font-semibold leading-snug lg:text-[28px]">{l("r1text")}</p>
              </div>
              <div className="mt-8 flex items-center gap-3 border-t border-white/10 pt-6">
                <span className="grid size-12 place-items-center rounded-full bg-white font-display font-extrabold text-black">{l("r1name").slice(0, 1)}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold uppercase tracking-wide">{l("r1name")}</p>
                  <p className="truncate text-xs text-white/45">{l("r1role")}</p>
                </div>
                <div className="ml-auto flex gap-0.5">{[0, 1, 2, 3, 4].map((s) => <Star key={s} weight="fill" className="size-3.5 text-white/80" />)}</div>
              </div>
            </div>
            {/* Ikkita kichik sharh */}
            <div className="grid gap-6">
              {(["r2", "r3"] as const).map((r, i) => (
                <div key={r} data-reveal="right" style={{ transitionDelay: `${i * 110}ms` }} className="flex flex-col justify-between rounded-2xl border border-white/10 bg-black p-8 transition-colors hover:border-white/30">
                  <p className="text-[15px] leading-relaxed text-white/80">{l(`${r}text` as never)}</p>
                  <div className="mt-6 flex items-center gap-3 border-t border-white/10 pt-5">
                    <span className="grid size-10 place-items-center rounded-full bg-white font-display font-extrabold text-black">{l(`${r}name` as never).slice(0, 1)}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold uppercase tracking-wide">{l(`${r}name` as never)}</p>
                      <p className="truncate text-xs text-white/45">{l(`${r}role` as never)}</p>
                    </div>
                    <div className="ml-auto flex gap-0.5">{[0, 1, 2, 3, 4].map((s) => <Star key={s} weight="fill" className="size-3 text-white/80" />)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Narxlar ────────────────────────────── */}
      <section id="narxlar" className="relative z-10 bg-white py-24 text-black lg:py-32">
        <div className="mx-auto w-[min(1240px,92%)]">
          <SectionHead index="04" kicker={l("priceKicker")} title={l("priceTitle")} desc={l("priceDesc")} tone="light" />
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {PLANS.map((p, i) => {
              const featured = p === "standard";
              return (
                <div key={p} data-reveal style={{ transitionDelay: `${i * 90}ms` }} className={cn("relative flex flex-col rounded-2xl border p-8 transition-transform hover:-translate-y-1", featured ? "border-black bg-black text-white md:-translate-y-3" : "border-black/12 bg-white")}>
                  {featured && <span className="absolute right-6 top-6 rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-black">{l("popular")}</span>}
                  <p className={cn("text-xs font-bold uppercase tracking-widest", featured ? "text-white/60" : "text-black/50")}>{l(`plan.${p}.name` as never)}</p>
                  <p className="lx-cond mt-5 font-display text-5xl font-extrabold tracking-tight">{l(`plan.${p}.price` as never)}</p>
                  <p className={cn("mt-1 text-xs", featured ? "text-white/50" : "text-black/40")}>{l(`plan.${p}.per` as never)}</p>
                  <ul className="mt-8 flex-1 space-y-3.5 text-sm">
                    {[0, 1, 2, 3].map((k) => (
                      <li key={k} className="flex items-start gap-3">
                        <CheckCircle weight="fill" className={cn("mt-0.5 size-4 shrink-0", featured ? "text-white" : "text-black")} />
                        <span className={featured ? "text-white/80" : "text-black/70"}>{l(`plan.${p}.f${k}` as never)}</span>
                      </li>
                    ))}
                  </ul>
                  <button onClick={openLogin} className={cn("mt-8 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-xs font-bold uppercase tracking-widest transition-transform hover:scale-[1.03]", featured ? "bg-white text-black" : "bg-black text-white")}>
                    {l("choose")} <ArrowRight weight="bold" className="size-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Yakuniy CTA ────────────────────────── */}
      <section className="relative z-10 overflow-hidden border-t border-white/10 bg-black py-28 lg:py-40">
        <div className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(#fff 1px,transparent 1px)", backgroundSize: "26px 26px" }} />
        <div data-reveal className="relative mx-auto w-[min(1240px,92%)] text-center">
          <Lightning weight="fill" className="lx-floaty mx-auto size-9 text-white/70" />
          <h2 className="lx-cond mx-auto mt-6 max-w-4xl font-display font-extrabold uppercase leading-[0.9] tracking-tight" style={{ fontSize: "clamp(2.25rem,7vw,5.5rem)" }}>
            {l("ctaTitle")}
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-base text-white/50">{l("ctaDesc")}</p>
          <button onClick={openLogin} className="group mt-10 inline-flex items-center gap-2.5 rounded-full bg-white px-9 py-4 text-sm font-bold uppercase tracking-widest text-black transition-transform hover:scale-[1.03]">
            {t("submit")} <ArrowUpRight weight="bold" className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/10 bg-black py-12">
        <div className="mx-auto flex w-[min(1240px,92%)] flex-col items-center justify-between gap-5 sm:flex-row">
          <a href="#" aria-label={tApp("name")}><BrandMark name={tApp("name")} className="font-display text-xl font-extrabold tracking-tight" /></a>
          <p className="text-xs uppercase tracking-widest text-white/35">{l("footer")}</p>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/35"><Buildings className="size-3.5" /> Multi-tenant · RLS · E-IMZO</div>
        </div>
      </footer>

      {/* ── Login modal ────────────────────────── */}
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
    </div>
  );
}

/**
 * Hero foni. Agar `public/home-bg.mp4` mavjud bo'lsa — video fon (qorong'i
 * qatlam bilan). Bo'lmasa — oqadigan to'lqin animatsiyasi (FlowField).
 * Faylni o'zingizning egaligingizdagi videodan `apps/web/public/home-bg.mp4`
 * ga joylashtiring; tashqi saytdan avtomatik yuklab olinmaydi.
 */
function HeroBg() {
  return <SmokeField />;
}

/** evnt.uz uslubidagi jonli fon: oqadigan tutun bulutlari + ipaksimon to'lqin chiziqlar. */
function SmokeField() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    let raf = 0;
    let w = 0;
    let h = 0;

    type Puff = { ax: number; ay: number; bx: number; by: number; r: number; sp: number; ph: number; al: number; drift: number };
    const puffs: Puff[] = [];

    function build() {
      puffs.length = 0;
      const N = 15;
      for (let i = 0; i < N; i++) {
        puffs.push({
          ax: 0.06 + Math.random() * 0.88,
          ay: 0.05 + Math.random() * 0.9,
          bx: 0.08 + Math.random() * 0.24,
          by: 0.06 + Math.random() * 0.18,
          r: 0.26 + Math.random() * 0.36,
          sp: 0.3 + Math.random() * 0.7,
          ph: Math.random() * Math.PI * 2,
          al: 0.13 + Math.random() * 0.17, // ancha ko'rinarli tutun
          drift: (0.02 + Math.random() * 0.05) * (Math.random() < 0.5 ? -1 : 1), // sekin oqim
        });
      }
    }

    function resize() {
      w = canvas!.clientWidth;
      h = canvas!.clientHeight;
      canvas!.width = Math.max(1, Math.floor(w * DPR));
      canvas!.height = Math.max(1, Math.floor(h * DPR));
      ctx!.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    function render(now: number, loop: boolean) {
      const t = now * 0.00016;
      ctx!.globalCompositeOperation = "source-over";
      ctx!.fillStyle = "#000";
      ctx!.fillRect(0, 0, w, h);
      const M = Math.max(w, h);

      // 1-qatlam: oqadigan tutun bulutlari
      ctx!.globalCompositeOperation = "lighter";
      for (const p of puffs) {
        const fx = ((p.ax + p.drift * t) % 1.2 + 1.2) % 1.2 - 0.1; // gorizontal oqim (wrap)
        const cx = (fx + Math.cos(t * p.sp + p.ph) * p.bx) * w;
        const cy = (p.ay + Math.sin(t * p.sp * 0.9 + p.ph * 1.3) * p.by) * h;
        const r = p.r * M * (0.9 + 0.14 * Math.sin(t * p.sp + p.ph));
        const g = ctx!.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, `rgba(255,255,255,${p.al})`);
        g.addColorStop(0.35, `rgba(218,222,234,${p.al * 0.5})`);
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx!.fillStyle = g;
        ctx!.beginPath();
        ctx!.arc(cx, cy, r, 0, Math.PI * 2);
        ctx!.fill();
      }

      // 2-qatlam: ipaksimon oqadigan to'lqin chiziqlar
      ctx!.globalCompositeOperation = "screen";
      const bands = 7;
      for (let b = 0; b < bands; b++) {
        const yBase = h * (0.14 + b * 0.11);
        const amp = h * (0.05 + (b % 3) * 0.025);
        const speed = 0.35 + b * 0.1;
        const grad = ctx!.createLinearGradient(0, 0, w, 0);
        const a = 0.11 - b * 0.008;
        grad.addColorStop(0, "rgba(255,255,255,0)");
        grad.addColorStop(0.5, `rgba(255,255,255,${a > 0 ? a : 0.02})`);
        grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx!.strokeStyle = grad;
        ctx!.lineWidth = 1.1;
        ctx!.beginPath();
        for (let x = 0; x <= w; x += 8) {
          const y =
            yBase +
            Math.sin(x * 0.0038 + t * speed + b) * amp +
            Math.sin(x * 0.011 - t * speed * 0.7 + b * 1.7) * amp * 0.4;
          if (x === 0) ctx!.moveTo(x, y);
          else ctx!.lineTo(x, y);
        }
        ctx!.stroke();
      }

      ctx!.globalCompositeOperation = "source-over";
      if (loop) raf = requestAnimationFrame((n) => render(n, true));
    }

    resize();
    build();
    if (reduce) render(0, false);
    else raf = requestAnimationFrame((n) => render(n, true));
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-100" aria-hidden />;
}

/** Reveal'da 0 dan qiymatgacha sanaydi (masalan "50 000+"). */
function CountUp({ value, className }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const m = value.match(/^(\D*?)([\d][\d\s]*\d|\d)(.*)$/s);
  const prefix = m?.[1] ?? "";
  const numRaw = m?.[2] ?? "";
  const suffix = m?.[3] ?? "";
  const target = Number.parseInt(numRaw.replace(/\s/g, ""), 10);
  const [txt, setTxt] = useState(Number.isNaN(target) ? value : `${prefix}0${suffix}`);

  useEffect(() => {
    const el = ref.current;
    if (!el || Number.isNaN(target)) return;
    let done = false;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !done) {
            done = true;
            const dur = 1200;
            const start = performance.now();
            const step = (now: number) => {
              const p = Math.min(1, (now - start) / dur);
              const eased = 1 - (1 - p) ** 3;
              if (p >= 1) setTxt(value);
              else {
                setTxt(`${prefix}${Math.round(target * eased)}${suffix}`);
                requestAnimationFrame(step);
              }
            };
            requestAnimationFrame(step);
          }
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [target, prefix, suffix, value]);

  return (
    <span ref={ref} className={className}>
      {txt}
    </span>
  );
}

/** Logotip — "SMARTLEX.AI": nomdagi oxirgi ".xxx" qismi urg'u rangida. */
function BrandMark({ name, className }: { name: string; className?: string }) {
  const b = name.toUpperCase();
  const i = b.lastIndexOf(".");
  return (
    <span className={className}>
      {i < 0 ? (
        b
      ) : (
        <>
          {b.slice(0, i)}
          <span className="text-white/45">{b.slice(i)}</span>
        </>
      )}
    </span>
  );
}

function SectionHead({ index, kicker, title, desc, tone = "dark" }: { index: string; kicker: string; title: string; desc: string; tone?: "dark" | "light" }) {
  const light = tone === "light";
  return (
    <div data-reveal className="max-w-3xl">
      <div className="flex items-center gap-4">
        <span className={cn("lx-cond font-display text-2xl font-extrabold", light ? "text-black/25" : "text-white/25")}>{index}</span>
        <span className={cn("h-px w-10", light ? "bg-black/40" : "bg-white/40")} />
        <span className={cn("text-[11px] font-bold uppercase tracking-[0.32em]", light ? "text-black/60" : "text-white/60")}>{kicker}</span>
      </div>
      <h2 className="lx-cond mt-6 font-display font-extrabold uppercase leading-[0.92] tracking-tight" style={{ fontSize: "clamp(2rem,5vw,3.75rem)" }}>{title}</h2>
      <p className={cn("mt-4 text-base leading-relaxed", light ? "text-black/55" : "text-white/50")}>{desc}</p>
    </div>
  );
}

/** Login — faqat "Kirish" bosilganda ochiladigan modal. */
function LoginModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("login");
  const tApp = useTranslations("app");
  const router = useRouter();
  const oneidError = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("oneid_error") : null;
  const KNOWN_ONEID_ERR = new Set(["not_configured", "invalid_state", "not_valid", "no_pin", "no_legal_entity", "tenant_not_registered", "user_not_found", "exchange_failed", "require_eri", "not_verified"]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(oneidError ? t(`oneid.err.${KNOWN_ONEID_ERR.has(oneidError) ? oneidError : "generic"}`) : null);
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
    "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-[15px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/60 focus:bg-white/10";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="lx-in w-full max-w-[420px] rounded-3xl border border-white/12 bg-[#0a0a0a] p-7 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-white text-black">
              <Sparkle weight="fill" className="size-5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-extrabold uppercase tracking-tight">{tApp("name")}</h2>
              <p className="text-xs text-white/45">{t("subtitle")}</p>
            </div>
          </div>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white"><X className="size-4" /></button>
        </div>

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="lm-email" className="text-xs font-semibold uppercase tracking-widest text-white/55">{t("email")}</label>
            <input id="lm-email" type="email" autoComplete="email" placeholder={t("emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => errors.email && validate()} className={cn(field, errors.email && "border-red-500/70")} />
            {errors.email && <p className="text-xs text-red-400">{errors.email}</p>}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="lm-pw" className="text-xs font-semibold uppercase tracking-widest text-white/55">{t("password")}</label>
            <div className="relative">
              <input id="lm-pw" type={show ? "text" : "password"} autoComplete="current-password" placeholder={t("passwordPlaceholder")} value={password} onChange={(e) => setPassword(e.target.value)} onBlur={() => errors.password && validate()} className={cn(field, "pr-12", errors.password && "border-red-500/70")} />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-white/40 hover:text-white" title={show ? t("hidePassword") : t("showPassword")}>
                {show ? <EyeSlash className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-400">{errors.password}</p>}
          </div>
          {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{error}</div>}
          <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3.5 text-sm font-bold uppercase tracking-widest text-black transition-transform hover:scale-[1.02] disabled:opacity-60">
            {loading ? t("signingIn") : t("submit")}
            {!loading && <ArrowRight weight="bold" className="size-4" />}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">
          <span className="h-px flex-1 bg-white/10" />
          {t("oneid.or")}
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <a href="/api/oneid" className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/15 bg-white/5 px-4 py-3.5 text-sm font-bold uppercase tracking-widest text-white transition-colors hover:border-white/50 hover:bg-white/10">
          <ShieldCheck weight="fill" className="size-5 text-emerald-400" />
          {t("oneid.button")}
        </a>
        <p className="mt-3 text-center text-[11px] leading-relaxed text-white/35">{t("oneid.hint")}</p>
      </div>
    </div>
  );
}
