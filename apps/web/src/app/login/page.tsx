"use client";

import { ArrowRight, Eye, EyeSlash, FileText, Gauge, Gavel, type Icon, Robot, ShieldCheck, Sparkle } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { NeuralBackground } from "@/components/ui/neural-background";
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

  const inputBase =
    "w-full rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-white/35 focus:border-primary/60 focus:bg-white/[0.08]";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#060912] text-white">
      {/* Neyron-tarmoq animatsion fon */}
      <NeuralBackground className="absolute inset-0 size-full" />
      {/* Gradient nur va to'r */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(50% 42% at 14% 10%, rgba(37,99,235,0.38), transparent 60%), radial-gradient(46% 40% at 86% 86%, rgba(124,58,237,0.34), transparent 60%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,.7) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.7) 1px,transparent 1px)",
          backgroundSize: "46px 46px",
        }}
      />

      <div className="absolute right-6 top-6 z-20">
        <LocaleSwitcher />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-10 px-6 py-14 lg:flex-row lg:justify-between">
        {/* Brand / hero */}
        <div className="max-w-md text-center lg:text-left">
          <div className="inline-flex items-center gap-2.5">
            <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-secondary shadow-lg shadow-primary/40 ring-1 ring-white/15">
              <Sparkle weight="fill" className="size-5" />
            </div>
            <span className="font-display text-lg font-semibold tracking-tight">{tApp("name")}</span>
          </div>

          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70 backdrop-blur">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-70" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
            {t("badge")}
          </div>

          <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
            {t("heroLine1")}
            <br />
            <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">{t("heroLine2")}</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-white/55 lg:mx-0">{t("heroDesc")}</p>

          <div className="mt-7 flex flex-wrap justify-center gap-2.5 lg:justify-start">
            {FEATURES.map((f) => {
              const Ic = f.icon;
              return (
                <span key={f.key} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-xs text-white/80 backdrop-blur">
                  <Ic weight="fill" className="size-3.5 text-violet-300" /> {t(`feat.${f.key}` as never)}
                </span>
              );
            })}
          </div>
        </div>

        {/* Glassmorphic login card */}
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-7 shadow-2xl shadow-black/50 backdrop-blur-xl">
            <div className="mb-6">
              <h2 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h2>
              <p className="mt-1.5 text-sm text-white/55">{t("subtitle")}</p>
            </div>

            <form onSubmit={onSubmit} noValidate className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-xs font-medium text-white/70">
                  {t("email")} <span className="text-danger">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder={t("emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => errors.email && validate()}
                  className={cn(inputBase, errors.email && "border-danger focus:border-danger")}
                />
                {errors.email && <p className="text-xs text-danger">{errors.email}</p>}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="text-xs font-medium text-white/70">
                  {t("password")} <span className="text-danger">*</span>
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
                    className={cn(inputBase, "pr-11", errors.password && "border-danger focus:border-danger")}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-white/50 transition-colors hover:text-white"
                    title={show ? t("hidePassword") : t("showPassword")}
                  >
                    {show ? <EyeSlash className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-danger">{errors.password}</p>}
              </div>

              {error && <div className="rounded-xl border border-danger/40 bg-danger/15 px-3 py-2 text-sm text-red-200">{error}</div>}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-secondary px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/40 transition-all hover:shadow-xl hover:shadow-primary/50 disabled:opacity-60"
              >
                {loading ? t("signingIn") : t("submit")}
                {!loading && <ArrowRight weight="bold" className="size-4" />}
              </button>
            </form>
          </div>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-white/35">
            <ShieldCheck className="size-3.5" /> {t("trust")}
          </p>
        </div>
      </div>
    </div>
  );
}
