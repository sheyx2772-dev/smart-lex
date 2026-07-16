"use client";

import { ArrowSquareOut, CaretDown, CheckCircle, Copy, FileText, Gavel, Scales, UploadSimple, Warning } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { setCourtStatus } from "@/app/(app)/court/actions";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DocumentView } from "@/components/ui/document-view";
import { cn } from "@/lib/utils";

interface CourtItem {
  id: string;
  title: string;
  body: string;
  status: string;
  approvalStatus: string;
  createdAt: string;
  contractorName: string | null;
  contractorTin: string | null;
  contractorId: string | null;
  court: string;
  total: string;
  stateDuty: string;
  currency: string;
}
export interface CourtData {
  items: CourtItem[];
  total: number;
}

const STATUS_FLOW = ["draft", "ready", "submitted", "accepted", "returned", "correction", "completed"] as const;
const STATUS_TONE: Record<string, BadgeProps["tone"]> = {
  draft: "neutral",
  ready: "primary",
  submitted: "secondary",
  accepted: "success",
  returned: "warning",
  correction: "warning",
  completed: "success",
};

function fmtMinor(minor: string, currency = "UZS"): string {
  const abs = BigInt(minor || "0");
  const major = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const frac = (abs % 100n).toString().padStart(2, "0");
  return `${major},${frac} ${currency}`;
}

// E-SUD (cabinet.sud.uz) haqiqiy jarayoniga mos vizual bosqichlar.
// Jonli o'rganilgan oqim: tayyorlash → topshirishga tayyor → E-SUD'ga topshirish
// → qabul → qaror. E-IMZO imzoni foydalanuvchi E-SUD portalida qo'yadi.
const STAGE_STEPS = [
  { key: "prepared", icon: FileText },
  { key: "ready", icon: Scales },
  { key: "submitted", icon: UploadSimple },
  { key: "accepted", icon: CheckCircle },
  { key: "decided", icon: Gavel },
] as const;

function stageIndex(status: string): number {
  switch (status) {
    case "draft":
      return 0;
    case "ready":
      return 1;
    case "submitted":
    case "returned":
    case "correction":
      return 2;
    case "accepted":
      return 3;
    case "completed":
      return 4;
    default:
      return 0;
  }
}

function CourtStepper({ status, t }: { status: string; t: ReturnType<typeof useTranslations> }) {
  const active = stageIndex(status);
  const warn = status === "returned" || status === "correction";
  return (
    <div className="mt-4 flex items-center">
      {STAGE_STEPS.map((s, i) => {
        const done = i < active;
        const current = i === active;
        const Icon = s.icon;
        return (
          <div key={s.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "grid size-8 place-items-center rounded-full border-2 transition-colors",
                  current && warn
                    ? "border-warning bg-warning-soft text-warning"
                    : current
                      ? "border-primary bg-primary text-primary-foreground"
                      : done
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border bg-card text-muted-foreground",
                )}
              >
                <Icon weight={done || current ? "fill" : "regular"} className="size-4" />
              </span>
              <span className={cn("max-w-[72px] text-center text-[10px] leading-tight", current ? "font-medium text-foreground" : "text-muted-foreground")}>
                {t(`stages.${s.key}` as never)}
              </span>
            </div>
            {i < STAGE_STEPS.length - 1 && <span className={cn("mx-1 h-0.5 flex-1 rounded", i < active ? "bg-primary" : "bg-border")} />}
          </div>
        );
      })}
    </div>
  );
}

export function CourtClient({ initial }: { initial: CourtData }) {
  const t = useTranslations("court");

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {initial.items.length === 0 ? (
        <div className="flex h-52 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border text-muted-foreground">
          <Scales weight="fill" className="size-9" />
          <p className="text-sm">{t("empty")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {initial.items.map((item) => (
            <CourtCard key={item.id} item={item} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function CourtCard({ item, t }: { item: CourtItem; t: ReturnType<typeof useTranslations> }) {
  const [status, setStatus] = useState(item.status);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const approved = item.approvalStatus === "approved";

  function openPortal() {
    window.open("https://cabinet.sud.uz", "sud", "width=1200,height=820,noopener,noreferrer");
  }
  async function copy() {
    await navigator.clipboard.writeText(item.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  function changeStatus(s: string) {
    setStatus(s);
    startTransition(() => setCourtStatus(item.id, s).then(() => {}));
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-danger-soft text-danger">
            <Gavel weight="fill" className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold tracking-tight">{item.contractorName ?? "—"}</h2>
            <p className="text-sm text-muted-foreground">
              {t("defendant")} · {t("court")}: {item.court}
            </p>
          </div>
        </div>
        <Badge tone={STATUS_TONE[status]}>{t(`st.${status}` as never)}</Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-muted/25 p-3">
          <p className="text-xs text-muted-foreground">{t("total")}</p>
          <p className="tabular mt-1 text-sm font-semibold">{fmtMinor(item.total, item.currency)}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/25 p-3">
          <p className="text-xs text-muted-foreground">{t("stateDuty")}</p>
          <p className="tabular mt-1 text-sm font-semibold text-warning">{fmtMinor(item.stateDuty, item.currency)}</p>
        </div>
      </div>

      {/* E-SUD jarayoni — vizual bosqichlar (haqiqiy cabinet.sud.uz oqimiga mos) */}
      <CourtStepper status={status} t={t} />

      {!approved && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning">
          <Warning weight="fill" className="size-4 shrink-0" /> {t("notApproved")}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={openPortal}
          disabled={!approved}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <ArrowSquareOut weight="fill" className="size-4" />
          {t("submitEsud")}
        </button>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium transition-colors hover:border-muted-foreground/30"
        >
          {copied ? <CheckCircle weight="fill" className="size-4 text-success" /> : <Copy className="size-4" />}
          {copied ? t("copied") : t("copyText")}
        </button>
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <CaretDown className={cn("size-4 transition-transform", open && "rotate-180")} /> {t("docText")}
        </button>
      </div>

      {approved && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
          <Warning className="mt-0.5 size-3.5 shrink-0" /> {t("eimzoHint")}
        </p>
      )}

      {open && (
        <div className="scroll-clean mt-3 max-h-72 overflow-y-auto">
          <DocumentView body={item.body} />
        </div>
      )}

      {/* Status flow */}
      {approved && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("changeStatus")}</p>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FLOW.filter((s) => s !== "draft").map((s) => (
              <button
                key={s}
                onClick={() => changeStatus(s)}
                disabled={pending}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60",
                  status === s ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`st.${s}` as never)}
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
