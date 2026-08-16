"use client";

import {
  ArrowLineDown,
  ArrowLineUp,
  ArrowRight,
  Brain,
  ChartLineUp,
  CircleNotch,
  Clock,
  Eye,
  Gavel,
  Lightning,
  PaperPlaneTilt,
  Play,
  Power,
  Robot,
  Scales,
  ShieldCheck,
  Sparkle,
} from "@phosphor-icons/react";
import Link from "next/link";
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
interface DebtorRow {
  id: string;
  contractorId: string;
  name: string;
  tin: string;
  invoiceNumber: string;
  outstanding: string;
  overdueDays: number;
  action: string;
  actionTone: "primary" | "warning" | "brand" | "danger" | "muted";
}
export interface AutopilotData {
  config: { mode: Mode; aggressiveness: Aggr };
  feed: FeedItem[];
  stats: { decisionsToday: number; remindersToday: number; escalationsToday: number; avgRecovery: number | null };
  recovery?: { recoveredMinor: string; outstandingMinor: string; recoveryRate: number | null };
  balance?: { currency: string; debit: string; kredit: string; monitored: string };
  debtors?: DebtorRow[];
}

const ACTION_TONE_CLASS: Record<DebtorRow["actionTone"], string> = {
  primary: "bg-primary/10 text-primary",
  warning: "bg-warning-soft text-warning",
  brand: "bg-brand/10 text-brand",
  danger: "bg-red-500/15 text-red-500",
  muted: "bg-muted text-muted-foreground",
};

// Intl.NumberFormat("uz-UZ") ISHLATILMAYDI — server (Node ICU) va klient (brauzer)
// har xil natija berishi mumkin (masalan "6,000,000" vs "6 000 000"), bu esa
// hydration xatosiga olib keladi. Shuning uchun guruhlash qo'lda, aniq qilinadi.
const som = (minor: string | undefined) => {
  const major = BigInt(minor ?? "0") / 100n;
  return major.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " so'm";
};

const MODES: { key: Mode; label: string; desc: string; icon: typeof Power }[] = [
  { key: "off", label: "O'chirilgan", desc: "Agent faqat kuzatadi, hech narsa qilmaydi", icon: Power },
  { key: "suggest", label: "Taklif", desc: "Qaror qiladi va tayyorlaydi — siz tasdiqlaysiz (yubormaydi)", icon: Eye },
  { key: "auto", label: "Avtonom", desc: "Agent o'zi yuboradi va eskalatsiya qiladi", icon: Lightning },
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

interface ScoreFactor {
  label: string;
  impact: number;
}

function feedVisual(it: FeedItem): { icon: React.ReactNode; title: string; sub?: string; badges: { text: string; cls: string }[]; factors?: ScoreFactor[] } {
  const d = it.detail ?? {};
  const badges: { text: string; cls: string }[] = [];
  if (it.action === "agent.decision") {
    const rec = Number(d.recoveryScore);
    const pr = String(d.priority ?? "");
    if (Number.isFinite(rec))
      badges.push({ text: `undirish ${rec}%`, cls: rec >= 60 ? "bg-emerald-500/15 text-emerald-600" : rec >= 35 ? "bg-amber-500/15 text-amber-600" : "bg-red-500/15 text-red-500" });
    if (pr) badges.push({ text: pr === "high" ? "yuqori" : pr === "medium" ? "o'rta" : "past", cls: "bg-muted text-muted-foreground" });
    if (d.source === "ai") badges.push({ text: "AI", cls: "bg-primary/10 text-primary" });
    const factors = Array.isArray(d.factors) ? (d.factors as ScoreFactor[]).filter((f) => f && typeof f.label === "string" && typeof f.impact === "number") : undefined;
    return {
      icon: <Brain weight="fill" className="size-4 text-primary" />,
      title: `AI qaror: ${ACTION_UZ[String(d.action)] ?? String(d.action)}`,
      sub: String(d.reason ?? ""),
      badges,
      factors: factors && factors.length ? factors : undefined,
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [saving, startSave] = useTransition();
  const [running, startRun] = useTransition();

  const feed = initial?.feed ?? [];
  const stats = initial?.stats ?? { decisionsToday: 0, remindersToday: 0, escalationsToday: 0, avgRecovery: null };
  const balance = initial?.balance;
  const debtors = initial?.debtors ?? [];

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
            className="inline-flex items-center gap-2 rounded-2xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground shadow-lg shadow-brand/25 transition-transform hover:scale-[1.02] disabled:opacity-60"
          >
            {running ? <CircleNotch className="size-4 animate-spin" /> : <Play weight="fill" className="size-4" />}
            Hoziroq ishga tushir
          </button>
        </div>

        {/* Autonomy dial */}
        <div className="relative mt-6 grid gap-4 md:grid-cols-[1fr_auto]">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Avtonomiya rejimi {saving && <span className="ml-1 text-primary">saqlanmoqda…</span>}</p>
            <div className="grid grid-cols-3 gap-2.5">
              {MODES.map((m) => {
                const Ic = m.icon;
                const active = mode === m.key;
                return (
                  <button
                    key={m.key}
                    onClick={() => update({ mode: m.key })}
                    className={`group relative overflow-hidden rounded-2xl border-2 p-3.5 text-left transition-all ${
                      active
                        ? m.key === "auto"
                          ? "border-brand bg-brand/10 shadow-lg shadow-brand/20"
                          : "border-primary bg-primary/10 shadow-lg shadow-primary/20"
                        : "border-border bg-card hover:border-primary/40 hover:bg-primary-soft/20"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`grid size-9 shrink-0 place-items-center rounded-xl transition-colors ${
                          active ? (m.key === "auto" ? "bg-brand text-brand-foreground" : "bg-primary text-primary-foreground") : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Ic weight={active ? "fill" : "regular"} className="size-4.5" />
                      </span>
                      <span className={`font-display text-sm font-bold ${active ? (m.key === "auto" ? "text-brand" : "text-primary") : ""}`}>{m.label}</span>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-tight text-muted-foreground">{m.desc}</p>
                    {active && (
                      <span className={`absolute right-2.5 top-2.5 size-2 rounded-full ${m.key === "auto" ? "bg-brand" : "bg-primary"} animate-pulse`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Qattiqlik</p>
            <div className="inline-flex overflow-hidden rounded-2xl border-2 border-border">
              {AGGRS.map((a) => (
                <button
                  key={a.key}
                  onClick={() => update({ aggr: a.key })}
                  className={`px-3.5 py-3.5 text-sm font-bold transition-colors ${aggr === a.key ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
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

      {/* Debit / Kredit / Nazoratdagi umumiy summa */}
      {balance && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ArrowLineDown weight="fill" className="size-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wide">Debit</span>
            </div>
            <p className="tabular mt-1.5 font-display text-2xl font-extrabold tracking-tight">{balance.debit}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Sizga qarzdorlar</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ArrowLineUp weight="fill" className="size-4 text-warning" />
              <span className="text-xs font-semibold uppercase tracking-wide">Kredit</span>
            </div>
            <p className="tabular mt-1.5 font-display text-2xl font-extrabold tracking-tight">{balance.kredit}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Siz qarzdorsiz</p>
          </div>
          <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary-soft to-primary-soft/40 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-primary">
              <Scales weight="fill" className="size-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">Nazoratdagi summa</span>
            </div>
            <p className="tabular mt-1.5 font-display text-2xl font-extrabold tracking-tight text-primary">{balance.monitored}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">AI kuzatib turgan jami mablag&apos;</p>
          </div>
        </div>
      )}

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

      {/* Faol qarzdorlar — kechikish kuniga qarab tartiblangan, keyingi bosqich tavsiyasi bilan */}
      {debtors.length > 0 && (
        <div className="rounded-3xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck weight="fill" className="size-4 text-primary" />
            <h2 className="font-display text-base font-semibold">Faol qarzdorlar</h2>
            <span className="ml-auto text-xs text-muted-foreground">eng ko&apos;p kechikkan {debtors.length} ta</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Kompaniya</th>
                  <th className="py-2 pr-3 text-right font-medium">Summa</th>
                  <th className="py-2 pr-3 text-center font-medium">Kechikish</th>
                  <th className="py-2 pr-3 font-medium">Keyingi bosqich</th>
                  <th className="py-2 pl-3" />
                </tr>
              </thead>
              <tbody>
                {debtors.map((deb) => (
                  <tr key={deb.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                    <td className="py-2.5 pr-3">
                      <p className="font-medium">{deb.name}</p>
                      <p className="text-xs text-muted-foreground">{deb.tin} · {deb.invoiceNumber}</p>
                    </td>
                    <td className="tabular py-2.5 pr-3 text-right font-semibold">{deb.outstanding}</td>
                    <td className="tabular py-2.5 pr-3 text-center">
                      {deb.overdueDays > 0 ? <span className="font-semibold text-danger">{deb.overdueDays} kun</span> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${ACTION_TONE_CLASS[deb.actionTone]}`}>{deb.action}</span>
                    </td>
                    <td className="py-2.5 pl-3 text-right">
                      <Link href={`/companies/${deb.contractorId}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                        Ko&apos;rish <ArrowRight className="size-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
              const open = expanded.has(it.id);
              return (
                <li key={it.id} className="rounded-xl border border-border/50 bg-background/40 p-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-muted">{v.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{v.title}</span>
                        {v.badges.map((b, i) => (
                          <span key={i} className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${b.cls}`}>{b.text}</span>
                        ))}
                      </div>
                      {v.sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{v.sub}</p>}
                      {v.factors && (
                        <button
                          onClick={() => setExpanded((s) => { const n = new Set(s); if (n.has(it.id)) n.delete(it.id); else n.add(it.id); return n; })}
                          className="mt-1 text-[11px] font-medium text-primary hover:underline"
                        >
                          {open ? "Yashirish" : "Nega? (raqamli asos)"}
                        </button>
                      )}
                      {open && v.factors && (
                        <div className="mt-2 space-y-1 rounded-lg bg-muted/50 p-2.5">
                          {v.factors.map((f, i) => (
                            <div key={i} className="flex items-center gap-2 text-[11px]">
                              <span className="w-32 shrink-0 truncate text-muted-foreground">{f.label}</span>
                              <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                                <span
                                  className={`absolute top-0 h-full rounded-full ${f.impact >= 0 ? "bg-emerald-500 left-1/2" : "bg-red-500 right-1/2"}`}
                                  style={{ width: `${Math.min(50, Math.abs(f.impact) / 2)}%` }}
                                />
                              </span>
                              <span className={`w-9 shrink-0 text-right font-mono font-semibold ${f.impact >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                                {f.impact >= 0 ? "+" : ""}{f.impact}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{fmtTime(it.createdAt)}</span>
                  </div>
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
