"use client";

import { CheckCircle, Gauge, Info, ShieldCheck, Warning, XCircle } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ScoringInput {
  id: string;
  name: string;
  tin: string;
  invoiceNumber: string;
  overdueDays: number;
  outstandingMinor: string;
  invoiceMinor: string;
  reminderCount: number;
}

type Rating = "A" | "B" | "C" | "D";
interface Factor {
  key: "punctuality" | "burden" | "history";
  value: number;
}
interface Scored extends ScoringInput {
  score: number;
  rating: Rating;
  factors: Factor[];
}

const RATING_TONE: Record<Rating, BadgeProps["tone"]> = { A: "success", B: "primary", C: "warning", D: "danger" };
const RATING_COLOR: Record<Rating, string> = {
  A: "var(--color-success)",
  B: "var(--color-primary)",
  C: "var(--color-warning)",
  D: "var(--color-danger)",
};

function scoreClient(c: ScoringInput): Scored {
  const punctuality = Math.max(0, Math.min(100, 100 - c.overdueDays * 1.5));
  const inv = Number(c.invoiceMinor) || 1;
  const ratio = Number(c.outstandingMinor) / inv;
  const burden = Math.max(0, Math.min(100, 100 - ratio * 60));
  const history = Math.max(0, Math.min(100, 100 - c.reminderCount * 15));
  const score = Math.round(0.4 * punctuality + 0.35 * burden + 0.25 * history);
  const rating: Rating = score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : "D";
  return {
    ...c,
    score,
    rating,
    factors: [
      { key: "punctuality", value: Math.round(punctuality) },
      { key: "burden", value: Math.round(burden) },
      { key: "history", value: Math.round(history) },
    ],
  };
}

export function ScoringClient({ clients }: { clients: ScoringInput[] }) {
  const t = useTranslations("scoring");
  const scored = clients.map(scoreClient).sort((a, b) => a.score - b.score);
  const [selectedId, setSelectedId] = useState<string | null>(scored[0]?.id ?? null);
  const selected = scored.find((s) => s.id === selectedId) ?? null;

  const dist: Record<Rating, number> = { A: 0, B: 0, C: 0, D: 0 };
  scored.forEach((s) => dist[s.rating]++);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="mb-4">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Reyting taqsimoti */}
      <div className="mb-4 grid grid-cols-4 gap-3">
        {(["A", "B", "C", "D"] as Rating[]).map((r) => (
          <div key={r} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t(`rating.${r}` as never)}</span>
              <span className="grid size-6 place-items-center rounded-md text-xs font-bold text-white" style={{ background: RATING_COLOR[r] }}>
                {r}
              </span>
            </div>
            <p className="tabular mt-1 font-display text-2xl font-semibold">{dist[r]}</p>
          </div>
        ))}
      </div>

      {scored.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">{t("empty")}</div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[360px_1fr]">
          {/* Ro'yxat */}
          <div className="scroll-clean min-h-0 space-y-2 overflow-y-auto pr-1">
            {scored.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                  selected?.id === s.id ? "border-primary bg-primary-soft/40" : "border-border bg-card hover:bg-muted/50",
                )}
              >
                <ScoreRing score={s.score} rating={s.rating} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.invoiceNumber}</p>
                </div>
                <Badge tone={RATING_TONE[s.rating]}>{s.rating}</Badge>
              </button>
            ))}
          </div>

          {/* Detal */}
          <div className="min-h-0">
            {selected && <ScoreDetail s={selected} t={t} />}
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreRing({ score, rating, size }: { score: number; rating: Rating; size: number }) {
  const color = RATING_COLOR[rating];
  return (
    <span
      className="relative grid shrink-0 place-items-center rounded-full"
      style={{ width: size, height: size, background: `conic-gradient(${color} ${score * 3.6}deg, var(--color-muted) 0deg)` }}
    >
      <span className="grid place-items-center rounded-full bg-card" style={{ width: size - 8, height: size - 8 }}>
        <span className="tabular font-display text-xs font-bold">{score}</span>
      </span>
    </span>
  );
}

function ScoreDetail({ s, t }: { s: Scored; t: ReturnType<typeof useTranslations> }) {
  const RATING_ICON = { A: ShieldCheck, B: CheckCircle, C: Warning, D: XCircle } as const;
  const Ic = RATING_ICON[s.rating];
  return (
    <Card className="flex h-full min-h-0 flex-col overflow-y-auto p-6">
      <div className="flex items-center gap-4">
        <ScoreRing score={s.score} rating={s.rating} size={72} />
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold">{s.name}</h2>
          <p className="text-sm text-muted-foreground">
            {t("tin")}: {s.tin} · {s.invoiceNumber}
          </p>
          <div className="mt-1.5">
            <Badge tone={RATING_TONE[s.rating]}>
              <Ic weight="fill" className="size-3.5" /> {t(`rating.${s.rating}` as never)}
            </Badge>
          </div>
        </div>
      </div>

      {/* Faktorlar */}
      <div className="mt-5 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("factors")}</p>
        {s.factors.map((f) => (
          <div key={f.key}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span>{t(`factor.${f.key}` as never)}</span>
              <span className="tabular font-medium">{f.value}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${f.value}%`, background: f.value >= 65 ? "var(--color-success)" : f.value >= 50 ? "var(--color-warning)" : "var(--color-danger)" }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Tavsiya */}
      <div className={cn("mt-5 rounded-lg border p-3", s.rating === "A" || s.rating === "B" ? "border-success/30 bg-success-soft" : s.rating === "C" ? "border-warning/30 bg-warning-soft" : "border-danger/30 bg-danger-soft")}>
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Gauge weight="fill" className="size-4" /> {t("recommendation")}
        </p>
        <p className="mt-1 text-sm">{t(`advice.${s.rating}` as never)}</p>
      </div>

      <p className="mt-4 flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" /> {t("externalNote")}
      </p>
    </Card>
  );
}
