"use client";

import { ArrowRight, CheckCircle, Eye, EyeSlash, FileText, Gauge, Gavel, type Icon, Robot, ShieldCheck, Sparkle } from "@phosphor-icons/react";
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

export default function LoginPage() {
  const t = useTranslations("login");
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
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
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
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-blue-50 via-white to-blue-100 text-slate-900">
      {/* Yumshoq ko'k gradient blob'lar */}
      <div className="pointer-events-none absolute -left-40 -top-40 size-[420px] rounded-full bg-blue-300/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 top-40 size-[360px] rounded-full bg-indigo-300/40 blur-3xl" />

      {/* Suzuvchi navbar (testora uslubi) */}
      <header className="relative z-20 mx-auto mt-4 flex w-[min(1100px,92%)] items-center justify-between rounded-2xl border border-white/70 bg-white/80 px-4 py-2.5 shadow-lg shadow-blue-900/5 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-md shadow-blue-500/30">
            <Sparkle weight="fill" className="size-5 text-white" />
          </div>
          <span className="font-display text-[17px] font-bold tracking-tight">{tApp("name")}</span>
        </div>
        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
          {FEATURES.slice(0, 3).map((f) => (
            <span key={f.key} className="cursor-default transition-colors hover:text-slate-900">
              {t(`feat.${f.key}` as never)}
            </span>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
        </div>
      </header>

      {/* Hero + login */}
      <div className="relative z-10 mx-auto grid w-[min(1100px,92%)] items-center gap-10 py-14 lg:grid-cols-[1.05fr_420px] lg:py-20">
        {/* Chap: marketing */}
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

          <div className="mt-8 inline-flex items-center gap-2 text-sm text-slate-500">
            <CheckCircle weight="fill" className="size-4 text-blue-600" /> {t("liveActivity")}
          </div>
        </div>

        {/* O'ng: login karta */}
        <div className="mx-auto w-full max-w-[420px] rounded-3xl border border-white/80 bg-white/90 p-7 shadow-2xl shadow-blue-900/10 backdrop-blur">
          <div className="mb-6">
            <h2 className="font-display text-2xl font-bold tracking-tight">{t("title")}</h2>
            <p className="mt-1.5 text-sm text-slate-500">{t("subtitle")}</p>
          </div>

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-slate-600">
                {t("email")}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => errors.email && validate()}
                className={cn(field, errors.email && "border-red-400 focus:border-red-400 focus:ring-red-400/10")}
              />
              {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-slate-600">
                {t("password")}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder={t("passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => errors.password && validate()}
                  className={cn(field, "pr-12", errors.password && "border-red-400 focus:border-red-400 focus:ring-red-400/10")}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition-colors hover:text-slate-600"
                  title={show ? t("hidePassword") : t("showPassword")}
                >
                  {show ? <EyeSlash className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
            </div>

            {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? t("signingIn") : t("submit")}
              {!loading && <ArrowRight weight="bold" className="size-4" />}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-slate-400">{t("trust")}</p>
        </div>
      </div>
    </div>
  );
}
