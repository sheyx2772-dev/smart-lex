"use client";

import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const t = useTranslations("login");
  const tApp = useTranslations("app");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      // AI-birinchi: kirgach Boshqaruv paneli emas, AI Agent konsoli ochiladi.
      router.push("/agent");
      router.refresh();
    } else {
      setError(data.message ?? t("error"));
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Brand paneli — "mission control" */}
      <div className="relative hidden overflow-hidden bg-[#070b16] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(60% 50% at 20% 15%, rgba(37,99,235,0.35), transparent 60%), radial-gradient(50% 45% at 85% 80%, rgba(124,58,237,0.30), transparent 60%)",
          }}
        />
        <div className="relative flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-lg bg-primary/90 shadow-lg shadow-primary/30">
            <Sparkles className="size-5" />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight">{tApp("name")}</span>
        </div>

        <div className="relative space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-70" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
            {t("badge")}
          </div>
          <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight">
            {t("heroLine1")}
            <br />
            <span className="text-primary-foreground/60">{t("heroLine2")}</span>
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-white/60">{t("heroDesc")}</p>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-white/40">
          <ShieldCheck className="size-4" /> {t("trust")}
        </div>
      </div>

      {/* Forma */}
      <div className="flex flex-col items-center justify-center bg-background p-6">
        <div className="absolute right-6 top-6">
          <LocaleSwitcher />
        </div>
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" required>
                {t("email")}
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => errors.email && validate()}
                aria-invalid={!!errors.email}
                className={cn(errors.email && "border-danger focus-visible:border-danger focus-visible:ring-danger/30")}
              />
              {errors.email && <p className="text-xs text-danger">{errors.email}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" required>
                {t("password")}
              </Label>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                placeholder={t("passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => errors.password && validate()}
                aria-invalid={!!errors.password}
                showLabel={t("showPassword")}
                hideLabel={t("hidePassword")}
                className={cn(errors.password && "border-danger focus-visible:border-danger focus-visible:ring-danger/30")}
              />
              {errors.password && <p className="text-xs text-danger">{errors.password}</p>}
            </div>

            {error && (
              <div className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? t("signingIn") : t("submit")}
              {!loading && <ArrowRight className="size-4" />}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
