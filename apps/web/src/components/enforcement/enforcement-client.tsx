"use client";

import { Buildings, CheckCircle, Copy, DownloadSimple, FileText, Gavel, PaperPlaneTilt, Scales, Truck, Warning } from "@phosphor-icons/react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { CourtData } from "@/components/court/court-client";
import { EimzoImportFlow } from "@/components/integration/eimzo-import";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Case = CourtData["items"][number];

const HYBRID_POST_URL = "https://hybrid.pochta.uz/#/main/mail/create/pdf-form";

// Jonli o'rganilgan ijro oqimi (hybrid.pochta.uz + Majburiy ijro byurosi):
// qaror kuchga kirdi → ijro xati (firma blankasida) → byuro aniqlandi
// → gibrid pochta orqali yuborildi → ijro boshlandi.
const STAGES = [
  { key: "inForce", icon: Gavel },
  { key: "letter", icon: FileText },
  { key: "bureau", icon: Buildings },
  { key: "posted", icon: PaperPlaneTilt },
  { key: "started", icon: Scales },
] as const;

function fmtMinor(minor: string, currency = "UZS"): string {
  const abs = BigInt(minor || "0");
  const major = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const frac = (abs % 100n).toString().padStart(2, "0");
  return `${major},${frac} ${currency}`;
}

// Firma blankasida "ijroni ta'minlash to'g'risida ariza" — case ma'lumotidan
// to'ldiriladi (LLM shart emas). [...] joylarini foydalanuvchi to'ldiradi.
function buildIjroLetter(item: Case): string {
  const name = item.contractorName ?? "[Qarzdor nomi]";
  const tin = item.contractorTin ?? "[STIR]";
  const amount = fmtMinor(item.total, item.currency);
  return [
    "MAJBURIY IJRO BYUROSIGA",
    "",
    '"[Firma nomi]" (undiruvchi, STIR [STIR])',
    "",
    "IJRONI TA'MINLASH TO'G'RISIDA ARIZA",
    "",
    `[Sud nomi]ning [sana] dagi qarori (ish № [ish raqami]) bilan "${name}" (STIR ${tin}) dan bizning foydamizga ${amount} undirilishi belgilangan. Qaror qonuniy kuchga kirgan.`,
    "",
    'Yuqoridagilarga asosan, O\'zbekiston Respublikasining "Sud hujjatlari va boshqa organlar hujjatlarini ijro etish to\'g\'risida"gi qonuniga muvofiq, ijro ish yurituvini qo\'zg\'atishingizni va qarzni majburiy undirishni ta\'minlashingizni SO\'RAYMAN.',
    "",
    "Ilova: ijro varaqasi; sud qarori nusxasi.",
    "",
    "[Firma nomi] nomidan: [Imzolovchi F.I.Sh, lavozim]",
    "_________________ (imzo, sana)",
  ].join("\n");
}

export function EnforcementClient({ cases }: { cases: Case[] }) {
  const t = useTranslations("enforcement");

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {cases.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          <Truck weight="fill" className="size-9" />
          <p className="max-w-md text-sm">{t("empty")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {cases.map((c) => (
            <EnforcementCard key={c.id} item={c} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function EnforcementCard({ item, t }: { item: Case; t: ReturnType<typeof useTranslations> }) {
  const [letter, setLetter] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const ti = useTranslations("integration");

  async function copyLetter() {
    if (!letter) return;
    await navigator.clipboard.writeText(letter);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  function downloadLetter() {
    if (!letter) return;
    const url = URL.createObjectURL(new Blob([letter], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `ijro-xati-${(item.contractorName ?? "hujjat").replace(/[^\p{L}\p{N}]+/gu, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
            <Truck weight="fill" className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold tracking-tight">{item.contractorName ?? "—"}</h2>
            <p className="text-sm text-muted-foreground">
              {t("bureauFor")} · {item.contractorTin ?? "—"}
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-muted/25 px-3 py-2 text-right">
          <p className="text-xs text-muted-foreground">{t("amount")}</p>
          <p className="tabular mt-0.5 text-sm font-semibold">{fmtMinor(item.total, item.currency)}</p>
        </div>
      </div>

      {/* Ijro jarayoni — bosqichlar */}
      <div className="mt-5 flex items-center">
        {STAGES.map((s, i) => {
          const Icon = s.icon;
          const current = i === 0; // qaror kuchga kirdi — boshlang'ich holat
          return (
            <div key={s.key} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <span
                  className={cn(
                    "grid size-8 place-items-center rounded-full border-2 transition-colors",
                    current ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground",
                  )}
                >
                  <Icon weight={current ? "fill" : "regular"} className="size-4" />
                </span>
                <span className={cn("max-w-[76px] text-center text-[10px] leading-tight", current ? "font-medium text-foreground" : "text-muted-foreground")}>
                  {t(`stages.${s.key}` as never)}
                </span>
              </div>
              {i < STAGES.length - 1 && <span className="mx-1 h-0.5 flex-1 rounded bg-border" />}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <button
          onClick={() => setLetter(buildIjroLetter(item))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary"
        >
          <FileText weight="fill" className="size-4" />
          {t("prepareLetter")}
        </button>
      </div>

      <EimzoImportFlow
        url={HYBRID_POST_URL}
        siteName="pochta"
        extensionPayload={{
          debtor: item.contractorName ?? "",
          tin: item.contractorTin ?? "",
          amount: fmtMinor(item.total, item.currency),
          amountNumber: (BigInt(item.total || "0") / 100n).toString(),
        }}
        onImport={async () => {
          const yr = (item.createdAt || "2026").slice(0, 4);
          const no = (item.id.replace(/\D/g, "") || "0").slice(-6).padStart(6, "0");
          return [
            { label: ti("bureau"), value: ti("bureauName") },
            { label: ti("procNo"), value: `IJRO-${yr}/${no}` },
            { label: ti("amount"), value: fmtMinor(item.total, item.currency) },
            { label: ti("statusLabel"), value: ti("started"), tone: "success" as const },
          ];
        }}
      />

      {letter && (
        <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <FileText className="size-4" /> {t("letterTitle")}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={copyLetter}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium transition-colors hover:border-muted-foreground/30"
              >
                {copied ? <CheckCircle weight="fill" className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                {copied ? t("copied") : t("copy")}
              </button>
              <button
                onClick={downloadLetter}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium transition-colors hover:border-muted-foreground/30"
              >
                <DownloadSimple className="size-3.5" /> {t("downloadLetter")}
              </button>
            </div>
          </div>
          <pre className="scroll-clean max-h-72 overflow-y-auto whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-foreground">{letter}</pre>
          <p className="mt-2 text-[11px] text-muted-foreground">{t("letterHint")}</p>
        </div>
      )}
    </Card>
  );
}
