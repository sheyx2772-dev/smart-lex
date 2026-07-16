"use client";

import {
  ArrowRight,
  Brain,
  CheckCircle,
  ClockCountdown,
  Lightning,
  PaperPlaneRight,
  Robot,
  SealCheck,
  ShieldWarning,
  Sparkle,
  Spinner,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { sendChat } from "@/app/(app)/chat/actions";
import { StatTile } from "@/components/dashboard/stat-tile";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Amount {
  minor: string;
  formatted: string;
}
interface Item {
  id: string;
  contractorId: string;
  contractorName: string;
  contractorTin: string;
  invoiceNumber: string;
  status: string;
  overdueDays: number;
  agingBucket: string;
  outstanding: Amount;
  penalty: Amount;
  invoiceAmount: Amount;
  penaltyDailyBps: number;
  outstandingRatio: number;
  riskScore: number;
  riskBand: "low" | "medium" | "high";
  factors: { label: string; points: number }[];
  done: string[];
  recommendation: { stage: string; requiresApproval: boolean } | null;
  scheduled: { stage: string; requiresApproval: boolean; inDays: number } | null;
  pendingApproval: string | null;
}
export interface ConsoleData {
  currency: string;
  summary: { analyzed: number; overdue: number; needsAction: number; needsApproval: number; highRisk: number } | null;
  items: Item[];
}

const RISK_TONE: Record<string, string> = {
  low: "text-success bg-success-soft",
  medium: "text-warning bg-warning-soft",
  high: "text-danger bg-danger-soft",
};
const FACTOR_MAX: Record<string, number> = {
  overdue_days: 40,
  outstanding_ratio: 25,
  late_payment_history: 20,
  prior_demands: 15,
};

export function AgentConsoleClient({ initial }: { initial: ConsoleData }) {
  const t = useTranslations("agentConsole");
  const tStage = useTranslations("stage");
  const [data, setData] = useState<ConsoleData>(initial);
  const [running, setRunning] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [cmd, setCmd] = useState("");
  const [cmdReply, setCmdReply] = useState<string | null>(null);
  const [cmdLoading, setCmdLoading] = useState(false);

  async function runCommand() {
    const q = cmd.trim();
    if (!q || cmdLoading) return;
    setCmdLoading(true);
    setCmdReply(null);
    try {
      const res = await sendChat(q);
      setCmdReply(res.reply);
    } catch {
      setCmdReply(t("cmdError"));
    } finally {
      setCmdLoading(false);
    }
  }

  async function runAgent() {
    setRunning(true);
    setFlash(null);
    try {
      const res = await fetch("/api/agent-run", { method: "POST" }).then((r) => r.json());
      const fresh = await fetch("/api/agent-console").then((r) => r.json());
      setData(fresh);
      setFlash(t("ranSummary", { analyzed: res.analyzed ?? 0, updated: res.riskUpdated ?? 0, actions: res.needsAction ?? 0 }));
    } finally {
      setRunning(false);
    }
  }

  const s = data.summary;

  return (
    <div className="space-y-6 pb-8">
      {/* Sarlavha + agent run */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-secondary text-white shadow-lg shadow-primary/30">
            <Robot weight="fill" className="size-6" />
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight">{t("title")}</h2>
            <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>
        <button
          onClick={runAgent}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-primary to-secondary px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition-all hover:shadow-xl disabled:opacity-70"
        >
          {running ? <Spinner className="size-4 animate-spin" /> : <Lightning weight="fill" className="size-4" />}
          {running ? t("running") : t("runAgent")}
        </button>
      </div>

      {/* Chat-buyruq qatori — agentga to'g'ridan-to'g'ri buyruq beriladi */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          runCommand();
        }}
      >
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-1.5 shadow-sm focus-within:border-primary/40">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-secondary text-white">
            <Sparkle weight="fill" className="size-4" />
          </span>
          <input
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            placeholder={t("cmdPlaceholder")}
            className="min-w-0 flex-1 bg-transparent px-1 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={!cmd.trim() || cmdLoading}
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {cmdLoading ? <Spinner className="size-4 animate-spin" /> : <PaperPlaneRight weight="fill" className="size-4" />}
          </button>
        </div>
      </form>

      {cmdReply && (
        <div className="flex gap-2.5 rounded-lg border border-border bg-muted/40 p-3">
          <Robot weight="fill" className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{cmdReply}</p>
        </div>
      )}

      {flash && (
        <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success-soft px-4 py-2.5 text-sm text-success">
          <CheckCircle weight="fill" className="size-4 shrink-0" /> {flash}
        </div>
      )}

      {/* Xulosa */}
      {s && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label={t("analyzed")} value={String(s.analyzed)} icon={<Brain className="size-4" weight="fill" />} tone="primary" plain />
          <StatTile label={t("overdue")} value={String(s.overdue)} icon={<ClockCountdown className="size-4" weight="fill" />} tone="warning" plain />
          <StatTile label={t("needsApproval")} value={String(s.needsApproval)} icon={<SealCheck className="size-4" weight="fill" />} tone="secondary" plain />
          <StatTile label={t("highRisk")} value={String(s.highRisk)} icon={<ShieldWarning className="size-4" weight="fill" />} tone="danger" plain />
        </div>
      )}

      {/* Reasoning kartalar — har debitorlik uchun agent fikri */}
      <div className="space-y-4">
        {data.items.length === 0 && (
          <div className="grid h-40 place-items-center text-sm text-muted-foreground">{t("empty")}</div>
        )}
        {data.items.map((it) => (
          <Card key={it.id} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="grid gap-0 lg:grid-cols-[1.1fr_1fr]">
                {/* Chap: fakt + risk reasoning */}
                <div className="border-b border-border p-5 lg:border-b-0 lg:border-r">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-display text-base font-semibold">{it.contractorName}</p>
                      <p className="tabular text-xs text-muted-foreground">
                        {it.invoiceNumber} · {it.contractorTin}
                      </p>
                    </div>
                    <span className={cn("shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold", RISK_TONE[it.riskBand])}>
                      {t("risk")} {it.riskScore} · {t(`band_${it.riskBand}` as never)}
                    </span>
                  </div>

                  {/* Faktlar */}
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <Fact label={t("overdueDays")} value={`${it.overdueDays} ${t("days")}`} />
                    <Fact label={t("outstanding")} value={it.outstanding.formatted} />
                    <Fact label={t("penalty")} value={it.penalty.formatted} />
                  </div>

                  {/* Risk omillari — "AI qanday o'ylaydi" */}
                  <div className="mt-4">
                    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <Brain className="size-3.5" /> {t("reasoning")}
                    </p>
                    <div className="space-y-1.5">
                      {it.factors.map((f) => (
                        <div key={f.label} className="flex items-center gap-2">
                          <span className="w-32 shrink-0 text-[11px] text-muted-foreground">{t(`factor_${f.label}` as never)}</span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary/70"
                              style={{ width: `${Math.min(100, (f.points / (FACTOR_MAX[f.label] ?? 40)) * 100)}%` }}
                            />
                          </div>
                          <span className="w-6 shrink-0 text-right tabular text-[11px] font-medium">{f.points}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* O'ng: agent rejasi (bajardi → keyingi) */}
                <div className="flex flex-col justify-between gap-4 bg-muted/30 p-5">
                  <div>
                    <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <Robot className="size-3.5" /> {t("agentPlan")}
                    </p>
                    <div className="space-y-2">
                      {it.done.length === 0 && !it.recommendation && !it.scheduled && (
                        <p className="text-xs text-muted-foreground">{t("nothingYet")}</p>
                      )}
                      {it.done.map((st) => (
                        <div key={st} className="flex items-center gap-2 text-sm">
                          <CheckCircle weight="fill" className="size-4 shrink-0 text-success" />
                          <span className="text-muted-foreground line-through">{tStage(st as never)}</span>
                        </div>
                      ))}
                      {it.recommendation && (
                        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary-soft px-2.5 py-2 text-sm">
                          <Lightning weight="fill" className="size-4 shrink-0 text-primary" />
                          <span className="flex-1 font-medium text-primary">{tStage(it.recommendation.stage as never)}</span>
                          <span className="text-[11px] font-semibold uppercase text-primary/70">{t("now")}</span>
                        </div>
                      )}
                      {!it.recommendation && it.scheduled && (
                        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-sm">
                          <ClockCountdown className="size-4 shrink-0 text-muted-foreground" />
                          <span className="flex-1 font-medium">{tStage(it.scheduled.stage as never)}</span>
                          <span className="tabular text-[11px] text-muted-foreground">
                            {t("inDays", { days: it.scheduled.inDays })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Harakat */}
                  {(it.pendingApproval || it.recommendation?.requiresApproval || it.scheduled?.requiresApproval) && (
                    <Link
                      href="/approvals"
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      <SealCheck className="size-4" />
                      {it.pendingApproval ? t("reviewPending") : t("willNeedApproval")}
                      <ArrowRight className="size-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 tabular text-sm font-semibold">{value}</p>
    </div>
  );
}
