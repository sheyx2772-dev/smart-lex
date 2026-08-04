"use client";

import { Brain, ChartLineUp, CircleNotch, Clock, Gavel, PaperPlaneTilt, Play, Robot, ShieldCheck, Sparkle } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { runAgentNow, saveAgentConfig } from "@/app/(app)/agent/actions";

type Mode = "off" | "suggest" | "auto";
type Aggr = "soft" | "normal" | "aggressive";

interface FeedItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  detail: Record<string, unknown> | null;
  createdAt: string | null;
}
export interface AutopilotData {
  config: { mode: Mode; aggressiveness: Aggr };
  feed: FeedItem[];
  stats: { decisionsToday: number; remindersToday: number; escalationsToday: number; avgRecovery: number | null };
  recovery?: { recoveredMinor: string; outstandingMinor: string; recoveryRate: number | null };
}

// Intl.NumberFormat("uz-UZ") ISHLATILMAYDI — server (Node ICU) va klient (brauzer)
// har xil natija berishi mumkin (masalan "6,000,000" vs "6 000 000"), bu esa
// hydration xatosiga olib keladi. Shuning uchun guruhlash qo'lda, aniq qilinadi.
const som = (minor: string | undefined) => {
  const major = BigInt(minor ?? "0") / 100n;
  return major.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " so'm";
};

const MODES: { key: Mode; label: string; desc: string }[] = [
  { key: "off", label: "O'chirilgan", desc: "Agent faqat kuzatadi, hech narsa qilmaydi" },
  { key: "suggest", label: "Taklif", desc: "Qaror qiladi va tayyorlaydi — siz tasdiqlaysiz (yubormaydi)" },
  { key: "auto", label: "Avtonom", desc: "Agent o'zi yuboradi va eskalatsiya qiladi" },
];
const AGGRS: { key: Aggr; label: string }[] = [
  { key: "soft", label: "Yumshoq" },
  { key: "normal", label: "Normal" },
  { key: "aggressive", label: "Qattiq" },
];
const ACTION_UZ: Record<string, string> = {
  wait: "Kutish",
  soft_reminder: "Yumshoq eslatma",
  firm_reminder: "Qat'iy eslatma",
  call: "Qo'ng'iroq",
  demand_letter: "Talabnoma",
  court: "Sud",
  settlement_offer: "Kelishuv taklifi",
};

const fmtTime = (d: string | null) =>
  d ? new Intl.DateTimeFormat("uz-UZ", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(d)) : "";

function feedVisual(it: FeedItem): { icon: React.ReactNode; title: string; sub?: string; badges: { text: string; cls: string }[] } {
  const d = it.detail ?? {};
  const badges: { text: string; cls: string }[] = [];
  if (it.action === "agent.decision") {
    const rec = Number(d.recoveryScore);
    const pr = String(d.priority ?? "");
    if (Number.isFinite(rec))
      badges.push({ text: `undirish ${rec}%`, cls: rec >= 60 ? "bg-emerald-500/15 text-emerald-600" : rec >= 35 ? "bg-amber-500/15 text-amber-600" : "bg-red-500/15 text-red-500" });
    if (pr) badges.push({ text: pr === "high" ? "yuqori" : pr === "medium" ? "o'rta" : "past", cls: "bg-muted text-muted-foreground" });
    if (d.source === "ai") badges.push({ text: "AI", cls: "bg-primary/10 text-primary" });
    return {
      icon: <Brain weight="fill" className="size-4 text-primary" />,
      title: `AI qaror: ${ACTION_UZ[String(d.action)] ?? String(d.action)}`,
      sub: String(d.reason ?? ""),
      badges,
    };
  }
  if (it.action === "agent.suggested")
    return {
      icon: <PaperPlaneTilt className="size-4 text-amber-500" />,
      title: `Taklif: ${ACTION_UZ[String(d.stage)] ?? String(d.stage)} · ${String(d.channel ?? "")}`,
      sub: String(d.draft ?? "").slice(0, 120),
      badges: [{ text: "tasdiq kutmoqda", cls: "bg-amber-500/15 text-amber-600" }],
    };
  if (it.action === "reminder.sent")
    return {
      icon: <PaperPlaneTilt weight="fill" className="size-4 text-emerald-500" />,
      title: `Yuborildi: ${ACTION_UZ[String(d.stage)] ?? String(d.stage)} · ${String(d.channel ?? "")}`,
      badges: [{ text: "yuborildi", cls: "bg-emerald-500/15 text-emerald-600" }],
    };
  if (it.action === "demand.generated")
    return { icon: <Gavel weight="fill" className="size-4 text-primary" />, title: "Talabnoma tayyorlandi", badges: [{ text: "tasdiq kutmoqda", cls: "bg-amber-500/15 text-amber-600" }] };
  if (it.action === "court.requested")
    return { icon: <Gavel weight="fill" className="size-4 text-red-500" />, title: "Sud bosqichi so'raldi", badges: [{ text: "tasdiq kutmoqda", cls: "bg-amber-500/15 text-amber-600" }] };
  return { icon: <Sparkle className="size-4 text-muted-foreground" />, title: it.action, badges: [] };
}

export function AgentAutopilot({ initial }: { initial: AutopilotData | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initial?.config.mode ?? "suggest");
  const [aggr, setAggr] = useState<Aggr>(initial?.config.aggressiveness ?? "normal");
  const [saving, startSave] = useTransition();
  const [running, startRun] = useTransition();

  const feed = initial?.feed ?? [];
  const stats = initial?.stats ?? { decisionsToday: 0, remindersToday: 0, escalationsToday: 0, avgRecovery: null };

  function update(next: { mode?: Mode; aggr?: Aggr }) {
    const m = next.mode ?? mode;
    const a = next.aggr ?? aggr;
    setMode(m);
    setAggr(a);
    startSave(async () => {
      await saveAgentConfig(m, a);
      router.refresh();
    });
  }
  function runNow() {
    startRun(async () => {
      await runAgentNow();
      router.refresh();
    });
  }

  const recovery = initial?.recovery;

  return (
    <div className="space-y-5">
      {/* ROI hero — undirildi (investor dalili) */}
      {recovery && (
        <div className="relative overflow-hidden rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/12 via-card to-card p-6">
          <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-emerald-500/15 blur-3xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-600">
                <ChartLineUp weight="fill" className="size-4" /> Agent undirdi
              </p>
              <p className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{som(recovery.recoveredMinor)}</p>
              <p className="mt-1 text-sm text-muted-foreground">Undirilmagan qoldiq: {som(recovery.outstandingMinor)}</p>
            </div>
            {recovery.recoveryRate !== null && (
              <div className="text-right">
                <p className="font-display text-3xl font-bold text-emerald-600">{recovery.recoveryRate}%</p>
                <p className="text-xs text-muted-foreground">undirish darajasi</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header + autonomy */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/12 via-card to-card p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <Robot weight="fill" className="size-6" />
            </span>
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight">AI Undiruv Agenti</h1>
              <p className="text-sm text-muted-foreground">Qarzlarni o'zi kuzatadi, qaror qiladi va undiradi — siz nazorat qilasiz</p>
            </div>
          </div>
          <button
            onClick={runNow}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:scale-[1.02] disabled:opacity-60"
          >
            {running ? <CircleNotch className="size-4 animate-spin" /> : <Play weight="fill" className="size-4" />}
            Hoziroq ishga tushir
          </button>
        </div>

        {/* Autonomy dial */}
        <div className="relative mt-6 grid gap-4 md:grid-cols-[1fr_auto]">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Avtonomiya rejimi {saving && <span className="ml-1 text-primary">saqlanmoqda…</span>}</p>
            <div className="grid grid-cols-3 gap-2">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  onClick={() => update({ mode: m.key })}
                  className={`rounded-xl border p-3 text-left transition-all ${mode === m.key ? "border-primary bg-primary/10 shadow-sm" : "border-border bg-card hover:border-primary/40"}`}
                >
                  <div className="flex items-center gap-1.5 text-sm font-bold">
                    {m.key === "off" ? "○" : m.key === "suggest" ? "◐" : "●"} {m.label}
                  </div>
                  <p className="mt-1 text-[11px] leading-tight text-muted-foreground">{m.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Qattiqlik</p>
            <div className="inline-flex overflow-hidden rounded-xl border border-border">
              {AGGRS.map((a) => (
                <button
                  key={a.key}
                  onClick={() => update({ aggr: a.key })}
                  className={`px-3 py-3 text-sm font-semibold transition-colors ${aggr === a.key ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {mode === "auto" && (
          <p className="relative mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-600">
            <ShieldCheck weight="fill" className="size-3.5" /> Avtonom rejim: agent qarzdorlarga o'zi xabar yuboradi
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={<Brain weight="fill" className="size-4" />} label="Bugungi qarorlar" value={stats.decisionsToday} />
        <Stat icon={<PaperPlaneTilt weight="fill" className="size-4" />} label="Yuborilgan" value={stats.remindersToday} />
        <Stat icon={<Gavel weight="fill" className="size-4" />} label="Eskalatsiya" value={stats.escalationsToday} />
        <Stat
          icon={<ChartLineUp weight="fill" className="size-4" />}
          label="AI ehtimol bahosi"
          value={stats.avgRecovery === null ? "—" : `${stats.avgRecovery}%`}
        />
      </div>

      {/* Live feed */}
      <div className="rounded-3xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Clock weight="fill" className="size-4 text-primary" />
          <h2 className="font-display text-base font-semibold">Agent nima qildi</h2>
          <span className="ml-auto text-xs text-muted-foreground">so'nggi {feed.length}</span>
        </div>
        {feed.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Hali harakat yo'q — «Hoziroq ishga tushir»ni bosing.</p>
        ) : (
          <ul className="space-y-1.5">
            {feed.map((it) => {
              const v = feedVisual(it);
              return (
                <li key={it.id} className="flex items-start gap-3 rounded-xl border border-border/50 bg-background/40 p-3">
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-muted">{v.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{v.title}</span>
                      {v.badges.map((b, i) => (
                        <span key={i} className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${b.cls}`}>{b.text}</span>
                      ))}
                    </div>
                    {v.sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{v.sub}</p>}
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{fmtTime(it.createdAt)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1.5 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}
