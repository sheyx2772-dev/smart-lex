"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LOCALE_COOKIE, localeNames, locales, type AppLocale } from "@/i18n/config";
import { cn } from "@/lib/utils";

export function LocaleSwitcher({ className, variant = "default" }: { className?: string; variant?: "default" | "ghost" }) {
  const active = useLocale() as AppLocale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const ghost = variant === "ghost";

  function change(locale: AppLocale) {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full p-0.5 text-xs",
        ghost ? "border border-white/20 bg-transparent" : "border border-border bg-card",
        pending && "opacity-60",
        className,
      )}
    >
      {locales.map((l) => (
        <button
          key={l}
          onClick={() => change(l)}
          title={localeNames[l]}
          className={cn(
            "rounded-full px-2.5 py-1 font-semibold uppercase tracking-wider transition-colors",
            active === l
              ? ghost
                ? "bg-white text-black"
                : "bg-primary text-primary-foreground"
              : ghost
                ? "text-white/55 hover:text-white"
                : "text-muted-foreground hover:text-foreground",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
