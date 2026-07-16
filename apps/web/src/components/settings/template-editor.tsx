"use client";

import { ArrowCounterClockwise, Eye } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const LANGS = ["uz", "ru", "en"] as const;
type Lang = (typeof LANGS)[number];
export type LocalizedText = Record<Lang, string>;

const VARIABLES = ["debtor", "amount", "invoice", "days"] as const;

const SAMPLE: Record<string, string> = {
  "{debtor}": "GLOBAL SNAB MCHJ",
  "{amount}": "5 000 000,00 UZS",
  "{invoice}": "INV-1001",
  "{days}": "5",
};

function substitute(text: string): string {
  return text.replace(/\{(debtor|amount|invoice|days)\}/g, (m) => SAMPLE[m] ?? m);
}

export const DEFAULT_TEMPLATES: { soft: LocalizedText; firm: LocalizedText } = {
  soft: {
    uz: "Hurmatli {debtor}, {invoice} bo'yicha {amount} to'lov muddati yaqinlashmoqda. Iltimos, o'z vaqtida to'lang.",
    ru: "Уважаемый(ая) {debtor}, приближается срок оплаты {amount} по {invoice}. Просим оплатить своевременно.",
    en: "Dear {debtor}, payment of {amount} for {invoice} is due soon. Please pay on time.",
  },
  firm: {
    uz: "Hurmatli {debtor}, {invoice} bo'yicha {amount} to'lov muddati {days} kun o'tdi. Iltimos, zudlik bilan to'lovni amalga oshiring.",
    ru: "Уважаемый(ая) {debtor}, оплата {amount} по {invoice} просрочена на {days} дн. Просим срочно погасить задолженность.",
    en: "Dear {debtor}, payment of {amount} for {invoice} is {days} days overdue. Please settle it urgently.",
  },
};

export function TemplateEditor({
  title,
  value,
  onChange,
  onReset,
}: {
  title: string;
  value: LocalizedText;
  onChange: (next: LocalizedText) => void;
  onReset: () => void;
}) {
  const t = useTranslations("settings.channels");
  const [lang, setLang] = useState<Lang>("uz");
  const ref = useRef<HTMLTextAreaElement>(null);

  const current = value[lang] ?? "";

  function insertVariable(name: string) {
    const token = `{${name}}`;
    const el = ref.current;
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next = current.slice(0, start) + token + current.slice(end);
    onChange({ ...value, [lang]: next });
    // Kursorni token oxiriga qo'yish.
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        el.selectionStart = el.selectionEnd = start + token.length;
      }
    });
  }

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold">{title}</span>
        <div className="flex items-center gap-1 rounded-full border border-border bg-card p-0.5">
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium uppercase transition-colors",
                lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* O'zgaruvchi tugmalari */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{t("variables")}:</span>
        {VARIABLES.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => insertVariable(v)}
            className="rounded-md border border-border bg-card px-2 py-0.5 font-mono text-xs text-primary transition-colors hover:bg-primary-soft"
            title={t(`vars.${v}`)}
          >
            {`{${v}}`}
          </button>
        ))}
      </div>

      <Textarea ref={ref} value={current} onChange={(e) => onChange({ ...value, [lang]: e.target.value })} className="min-h-24" />

      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          {current.length} {t("chars")}
        </span>
        <button type="button" onClick={onReset} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowCounterClockwise className="size-3.5" /> {t("reset")}
        </button>
      </div>

      {/* Jonli preview */}
      <div className="mt-3 rounded-lg border border-dashed border-border bg-card p-3">
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <Eye className="size-3.5" /> {t("preview")}
        </div>
        <p className="text-sm leading-relaxed">{substitute(current) || "—"}</p>
      </div>
    </div>
  );
}
