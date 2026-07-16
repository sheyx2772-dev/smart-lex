"use client";

import {
  ArrowRight,
  Bell,
  CheckCircle,
  FileText,
  Gavel,
  Hourglass,
  SealCheck,
  ShieldWarning,
  Timer,
  Warning,
} from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { fetchOverdue } from "@/app/(app)/overdue/actions";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { StatTile } from "@/components/dashboard/stat-tile";
import { cn } from "@/lib/utils";

interface Amount {
  minor: string;
  formatted: string;
}
interface OverdueItem {
  id: string;
  outstanding: Amount;
  penalty: Amount;
  total: Amount;
  currency: string;
  overdueDays: number;
  agingBucket: string;
  riskScore: number;
  executedStages: string[];
  nextStage: string | null;
  invoiceNumber: string;
  dueDate: string;
  contractorId: string;
  contractorName: string;
  contractorTin: string;
  phone: string | null;
  contractNumber: string | null;
  reminderCount: number;
  lastReminderAt: string | null;
  pendingApproval: string | null;
}
export interface OverdueData {
  items: OverdueItem[];
  summary: {
    count: number;
    totalOutstanding: Amount;
    totalPenalty: Amount;
    needsApproval: number;
    critical: number;
    byAging: Record<string, number>;
  } | null;
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

const STAGES = [
  { key: "soft_reminder", icon: Bell },
  { key: "firm_reminder", icon: Warning },
  { key: "demand_letter", icon: FileText },
  { key: "court", icon: Gavel },
] as const;
const AGING_FILTERS = ["all", "1_30", "31_60", "61_90", "90_plus"] as const;

function riskTone(score: number): BadgeProps["tone"] {
  if (score >= 70) return "danger";
  if (score >= 40) return "warning";
  return "success";
}

export function OverdueClient({ initial }: { initial: OverdueData }) {
  const t = useTranslations("overdue");
  const tAging = useTranslations("aging");
  const tStage = useTranslations("stage");
  const locale = useLocale();
  const [data, setData] = useState<OverdueData>(initial);
  const [aging, setAging] = useState<string>("all");
  const [loading, setLoading] = useState(false);

  const fmtDate = (d: string | null) =>
    d ? new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" }).format(new Date(d)) : "—";

  async function load(page: number, ag = aging) {
    setLoading(true);
    const d = await fetchOverdue({ page, aging: ag });
    if (d) setData(d);
    setLoading(false);
  }

  const items = data.items;
  const s = data.summary;

  return (
    <div className="w-full space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={t("totalOverdue")} value={s?.totalOutstanding.formatted ?? "—"} tone="danger" icon={<Timer weight="fill" className="size-4" />} />
        <StatTile label={t("penaltyAccrued")} value={s?.totalPenalty.formatted ?? "—"} tone="warning" icon={<Warning weight="fill" className="size-4" />} />
        <StatTile label={t("needsApproval")} value={String(s?.needsApproval ?? 0)} tone="primary" plain icon={<SealCheck weight="fill" className="size-4" />} />
        <StatTile label={t("critical")} value={String(s?.critical ?? 0)} tone="secondary" plain icon={<ShieldWarning weight="fill" className="size-4" />} />
      </div>

      {/* Aging filter */}
      <div className="inline-flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
        {AGING_FILTERS.map((a) => {
          const count = a === "all" ? s?.count ?? 0 : s?.byAging[a] ?? 0;
          return (
            <button
              key={a}
              onClick={() => {
                setAging(a);
                load(1, a);
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                aging === a ? "bg-primary-soft text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {a === "all" ? t("all") : tAging(a as never)}
              <span
                className={cn(
                  "grid h-5 min-w-5 place-items-center rounded-full px-1 text-xs",
                  aging === a ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Worklist */}
      {items.length === 0 ? (
        <div className="flex h-52 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border text-muted-foreground">
          <CheckCircle weight="fill" className="size-9 text-success" />
          <p className="text-sm">{t("empty")}</p>
        </div>
      ) : (
        <>
          <div className={cn("space-y-3 transition-opacity", loading && "opacity-50")}>
            {items.map((item) => (
              <OverdueCard key={item.id} item={item} t={t} tStage={tStage} tAging={tAging} fmtDate={fmtDate} />
            ))}
          </div>
          <Pagination page={data.page} pageCount={data.pageCount} pageSize={data.pageSize} total={data.total} onPage={(p) => load(p)} disabled={loading} />
        </>
      )}
    </div>
  );
}

function OverdueCard({
  item,
  t,
  tStage,
  tAging,
  fmtDate,
}: {
  item: OverdueItem;
  t: ReturnType<typeof useTranslations>;
  tStage: ReturnType<typeof useTranslations>;
  tAging: ReturnType<typeof useTranslations>;
  fmtDate: (d: string | null) => string;
}) {
  const NextIcon = STAGES.find((x) => x.key === item.nextStage)?.icon ?? CheckCircle;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-muted-foreground/25">
      <div className="grid items-center gap-4 lg:grid-cols-[1.4fr_1fr_auto_1.3fr]">
        {/* Contractor */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link href={`/companies/${item.contractorId}`} className="truncate font-semibold hover:text-primary hover:underline">
              {item.contractorName}
            </Link>
            <Badge tone={riskTone(item.riskScore)}>
              <ShieldWarning weight="fill" className="size-3" />
              {item.riskScore}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {item.invoiceNumber} · {t("dueDate")}: {fmtDate(item.dueDate)}
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Bell className="size-3.5" />
            {item.lastReminderAt ? `${t("lastReminder")}: ${fmtDate(item.lastReminderAt)}` : t("noReminder")}
            <span className="text-muted-foreground/50">·</span>
            {item.reminderCount} {t("reminders")}
          </div>
        </div>

        {/* Amounts */}
        <div>
          <p className="tabular font-display text-lg font-semibold">{item.total.formatted}</p>
          <p className="tabular mt-0.5 text-xs text-muted-foreground">
            {item.outstanding.formatted} <span className="text-warning">+{item.penalty.formatted}</span>
          </p>
        </div>

        {/* Overdue days + aging */}
        <div className="flex flex-col items-start gap-1.5 lg:items-center">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-danger-soft px-2.5 py-1 text-sm font-semibold text-danger">
            <Timer weight="fill" className="size-4" />
            {item.overdueDays} {t("overdueDays")}
          </span>
          <Badge tone="neutral">{tAging(item.agingBucket as never)}</Badge>
        </div>

        {/* Collection progress + next action */}
        <div className="space-y-2.5">
          {/* mini stepper */}
          <div className="flex items-center gap-1">
            {STAGES.map((st, i) => {
              const done = item.executedStages.includes(st.key);
              const isNext = item.nextStage === st.key;
              return (
                <div key={st.key} className="flex flex-1 items-center last:flex-none">
                  <div
                    title={tStage(st.key as never)}
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full border transition-colors",
                      done
                        ? "border-success bg-success-soft text-success"
                        : isNext
                          ? "border-primary bg-primary-soft text-primary"
                          : "border-border bg-muted text-muted-foreground",
                    )}
                  >
                    <st.icon weight={done ? "fill" : "regular"} className="size-3.5" />
                  </div>
                  {i < STAGES.length - 1 && (
                    <div className={cn("h-0.5 flex-1 rounded-full", done ? "bg-success/50" : "bg-border")} />
                  )}
                </div>
              );
            })}
          </div>

          {/* next action */}
          {item.pendingApproval ? (
            <Link
              href="/approvals"
              className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary-soft px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
            >
              <span className="inline-flex items-center gap-1.5">
                <Hourglass weight="fill" className="size-4" />
                {t("awaitingApproval")}
              </span>
              <span className="inline-flex items-center gap-1 text-xs">
                {t("review")} <ArrowRight className="size-3.5" />
              </span>
            </Link>
          ) : item.nextStage ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-sm">
              <NextIcon weight="fill" className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">{t("nextAction")}:</span>
              <span className="font-medium">{tStage(item.nextStage as never)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success-soft px-3 py-1.5 text-sm font-medium text-success">
              <CheckCircle weight="fill" className="size-4" />
              {t("completed")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
