"use client";

import { ArrowSquareOut, Buildings, CheckCircle, FileText, Gavel, PaperPlaneTilt, Scales, Truck, Warning } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import type { CourtData } from "@/components/court/court-client";
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
  function openHybridPost() {
    window.open(HYBRID_POST_URL, "pochta", "noopener,noreferrer");
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
          onClick={openHybridPost}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <ArrowSquareOut weight="fill" className="size-4" />
          {t("sendViaPost")}
        </button>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          <CheckCircle className="size-4 text-success" /> {t("blankaNote")}
        </span>
      </div>

      <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
        <Warning className="mt-0.5 size-3.5 shrink-0" /> {t("confirmHint")}
      </p>
    </Card>
  );
}
