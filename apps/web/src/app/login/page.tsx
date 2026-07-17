"use client";

import { ArrowRight, CaretLeft, Eye, EyeSlash, Sparkle } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
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
    <div className="relative min-h-screen bg-white text-slate-900">
      {/* Orqaga */}
      <button
        onClick={() => router.back()}
        className="absolute left-5 top-5 grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
        aria-label="back"
      >
        <CaretLeft weight="bold" className="size-5" />
      </button>
      <div className="absolute right-5 top-5">
        <LocaleSwitcher />
      </div>

      <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col justify-center px-6 py-16">
        {/* Logo */}
        <div className="mx-auto grid size-[84px] place-items-center rounded-[22px] bg-gradient-to-br from-blue-500 to-blue-600 shadow-xl shadow-blue-500/30">
          <Sparkle weight="fill" className="size-11 text-white" />
        </div>

        {/* Sarlavha */}
        <h1 className="mt-6 text-center text-5xl font-extrabold tracking-tight">{t("title")}</h1>
        <p className="mx-auto mt-3 max-w-[340px] text-center text-[15px] leading-relaxed text-slate-500">{t("subtitle")}</p>

        {/* Forma */}
        <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
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

        {/* Havolalar */}
        <div className="mt-6 flex items-center justify-center gap-1.5 text-sm">
          <span className="text-slate-400">{t("trust")}</span>
        </div>
      </div>
    </div>
  );
}
