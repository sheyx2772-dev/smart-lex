"use client";

import { CheckCircle, ChatCircleDots, Copy, DeviceMobile, PaperPlaneTilt, X } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

export function PaymentReminderButton({ name, amount }: { name: string; amount: string }) {
  const t = useTranslations("companies");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const message = t("prMsg", { name, amount });

  async function copy() {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary"
      >
        <ChatCircleDots weight="fill" className="size-4" /> {t("paymentReminder")}
      </button>

      {open && (
        <>
          <button type="button" aria-label="close" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-[320px] rounded-xl border border-border bg-card p-4 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("prTitle")}</p>
              <button onClick={() => setOpen(false)} className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted">
                <X className="size-3.5" />
              </button>
            </div>
            <p className="whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 text-sm leading-relaxed">{message}</p>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={copy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                {copied ? <CheckCircle weight="fill" className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? t("prCopied") : t("prCopy")}
              </button>
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <DeviceMobile className="size-3.5" /> <PaperPlaneTilt className="size-3.5" /> {t("prHint")}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
