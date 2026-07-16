"use client";

import {
  ChartBar,
  CurrencyCircleDollar,
  DownloadSimple,
  Printer,
  ShieldWarning,
  TrendUp,
  Wallet,
  Warning,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { StatTile } from "@/components/dashboard/stat-tile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Amount {
  minor: string;
  formatted: string;
}
export interface ReportsData {
  currency: string;
  financial: {
    invoiced: Amount;
    collected: Amount;
    outstanding: Amount;
    penalty: Amount;
    writtenOff: Amount;
    collectionRate: number;
  };
  aging: { key: string; count: number; minor: string; formatted: string; pct: number }[];
  byStatus: Record<string, number>;
  risk: { low: number; medium: number; high: number; critical: number };
  funnel: { stage: string; count: number }[];
  months: { month: string; invoiced: Amount; collected: Amount }[];
  topDebtors: {
    contractorId: string;
    name: string;
    tin: string;
    outstanding: Amount;
    penalty: Amount;
    overdueDays: number;
    riskScore: number;
  }[];
}

const AGING_COLOR: Record<string, string> = {
  current: "bg-success",
  "1_30": "bg-primary",
  "31_60": "bg-warning",
  "61_90": "bg-[#f97316]",
  "90_plus": "bg-danger",
};
const RISK_META: [keyof ReportsData["risk"], string, string][] = [
  ["low", "riskLow", "bg-success"],
  ["medium", "riskMedium", "bg-warning"],
  ["high", "riskHigh", "bg-[#f97316]"],
  ["critical", "riskCritical", "bg-danger"],
];

export function ReportsClient({ data }: { data: ReportsData | null }) {
  const t = useTranslations("reports");
  const tAging = useTranslations("aging");
  const tStage = useTranslations("stage");

  if (!data) {
    return <div className="grid h-64 place-items-center text-sm text-muted-foreground">{t("empty")}</div>;
  }

  const { financial, aging, risk, funnel, months, topDebtors } = data;
  const maxMonth = Math.max(1, ...months.map((m) => Math.max(Number(m.invoiced.minor), Number(m.collected.minor))));
  const maxFunnel = Math.max(1, ...funnel.map((f) => f.count));
  const riskTotal = risk.low + risk.medium + risk.high + risk.critical || 1;

  function exportCsv() {
    const rows: string[][] = [
      [t("agingTitle")],
      [t("colBucket"), t("colCount"), t("colAmount"), t("colShare")],
      ...aging.map((a) => [tAging(a.key as never), String(a.count), a.formatted, `${a.pct}%`]),
      [],
      [t("monthlyTitle")],
      ["", t("monthlyInvoiced"), t("monthlyCollected")],
      ...months.map((m) => [m.month, m.invoiced.formatted, m.collected.formatted]),
      [],
      [t("topDebtorsTitle")],
      [t("colContractor"), "STIR", t("outstanding"), t("penalty"), t("colOverdue"), t("colRisk")],
      ...topDebtors.map((d) => [
        d.name,
        d.tin,
        d.outstanding.formatted,
        d.penalty.formatted,
        `${d.overdueDays}`,
        `${d.riskScore}`,
      ]),
    ];
    const csv = "﻿" + rows.map((r) => r.map((c) => `"${(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `lex-hisobot-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Sarlavha + eksport */}
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">{t("title")}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-primary/40 hover:text-primary"
          >
            <DownloadSimple className="size-4" /> {t("exportCsv")}
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-primary/40 hover:text-primary"
          >
            <Printer className="size-4" /> {t("print")}
          </button>
        </div>
      </div>

      {/* Moliyaviy KPI */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label={t("invoiced")} value={financial.invoiced.formatted} icon={<CurrencyCircleDollar className="size-4" weight="fill" />} tone="primary" />
        <StatTile label={t("collected")} value={financial.collected.formatted} icon={<TrendUp className="size-4" weight="fill" />} tone="secondary" />
        <StatTile label={t("outstanding")} value={financial.outstanding.formatted} icon={<Wallet className="size-4" weight="fill" />} tone="warning" />
        <StatTile label={t("penalty")} value={financial.penalty.formatted} icon={<Warning className="size-4" weight="fill" />} tone="danger" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 6 oylik dinamika */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ChartBar className="size-[18px] text-primary" weight="fill" /> {t("monthlyTitle")}
            </CardTitle>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary" /> {t("monthlyInvoiced")}</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-success" /> {t("monthlyCollected")}</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex h-52 items-end justify-between gap-3">
              {months.map((m) => (
                <div key={m.month} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex h-44 w-full items-end justify-center gap-1">
                    <div
                      className="w-1/2 max-w-7 rounded-t bg-primary/85 transition-all"
                      style={{ height: `${(Number(m.invoiced.minor) / maxMonth) * 100}%` }}
                      title={`${t("monthlyInvoiced")}: ${m.invoiced.formatted}`}
                    />
                    <div
                      className="w-1/2 max-w-7 rounded-t bg-success/85 transition-all"
                      style={{ height: `${(Number(m.collected.minor) / maxMonth) * 100}%` }}
                      title={`${t("monthlyCollected")}: ${m.collected.formatted}`}
                    />
                  </div>
                  <span className="text-[11px] tabular text-muted-foreground">{m.month.slice(5)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Risk taqsimoti */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldWarning className="size-[18px] text-danger" weight="fill" /> {t("riskTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {RISK_META.map(([key, label, color]) => {
              const v = risk[key];
              return (
                <div key={key}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className={cn("size-2.5 rounded-sm", color)} /> {t(label as never)}
                    </span>
                    <span className="tabular font-medium">{v}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", color)} style={{ width: `${(v / riskTotal) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Qarz yoshi tahlili */}
      <Card>
        <CardHeader>
          <CardTitle>{t("agingTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 font-medium">{t("colBucket")}</th>
                <th className="pb-2 text-right font-medium">{t("colCount")}</th>
                <th className="pb-2 text-right font-medium">{t("colAmount")}</th>
                <th className="hidden pb-2 pl-6 font-medium sm:table-cell">{t("colShare")}</th>
              </tr>
            </thead>
            <tbody>
              {aging.map((a) => (
                <tr key={a.key} className="border-b border-border/60 last:border-0">
                  <td className="py-2.5">
                    <span className="flex items-center gap-2">
                      <span className={cn("size-2.5 rounded-sm", AGING_COLOR[a.key])} />
                      {tAging(a.key as never)}
                    </span>
                  </td>
                  <td className="py-2.5 text-right tabular text-muted-foreground">{a.count}</td>
                  <td className="py-2.5 text-right tabular font-medium">{a.formatted}</td>
                  <td className="hidden py-2.5 pl-6 sm:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className={cn("h-full rounded-full", AGING_COLOR[a.key])} style={{ width: `${a.pct}%` }} />
                      </div>
                      <span className="w-9 shrink-0 text-right tabular text-xs text-muted-foreground">{a.pct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Undiruv bosqichlari (funnel) */}
        <Card>
          <CardHeader>
            <CardTitle>{t("funnelTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {funnel.map((f) => (
              <div key={f.stage}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{tStage(f.stage as never)}</span>
                  <span className="tabular font-medium">{f.count}</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary" style={{ width: `${(f.count / maxFunnel) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Eng katta qarzdorlar */}
        <Card>
          <CardHeader>
            <CardTitle>{t("topDebtorsTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {topDebtors.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>}
              {topDebtors.map((d) => (
                <div key={d.contractorId} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{d.name}</p>
                    <p className="tabular text-[11px] text-muted-foreground">
                      {d.tin} · {d.overdueDays} {t("days")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tabular text-sm font-semibold">{d.outstanding.formatted}</p>
                    <p
                      className={cn(
                        "text-[11px] font-medium",
                        d.riskScore >= 85 ? "text-danger" : d.riskScore >= 60 ? "text-[#f97316]" : d.riskScore >= 30 ? "text-warning" : "text-success",
                      )}
                    >
                      {t("colRisk")}: {d.riskScore}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
