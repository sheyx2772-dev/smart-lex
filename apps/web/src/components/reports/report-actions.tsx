"use client";

import { DownloadSimple, Printer } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

interface Amount {
  minor: string;
  formatted: string;
}
export interface ReportData {
  currency: string;
  financial: { invoiced: Amount; collected: Amount; outstanding: Amount; penalty: Amount; writtenOff: Amount; collectionRate: number };
  aging: { bucket: string; count: number; minor: string; formatted: string; pct: number }[];
  byStatus: Record<string, number>;
  risk: { low: number; medium: number; high: number; critical: number };
  funnel: { stage: string; count: number }[];
  months: { month: string; invoiced: Amount; collected: Amount }[];
  topDebtors: { contractorId: string; name: string; tin: string; outstanding: Amount; penalty: Amount; overdueDays: number; riskScore: number }[];
}

function csvCell(v: string): string {
  return /[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function ReportActions({ data }: { data: ReportData }) {
  const t = useTranslations("reports");
  const tAging = useTranslations("aging");

  function exportCsv() {
    const rows: string[][] = [];
    rows.push([t("title")]);
    rows.push([]);
    rows.push([t("invoiced"), data.financial.invoiced.formatted]);
    rows.push([t("collected"), data.financial.collected.formatted]);
    rows.push([t("outstanding"), data.financial.outstanding.formatted]);
    rows.push([t("penalty"), data.financial.penalty.formatted]);
    rows.push([t("collectionRate"), `${data.financial.collectionRate}%`]);
    rows.push([]);
    rows.push([t("agingTitle")]);
    rows.push([t("colBucket"), t("colCount"), t("colAmount"), t("colShare")]);
    for (const a of data.aging) rows.push([tAging(a.bucket as never), String(a.count), a.formatted, `${a.pct}%`]);
    rows.push([]);
    rows.push([t("topDebtorsTitle")]);
    rows.push([t("colContractor"), "STIR", t("outstanding"), t("colOverdue"), t("colRisk")]);
    for (const d of data.topDebtors) rows.push([d.name, d.tin, d.outstanding.formatted, String(d.overdueDays), String(d.riskScore)]);

    const csv = rows.map((r) => r.map((c) => csvCell(c ?? "")).join(",")).join("\r\n");
    const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hisobot.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex shrink-0 items-center gap-2 print:hidden">
      <button
        onClick={exportCsv}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        <DownloadSimple weight="fill" className="size-4" /> {t("exportCsv")}
      </button>
      <button
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium transition-colors hover:border-muted-foreground/30"
      >
        <Printer weight="fill" className="size-4" /> {t("print")}
      </button>
    </div>
  );
}
