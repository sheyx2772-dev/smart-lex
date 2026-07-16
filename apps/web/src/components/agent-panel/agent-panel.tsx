"use client";

import {
  ArrowRight,
  Bell,
  CaretRight,
  CheckCircle,
  CurrencyCircleDollar,
  FileText,
  Gavel,
  GearSix,
  type Icon,
  Robot,
  SealCheck,
  ShieldWarning,
  Sparkle,
  UserCircle,
  X,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// ── Tiplar ──────────────────────────────────────────────────────────
export interface AgentEvent {
  id: string;
  actorType: "user" | "ai_agent" | "system";
  actorName: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  detail: Record<string, unknown> | null;
  createdAt: string;
}
export interface AgentApproval {
  id: string;
  type: string;
  contractorName: string | null;
  invoiceNumber: string | null;
  overdueDays: number | null;
  createdAt: string;
}

interface Props {
  initialFeed: AgentEvent[];
  initialApprovals: AgentApproval[];
}

// ── Harakat → ikonka (action prefiksiga qarab) ──────────────────────
const ACTION_ICON: { match: RegExp; icon: Icon }[] = [
  { match: /^reminder/, icon: Bell },
  { match: /^demand/, icon: FileText },
  { match: /^court/, icon: Gavel },
  { match: /^payment/, icon: CurrencyCircleDollar },
  { match: /^document/, icon: SealCheck },
  { match: /^contract/, icon: FileText },
  { match: /^reconciliation/, icon: FileText },
  { match: /^approval/, icon: SealCheck },
  { match: /^settings/, icon: GearSix },
  { match: /^user/, icon: UserCircle },
];
function actionIcon(action: string): Icon {
  return ACTION_ICON.find((a) => a.match.test(action))?.icon ?? Sparkle;
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export function AgentPanel({ initialFeed, initialApprovals }: Props) {
  const t = useTranslations("agentPanel");
  const tAudit = useTranslations("audit");
  const tApprovals = useTranslations("approvals");

  const [open, setOpen] = useState(false);
  const [feed, setFeed] = useState<AgentEvent[]>(initialFeed);
  const [approvals, setApprovals] = useState<AgentApproval[]>(initialApprovals);
  const [unseen, setUnseen] = useState(0);
  const [toasts, setToasts] = useState<AgentEvent[]>([]);

  // Ko'rilgan event ID'lari — yangi kelganini aniqlash uchun.
  const seenIds = useRef<Set<string>>(new Set(initialFeed.map((e) => e.id)));

  const actionLabel = useCallback(
    (a: string) => (tAudit.has(`action.${a}` as never) ? tAudit(`action.${a}` as never) : a),
    [tAudit],
  );

  // Yangi eventlar kelsa toast + hisoblagich.
  const ingest = useCallback((items: AgentEvent[], nextApprovals: AgentApproval[]) => {
    setApprovals(nextApprovals);
    setFeed(items);
    const fresh = items.filter((e) => !seenIds.current.has(e.id));
    if (fresh.length === 0) return;
    fresh.forEach((e) => seenIds.current.add(e.id));
    // Faqat AI agent harakatlarini "notification" qilamiz.
    const aiFresh = fresh.filter((e) => e.actorType === "ai_agent");
    if (aiFresh.length > 0) {
      setUnseen((n) => n + aiFresh.length);
      setToasts((cur) => [...aiFresh.slice(0, 3), ...cur].slice(0, 3));
    }
  }, []);

  // Polling — har 20s.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/agent-feed", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { items: AgentEvent[]; approvals: AgentApproval[] };
        if (alive) ingest(data.items ?? [], data.approvals ?? []);
      } catch {
        /* jim */
      }
    };
    tick();
    const id = setInterval(tick, 20_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [ingest]);

  // Toastlarni avtomatik yo'qotish.
  useEffect(() => {
    if (toasts.length === 0) return;
    const id = setTimeout(() => setToasts((cur) => cur.slice(0, -1)), 6000);
    return () => clearTimeout(id);
  }, [toasts]);

  const openPanel = useCallback(() => {
    setOpen(true);
    setUnseen(0);
    setToasts([]);
  }, []);

  const badge = unseen + approvals.length;
  const today = feed.filter((e) => isToday(e.createdAt));
  const earlier = feed.filter((e) => !isToday(e.createdAt));
  const aiTodayCount = today.filter((e) => e.actorType === "ai_agent").length;

  return (
    <>
      {/* ── Launcher — o'ng-pastdagi doimiy dumaloq tugma ────────── */}
      {!open && (
        <button
          onClick={openPanel}
          aria-label={t("open")}
          className="group fixed bottom-6 right-6 z-[55] grid size-14 place-items-center rounded-full text-white shadow-xl shadow-primary/30 ring-1 ring-white/15 transition-all hover:scale-105 hover:shadow-primary/50"
          style={{ background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)" }}
        >
          <Robot weight="fill" className="size-7" />
          {/* Faol puls */}
          <span className="absolute -right-0.5 -top-0.5 flex size-3.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-300 opacity-70" />
            <span className="relative inline-flex size-3.5 rounded-full bg-emerald-400 ring-2 ring-[#5b21b6]" />
          </span>
          {/* Badge */}
          {badge > 0 && (
            <span className="absolute -left-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-danger px-1.5 text-[11px] font-bold text-white shadow-md shadow-danger/40 ring-2 ring-background">
              {badge}
            </span>
          )}
        </button>
      )}

      {/* ── Toast'lar — o'ngdan chiqadi (tugma ustida) ───────────── */}
      <div className="pointer-events-none fixed bottom-24 right-6 z-[54] flex w-[340px] max-w-[calc(100vw-3rem)] flex-col gap-2">
        {toasts.map((e) => {
          const Ic = actionIcon(e.action);
          return (
            <button
              key={e.id}
              onClick={openPanel}
              className="animate-toast-in pointer-events-auto flex items-center gap-3 rounded-xl border border-white/10 bg-[#1b2136]/95 p-3 text-left shadow-2xl backdrop-blur-md transition-transform hover:scale-[1.01]"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-secondary text-white shadow-md shadow-primary/40">
                <Ic weight="fill" className="size-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                  {t("newActivity")}
                </span>
                <span className="block truncate text-[13px] font-medium text-white">{actionLabel(e.action)}</span>
              </span>
              <CaretRight className="size-4 shrink-0 text-white/40" />
            </button>
          );
        })}
      </div>

      {/* ── Slide-over panel ─────────────────────────────────────── */}
      {open && (
        <button
          aria-label={t("close")}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[58] cursor-default bg-slate-950/30 backdrop-blur-[2px]"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[60] flex w-[384px] max-w-[92vw] flex-col overflow-hidden text-white shadow-2xl transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        style={{ background: "linear-gradient(180deg, #232a44 0%, #1b2136 60%, #171c2e 100%)" }}
        aria-hidden={!open}
      >
        {/* Ambient glow */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-64 opacity-70"
          style={{ background: "radial-gradient(120% 80% at 30% 0%, rgba(124,58,237,0.28), transparent 72%)" }}
        />

        {/* Header */}
        <div className="relative flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-primary to-secondary shadow-lg shadow-primary/30 ring-1 ring-white/10">
            <Robot weight="fill" className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[15px] font-semibold">{t("title")}</p>
            <p className="flex items-center gap-1.5 text-[11px] text-emerald-400">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
              </span>
              {t("subtitle")}
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="grid size-8 place-items-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            aria-label={t("close")}
          >
            <X className="size-[18px]" />
          </button>
        </div>

        <div className="scroll-clean relative flex-1 overflow-y-auto px-4 py-4">
          {/* AI bugun nechta ish bajardi */}
          {aiTodayCount > 0 && (
            <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3">
              <Sparkle weight="fill" className="size-4 shrink-0 text-secondary" />
              <p className="text-[13px] text-white/85">{t("worked", { count: aiTodayCount })}</p>
            </div>
          )}

          {/* ── Tasdiq kutayotganlar ─────────────────────────────── */}
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/45">
                <SealCheck weight="fill" className="size-3.5 text-amber-400" />
                {t("needsYou")}
              </p>
              {approvals.length > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-amber-400/20 px-1.5 text-[11px] font-semibold text-amber-300">
                  {approvals.length}
                </span>
              )}
            </div>
            {approvals.length === 0 ? (
              <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 text-[13px] text-white/40">
                <CheckCircle weight="fill" className="size-4 text-emerald-400/70" />
                {t("needsYouEmpty")}
              </div>
            ) : (
              <div className="space-y-2">
                {approvals.slice(0, 4).map((a) => (
                  <Link
                    key={a.id}
                    href="/approvals"
                    onClick={() => setOpen(false)}
                    className="group flex items-center gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3 transition-colors hover:border-amber-400/40 hover:bg-amber-400/[0.10]"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-400/15 text-amber-300">
                      <FileText weight="fill" className="size-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-white">
                        {tApprovals.has(`type.${a.type}` as never) ? tApprovals(`type.${a.type}` as never) : a.type}
                      </p>
                      <p className="truncate text-[11px] text-white/50">
                        {a.contractorName ?? "—"}
                        {a.overdueDays ? ` · ${a.overdueDays} ${tApprovals("days")}` : ""}
                      </p>
                    </div>
                    <span className="flex items-center gap-1 rounded-lg bg-amber-400 px-2.5 py-1.5 text-[11px] font-semibold text-slate-900 opacity-0 transition-opacity group-hover:opacity-100">
                      {t("review")} <ArrowRight className="size-3" />
                    </span>
                  </Link>
                ))}
                <Link
                  href="/approvals"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center gap-1 rounded-lg py-1.5 text-[12px] font-medium text-amber-300/80 hover:text-amber-300"
                >
                  {t("viewAll")} <ArrowRight className="size-3" />
                </Link>
              </div>
            )}
          </div>

          {/* ── Oqim ─────────────────────────────────────────────── */}
          {feed.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-white/40">{t("feedEmpty")}</p>
          ) : (
            <>
              {today.length > 0 && <FeedGroup label={t("feedToday")} events={today} actionLabel={actionLabel} tAudit={tAudit} />}
              {earlier.length > 0 && (
                <FeedGroup label={t("feedEarlier")} events={earlier} actionLabel={actionLabel} tAudit={tAudit} />
              )}
            </>
          )}
        </div>

        {/* Footer → to'liq audit */}
        <div className="relative border-t border-white/10 p-3">
          <Link
            href="/audit"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-white/[0.05] py-2.5 text-[12px] font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            {t("viewAll")} <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </aside>
    </>
  );
}

// ── Oqim guruhi ─────────────────────────────────────────────────────
function FeedGroup({
  label,
  events,
  actionLabel,
  tAudit,
}: {
  label: string;
  events: AgentEvent[];
  actionLabel: (a: string) => string;
  tAudit: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="mb-4">
      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/45">{label}</p>
      <ol className="relative space-y-0.5 before:absolute before:bottom-2 before:left-[19px] before:top-2 before:w-px before:bg-white/[0.08]">
        {events.map((e) => {
          const Ic = actionIcon(e.action);
          const isAi = e.actorType === "ai_agent";
          const actorName =
            e.actorType === "ai_agent"
              ? tAudit("actor.ai_agent")
              : e.actorType === "system"
                ? tAudit("actor.system")
                : (e.actorName ?? tAudit("actor.user"));
          return (
            <li key={e.id} className="relative flex items-start gap-3 rounded-xl px-1.5 py-2 transition-colors hover:bg-white/[0.04]">
              <span
                className={cn(
                  "relative z-10 grid size-9 shrink-0 place-items-center rounded-lg shadow-md",
                  isAi
                    ? "bg-gradient-to-br from-primary to-secondary text-white shadow-primary/30"
                    : "bg-white/[0.07] text-white/70",
                )}
              >
                <Ic weight="fill" className="size-[16px]" />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-[13px] font-medium leading-snug text-white">{actionLabel(e.action)}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/45">
                  <span className={cn("inline-flex items-center gap-1", isAi && "text-secondary/90")}>
                    {isAi ? <Robot weight="fill" className="size-3" /> : <ShieldWarning weight="fill" className="size-3" />}
                    {actorName}
                  </span>
                  <span className="text-white/25">·</span>
                  <span className="tabular">
                    {new Date(e.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}
                  </span>
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
