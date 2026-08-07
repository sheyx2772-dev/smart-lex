"use client";

import { ArrowLeft, CheckCircle, Circle, Clock } from "@phosphor-icons/react";
import Link from "next/link";

interface CaseDetailData {
  case: {
    id: string;
    number: string;
    state: string;
    dsScore: number;
    recoveryProbability: number;
    optimalSettlementPct: number;
    estimatedRecoveryDays: number;
    scoreFactors: { label: string; impact: number }[];
  };
  debtor: { name: string; tin: string } | null;
  debt: { formatted: string; overdueDays: number; invoiceNumber?: string } | null;
  playbook: {
    strategyType: string;
    currentPhase: number;
    progress: number;
    phases: { phase: number; name: string; durationDays: number }[];
  } | null;
  events: { eventType: string; detail: Record<string, unknown> | null; createdAt: string | null }[];
}

export function CommandCenterCaseDetail({ data }: { data: CaseDetailData | null }) {
  if (!data) {
    return <p className="text-muted-foreground">Ish topilmadi</p>;
  }

  const { case: c, debtor, debt, playbook, events } = data;
  const settlementAmount = debt
    ? `${Math.round((c.optimalSettlementPct / 100) * parseFloat(debt.formatted.replace(/[^\d]/g, "") || "0")).toLocaleString("uz-UZ")} so'm (${c.optimalSettlementPct}%)`
    : "—";

  return (
    <div className="space-y-6">
      <Link href="/command-center" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Command Center
      </Link>

      <div>
        <p className="text-xs text-muted-foreground">QARZ ISHI #{c.number}</p>
        <h1 className="text-2xl font-semibold">{debtor?.name ?? "—"} · {debt?.formatted ?? "—"}</h1>
      </div>

      {/* Playbook progress */}
      {playbook && (
        <div className="rounded-xl border p-6 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium">AI Recovery Playbook</p>
              <p className="text-xs text-muted-foreground">
                Bosqich {playbook.currentPhase} / {playbook.phases.length}: {playbook.phases[playbook.currentPhase - 1]?.name ?? "—"}
              </p>
            </div>
            <span className="text-sm font-mono">{playbook.progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${playbook.progress}%` }} />
          </div>

          <div className="space-y-2 pt-2">
            {playbook.phases.map((ph) => {
              const done = ph.phase < playbook.currentPhase;
              const current = ph.phase === playbook.currentPhase;
              return (
                <div key={ph.phase} className="flex items-center gap-3 text-sm">
                  {done ? (
                    <CheckCircle weight="fill" className="size-4 text-emerald-500 shrink-0" />
                  ) : current ? (
                    <Clock weight="fill" className="size-4 text-primary shrink-0" />
                  ) : (
                    <Circle className="size-4 text-muted-foreground shrink-0" />
                  )}
                  <span className={done ? "text-muted-foreground line-through" : current ? "font-medium" : "text-muted-foreground"}>
                    {ph.name} ({ph.durationDays} kun)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Prediction */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="DS-Score" value={`${c.dsScore}/100`} />
        <Stat label="Undirish ehtimoli" value={`${c.recoveryProbability}%`} />
        <Stat label="Optimal kelishuv" value={settlementAmount} />
        <Stat label="Taxminiy muddat" value={`${c.estimatedRecoveryDays} kun`} />
        <Stat label="Holat" value={c.state} />
        <Stat label="Hisob-faktura" value={debt?.invoiceNumber ?? "—"} />
      </div>

      {/* Score factors */}
      {c.scoreFactors.length > 0 && (
        <div className="rounded-xl border p-5">
          <p className="text-sm font-medium mb-3">DS-Score omillari</p>
          <div className="space-y-2">
            {c.scoreFactors.map((f) => (
              <div key={f.label} className="flex justify-between text-sm">
                <span>{f.label}</span>
                <span className={f.impact >= 0 ? "text-emerald-600" : "text-red-500"}>{f.impact > 0 ? "+" : ""}{f.impact}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity log */}
      <div className="rounded-xl border divide-y">
        <p className="px-4 py-3 text-sm font-medium">AI faollik (so&apos;nggi 24 soat)</p>
        {events.map((e, i) => (
          <div key={i} className="px-4 py-2 text-sm flex gap-3">
            <span className="text-xs text-muted-foreground shrink-0">
              {e.createdAt ? new Intl.DateTimeFormat("uz-UZ", { hour: "2-digit", minute: "2-digit" }).format(new Date(e.createdAt)) : ""}
            </span>
            <span className="font-mono text-xs text-primary">{e.eventType}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
