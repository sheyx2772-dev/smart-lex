"use client";

import {
  Brain,
  ChartLineUp,
  CircleNotch,
  Gavel,
  Lightning,
  Robot,
  ShieldCheck,
  Sparkle,
  Target,
  TrendUp,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";

export interface CommandCenterData {
  agentStatus: { mode: string; label: string; humanApprovalsRequired: number };
  portfolio: {
    activeOutstandingMinor: string;
    activeOutstandingFormatted: string;
    activeCases: number;
    avgDsScore: number;
    successRate: number;
    recoveryRate: number | null;
  };
  topPriority: {
    rank: number;
    caseId: string;
    caseNumber: string;
    debtorName: string;
    amountFormatted: string;
    overdueDays: number;
    estimatedDays: number;
    dsScore: number;
    recoveryProbability: number;
    strategy: string;
    channels: string;
    state: string;
    currentPhase: number;
  }[];
  pendingOverrides: {
    id: string;
    type: string;
    debtCaseId: string;
    debtorMessage: string | null;
    aiRecommendation: Record<string, unknown>;
    autoExecuteAt: string | null;
  }[];
  insights: string[];
  recentEvents: {
    id: string;
    eventType: string;
    debtCaseId: string;
    detail: Record<string, unknown> | null;
    createdAt: string | null;
  }[];
}

const STRATEGY_UZ: Record<string, string> = {
  soft_escalation: "Yumshoq eskalatsiya",
  standard: "Standart",
  aggressive: "Qattiq",
  legal: "Huquqiy",
};

const fmtTime = (d: string | null) =>
  d ? new Intl.DateTimeFormat("uz-UZ", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(d)) : "";

interface Props {
  initial: CommandCenterData | null;
}

export function CommandCenter({ initial }: Props) {
  const [data, setData] = useState(initial);
  const [pending, start] = useTransition();
  const router = useRouter();

  async function refresh() {
    const res = await fetch("/api/command-center");
    const json = await res.json();
    if (json.success) setData(json.data);
  }

  async function analyzeBatch() {
    start(async () => {
      await fetch("/api/v2/batches/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      await refresh();
      router.refresh();
    });
  }

  async function decideOverride(id: string, decision: "approved" | "rejected") {
    start(async () => {
      await fetch(`/api/command-center/overrides/${id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      await refresh();
    });
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
        Command Center ma&apos;lumotlari yuklanmadi. API ishlayotganini tekshiring.
      </div>
    );
  }

  const isAutonomous = data.agentStatus.mode === "auto";
  const recoveryPct = data.portfolio.recoveryRate ?? data.portfolio.successRate;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">SMARTLEX-Ai Autonomous OS v2.0</p>
          <h1 className="text-2xl font-semibold tracking-tight">Command Center</h1>
          <p className="mt-1 text-sm text-muted-foreground">Avtonom qarz undirish operatsion tizimi — bitta paneldan boshqaring</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => start(refresh)}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted"
          >
            {pending ? <CircleNotch className="size-4 animate-spin" /> : <Sparkle className="size-4" />}
            Yangilash
          </button>
          <button
            type="button"
            onClick={analyzeBatch}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90"
          >
            <Brain className="size-4" />
            Portfelni tahlil qilish
          </button>
        </div>
      </div>

      {/* Agent status banner */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-4 rounded-xl border px-5 py-4",
          isAutonomous ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5",
        )}
      >
        <div className={cn("flex size-10 items-center justify-center rounded-full", isAutonomous ? "bg-emerald-500/15" : "bg-amber-500/15")}>
          <Robot weight="fill" className={cn("size-5", isAutonomous ? "text-emerald-600" : "text-amber-600")} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">
            AI Agent: {isAutonomous ? "🟢 TO'LIQ AVTONOM" : "🟡 " + data.agentStatus.label}
          </p>
          <p className="text-xs text-muted-foreground">
            Rejim: {data.agentStatus.mode.toUpperCase()} · Inson tasdiqlari: {data.agentStatus.humanApprovalsRequired}
          </p>
        </div>
        <Link href="/agent" className="text-xs text-primary hover:underline">
          Agent sozlamalari →
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<ChartLineUp weight="duotone" className="size-5 text-primary" />}
          label="Faol portfel"
          value={data.portfolio.activeOutstandingFormatted}
          sub={`${data.portfolio.activeCases} ta ish`}
        />
        <KpiCard
          icon={<TrendUp weight="duotone" className="size-5 text-emerald-600" />}
          label="Undirish darajasi"
          value={recoveryPct != null ? `${recoveryPct}%` : "—"}
          sub="Portfel bo'yicha"
        />
        <KpiCard
          icon={<Target weight="duotone" className="size-5 text-violet-600" />}
          label="O'rtacha DS-Score"
          value={`${data.portfolio.avgDsScore}/100`}
          sub="Undirish ehtimoli"
        />
        <KpiCard
          icon={<Lightning weight="duotone" className="size-5 text-amber-500" />}
          label="Muvaffaqiyat ehtimoli"
          value={`${data.portfolio.successRate}%`}
          sub="AI bashorat"
        />
      </div>

      {/* Recovery velocity bar */}
      <div className="rounded-xl border p-5">
        <div className="mb-2 flex justify-between text-sm">
          <span className="font-medium">Oylik undirish maqsadi</span>
          <span className="text-muted-foreground">{recoveryPct ?? 0}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 transition-all"
            style={{ width: `${Math.min(100, recoveryPct ?? 0)}%` }}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Priority queue */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Target className="size-4" />
            Top prioritet (avto-ijro)
          </h2>
          <div className="rounded-xl border divide-y">
            {data.topPriority.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">Faol ishlar yo&apos;q. Portfelni tahlil qiling yoki shartnoma yuklang.</p>
            ) : (
              data.topPriority.map((item) => (
                <Link
                  key={item.caseId}
                  href={`/command-center/${item.caseId}`}
                  className="flex flex-wrap items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    #{item.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">
                      {item.debtorName} · {item.amountFormatted}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.caseNumber} · {item.overdueDays} kun kechikish · DS {item.dsScore} · {STRATEGY_UZ[item.strategy] ?? item.strategy}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge text={item.channels} cls="bg-muted" />
                    <Badge text={`${item.recoveryProbability}%`} cls="bg-emerald-500/15 text-emerald-600" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Insights */}
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Brain className="size-4" />
            Bashorat
          </h2>
          <div className="space-y-2">
            {data.insights.map((insight) => (
              <div key={insight} className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                {insight}
              </div>
            ))}
            {data.insights.length === 0 && <p className="text-sm text-muted-foreground">Hozircha bashorat yo&apos;q</p>}
          </div>
        </div>
      </div>

      {/* Pending overrides */}
      {data.pendingOverrides.length > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-amber-600">
            <ShieldCheck className="size-4" />
            AI tasdiq so&apos;rovlari
          </h2>
          <div className="space-y-3">
            {data.pendingOverrides.map((o) => (
              <div key={o.id} className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
                <p className="text-sm font-medium">Kelishuv / override · {o.type}</p>
                {o.debtorMessage && <p className="mt-1 text-sm italic text-muted-foreground">&ldquo;{o.debtorMessage}&rdquo;</p>}
                {o.autoExecuteAt && (
                  <p className="mt-1 text-xs text-muted-foreground">Avto-ijro: {fmtTime(o.autoExecuteAt)}</p>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => decideOverride(o.id, "approved")}
                    disabled={pending}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs text-white hover:opacity-90"
                  >
                    Tasdiqlash
                  </button>
                  <button
                    type="button"
                    onClick={() => decideOverride(o.id, "rejected")}
                    disabled={pending}
                    className="rounded-lg border px-3 py-1.5 text-xs hover:bg-muted"
                  >
                    Rad etish
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity log */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Gavel className="size-4" />
          AI faollik jurnali
        </h2>
        <div className="rounded-xl border divide-y max-h-80 overflow-y-auto">
          {data.recentEvents.map((e) => (
            <div key={e.id} className="flex gap-3 px-4 py-3 text-sm">
              <span className="shrink-0 text-xs text-muted-foreground w-24">{fmtTime(e.createdAt)}</span>
              <span className="font-mono text-xs text-primary">{e.eventType}</span>
              <span className="text-muted-foreground truncate">{JSON.stringify(e.detail ?? {}).slice(0, 80)}</span>
            </div>
          ))}
          {data.recentEvents.length === 0 && <p className="p-4 text-sm text-muted-foreground">Hozircha voqealar yo&apos;q</p>}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border p-5">
      <div className="mb-3">{icon}</div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function Badge({ text, cls }: { text: string; cls: string }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", cls)}>{text}</span>;
}
