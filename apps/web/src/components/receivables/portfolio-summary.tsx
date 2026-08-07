"use client";

import { Brain, ChartLineUp, CircleNotch, Lightning, Target, TrendUp } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export interface PortfolioSummaryData {
  activeOutstandingFormatted: string;
  activeCases: number;
  avgDsScore: number;
  successRate: number;
  recoveryRate: number | null;
  topPriority: {
    rank: number;
    caseId: string;
    caseNumber: string;
    debtorName: string;
    amountFormatted: string;
    overdueDays: number;
    dsScore: number;
    recoveryProbability: number;
    strategy: string;
    channels: string;
  }[];
}

const STRATEGY_UZ: Record<string, string> = {
  soft_escalation: "Yumshoq eskalatsiya",
  standard: "Standart",
  aggressive: "Qattiq",
  legal: "Huquqiy",
};

export function PortfolioSummary({ data }: { data: PortfolioSummaryData }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const recoveryPct = data.recoveryRate ?? data.successRate;

  function analyzeBatch() {
    start(async () => {
      await fetch("/api/v2/batches/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      router.refresh();
    });
  }

  return (
    <div className="mb-5 space-y-3 rounded-xl border border-border bg-card/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <ChartLineUp className="size-4" /> Portfel bo&apos;yicha AI tahlili
        </h2>
        <button
          type="button"
          onClick={analyzeBatch}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? <CircleNotch className="size-3.5 animate-spin" /> : <Brain className="size-3.5" />}
          Portfelni tahlil qilish
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={<ChartLineUp weight="duotone" className="size-4 text-primary" />} label="Faol portfel" value={data.activeOutstandingFormatted} sub={`${data.activeCases} ta ish`} />
        <KpiCard icon={<TrendUp weight="duotone" className="size-4 text-emerald-600" />} label="Undirish darajasi" value={recoveryPct != null ? `${recoveryPct}%` : "—"} sub="Portfel bo'yicha" />
        <KpiCard icon={<Target weight="duotone" className="size-4 text-violet-600" />} label="O'rtacha DS-Score" value={`${data.avgDsScore}/100`} sub="Undirish ehtimoli" />
        <KpiCard icon={<Lightning weight="duotone" className="size-4 text-amber-500" />} label="Muvaffaqiyat ehtimoli" value={`${data.successRate}%`} sub="AI bashorat" />
      </div>

      {data.topPriority.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Target className="size-3.5" /> Top prioritet (AI tavsiyasi)
          </h3>
          <div className="divide-y divide-border rounded-lg border border-border">
            {data.topPriority.slice(0, 5).map((item) => (
              <Link
                key={item.caseId}
                href={`/command-center/${item.caseId}`}
                className="flex flex-wrap items-center gap-3 p-3 transition-colors hover:bg-muted/50"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  #{item.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {item.debtorName} · {item.amountFormatted}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.caseNumber} · {item.overdueDays} kun kechikish · DS {item.dsScore} · {STRATEGY_UZ[item.strategy] ?? item.strategy}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-600">{item.recoveryProbability}%</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-1.5">{icon}</div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="tabular mt-0.5 text-base font-semibold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}
