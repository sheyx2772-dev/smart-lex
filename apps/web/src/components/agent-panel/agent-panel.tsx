"use client";

import {
  ArrowRight,
  Bell,
  CaretRight,
  ChatCircleDots,
  CheckCircle,
  CircleNotch,
  CurrencyCircleDollar,
  FileText,
  Gavel,
  GearSix,
  type Icon,
  Lightning,
  PaperPlaneTilt,
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
import { agentChat } from "@/app/(app)/chat/actions";
import { AiWaveLogo } from "@/components/ai-wave-logo";
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
interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}
interface Props {
  initialFeed: AgentEvent[];
  initialApprovals: AgentApproval[];
}

// ── Harakat → ikonka ────────────────────────────────────────────────
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
  const [tab, setTab] = useState<"activity" | "chat">("activity");
  const [feed, setFeed] = useState<AgentEvent[]>(initialFeed);
  const [approvals, setApprovals] = useState<AgentApproval[]>(initialApprovals);
  const [unseen, setUnseen] = useState(0);
  const [toasts, setToasts] = useState<AgentEvent[]>([]);

  // Chat holati
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  const seenIds = useRef<Set<string>>(new Set(initialFeed.map((e) => e.id)));
  const actionLabel = useCallback(
    (a: string) => (tAudit.has(`action.${a}` as never) ? tAudit(`action.${a}` as never) : a),
    [tAudit],
  );

  const ingest = useCallback((items: AgentEvent[], nextApprovals: AgentApproval[]) => {
    setApprovals(nextApprovals);
    setFeed(items);
    const fresh = items.filter((e) => !seenIds.current.has(e.id));
    if (fresh.length === 0) return;
    fresh.forEach((e) => seenIds.current.add(e.id));
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

  useEffect(() => {
    if (toasts.length === 0) return;
    const id = setTimeout(() => setToasts((cur) => cur.slice(0, -1)), 6000);
    return () => clearTimeout(id);
  }, [toasts]);

  const openPanel = useCallback((toTab: "activity" | "chat" = "activity") => {
    setOpen(true);
    setTab(toTab);
    setUnseen(0);
    setToasts([]);
  }, []);

  async function sendChat(text: string) {
    const q = text.trim();
    if (!q || chatLoading) return;
    setChatInput("");
    const hist: ChatMsg[] = [...chat, { role: "user", content: q }];
    setChat(hist);
    setChatLoading(true);
    requestAnimationFrame(() => chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight }));
    try {
      const res = await agentChat(hist.map((m) => ({ role: m.role, content: m.content })));
      setChat((m) => [...m, { role: "assistant", content: res.reply || t("chatEmptyReply") }]);
    } catch {
      setChat((m) => [...m, { role: "assistant", content: t("chatError") }]);
    } finally {
      setChatLoading(false);
      requestAnimationFrame(() => chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" }));
    }
  }

  const badge = unseen + approvals.length;
  const today = feed.filter((e) => isToday(e.createdAt));
  const earlier = feed.filter((e) => !isToday(e.createdAt));
  const aiTodayCount = today.filter((e) => e.actorType === "ai_agent").length;

  const suggestions =
    t.has("chatSuggestions") ? (t("chatSuggestions") as string).split("|").filter(Boolean) : [];

  return (
    <>
      {/* ── LAUNCHER — toza oq tugma, chastota logotipi tovlanib turadi ── */}
      {!open && (
        <div className="ai-breathe fixed bottom-6 right-6 z-[55]">
          <button
            onClick={() => openPanel("activity")}
            aria-label={t("open")}
            className="group relative grid size-16 place-items-center rounded-2xl bg-white shadow-xl shadow-black/10 ring-1 ring-black/[0.06] transition-transform duration-200 hover:scale-[1.06] active:scale-95"
          >
            <AiWaveLogo size={34} />
            {/* Jonli status nuqtasi */}
            <span className="absolute right-1.5 top-1.5 flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            </span>
          </button>
          {/* Badge */}
          {badge > 0 && (
            <span className="absolute -left-1.5 -top-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-gradient-to-br from-rose-500 to-red-600 px-1.5 text-[11px] font-bold text-white shadow-lg shadow-red-500/40 ring-2 ring-background">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </div>
      )}

      {/* ── Toast'lar ────────────────────────────────────────────── */}
      <div className="pointer-events-none fixed bottom-24 right-6 z-[54] flex w-[340px] max-w-[calc(100vw-3rem)] flex-col gap-2">
        {toasts.map((e) => {
          const Ic = actionIcon(e.action);
          return (
            <button
              key={e.id}
              onClick={() => openPanel("activity")}
              className="animate-toast-in pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/10 bg-[#1b1d25]/95 p-3 text-left shadow-2xl ring-1 ring-black/20 backdrop-blur-md transition-transform hover:scale-[1.01]"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-violet-500/40">
                <Ic weight="fill" className="size-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-emerald-400">{t("newActivity")}</span>
                <span className="block truncate text-[13px] font-medium text-white">{actionLabel(e.action)}</span>
              </span>
              <CaretRight className="size-4 shrink-0 text-white/40" />
            </button>
          );
        })}
      </div>

      {/* ── Backdrop ─────────────────────────────────────────────── */}
      {open && (
        <button
          aria-label={t("close")}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[58] cursor-default bg-slate-950/40 backdrop-blur-[3px]"
        />
      )}

      {/* ── Slide-over panel — AI tugmasi bilan bir tomonda (o'ngda) ── */}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-[60] flex w-[400px] max-w-[94vw] flex-col overflow-hidden text-white shadow-2xl transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
        style={{ background: "linear-gradient(180deg, #23252e 0%, #1c1e26 55%, #161820 100%)" }}
        aria-hidden={!open}
      >
        {/* Ambient glow */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-72 opacity-80"
          style={{ background: "radial-gradient(130% 80% at 75% 0%, rgba(217,70,239,0.16), transparent 70%)" }}
        />

        {/* Header */}
        <div className="relative flex items-center gap-3 px-5 pb-3 pt-4">
          <span className="relative grid size-11 place-items-center rounded-xl bg-white ring-1 ring-white/15">
            <AiWaveLogo size={24} />
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

        {/* Tabs */}
        <div className="relative mx-4 mb-2 grid grid-cols-2 gap-1 rounded-xl bg-white/[0.05] p-1 ring-1 ring-white/[0.06]">
          <button
            onClick={() => setTab("activity")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg py-2 text-[12.5px] font-medium transition-all",
              tab === "activity" ? "bg-white text-zinc-900 shadow-sm" : "text-white/60 hover:text-white",
            )}
          >
            <Lightning weight="fill" className="size-4" /> {t("tabActivity")}
            {badge > 0 && tab !== "activity" && (
              <span className="grid size-4 place-items-center rounded-full bg-rose-500 text-[9px] font-bold text-white">{badge}</span>
            )}
          </button>
          <button
            onClick={() => setTab("chat")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg py-2 text-[12.5px] font-medium transition-all",
              tab === "chat" ? "bg-white text-zinc-900 shadow-sm" : "text-white/60 hover:text-white",
            )}
          >
            <ChatCircleDots weight="fill" className="size-4" /> {t("tabChat")}
          </button>
        </div>

        {/* ── ACTIVITY (proaktiv feed) ───────────────────────────── */}
        {tab === "activity" && (
          <>
            <div className="scroll-clean relative flex-1 overflow-y-auto px-4 py-2">
              {aiTodayCount > 0 && (
                <div className="ai-panel-in mb-4 flex items-center gap-2.5 rounded-2xl border border-violet-400/20 bg-gradient-to-r from-violet-500/[0.12] to-transparent px-3.5 py-3">
                  <Sparkle weight="fill" className="size-4 shrink-0 text-violet-300" />
                  <p className="text-[13px] text-white/85">{t("worked", { count: aiTodayCount })}</p>
                </div>
              )}

              {/* Tasdiq kutayotganlar */}
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

              {/* Oqim */}
              {feed.length === 0 ? (
                <p className="py-10 text-center text-[13px] text-white/40">{t("feedEmpty")}</p>
              ) : (
                <>
                  {today.length > 0 && <FeedGroup label={t("feedToday")} events={today} actionLabel={actionLabel} tAudit={tAudit} />}
                  {earlier.length > 0 && <FeedGroup label={t("feedEarlier")} events={earlier} actionLabel={actionLabel} tAudit={tAudit} />}
                </>
              )}
            </div>

            <div className="relative border-t border-white/10 p-3">
              <Link
                href="/audit"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-white/[0.05] py-2.5 text-[12px] font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                {t("viewAll")} <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </>
        )}

        {/* ── CHAT (suhbat / buyruq) ─────────────────────────────── */}
        {tab === "chat" && (
          <>
            <div ref={chatRef} className="scroll-clean relative flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {chat.length === 0 && (
                <div className="ai-panel-in pt-6 text-center">
                  <span className="mx-auto mb-3 grid size-12 place-items-center rounded-xl bg-white ring-1 ring-white/10">
                    <AiWaveLogo size={26} />
                  </span>
                  <p className="text-[13px] font-medium text-white/80">{t("chatHi")}</p>
                  <p className="mx-auto mt-1 max-w-[260px] text-[11.5px] leading-relaxed text-white/45">{t("chatHint")}</p>
                  {suggestions.length > 0 && (
                    <div className="mt-4 flex flex-col gap-1.5">
                      {suggestions.map((s) => (
                        <button
                          key={s}
                          onClick={() => sendChat(s)}
                          className="mx-auto w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-left text-[12.5px] text-white/75 transition-colors hover:border-violet-400/30 hover:bg-white/[0.06]"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {chat.map((m, i) => (
                <div key={i} className={cn("ai-msg-in flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                      m.role === "user"
                        ? "rounded-br-md bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-violet-600/25"
                        : "rounded-bl-md bg-white/[0.06] text-white/90 ring-1 ring-white/[0.06]",
                    )}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-white/[0.06] px-4 py-3 ring-1 ring-white/[0.06]">
                    <span className="ai-dot size-1.5 rounded-full bg-white/60" />
                    <span className="ai-dot size-1.5 rounded-full bg-white/60" style={{ animationDelay: "0.2s" }} />
                    <span className="ai-dot size-1.5 rounded-full bg-white/60" style={{ animationDelay: "0.4s" }} />
                  </div>
                </div>
              )}
            </div>

            {/* Chat input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendChat(chatInput);
              }}
              className="relative border-t border-white/10 p-3"
            >
              <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1.5 focus-within:border-violet-400/40">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendChat(chatInput);
                    }
                  }}
                  rows={1}
                  placeholder={t("chatPlaceholder")}
                  className="scroll-clean max-h-28 min-h-[38px] flex-1 resize-none bg-transparent px-2.5 py-2 text-[13px] text-white placeholder:text-white/35 outline-none"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || chatLoading}
                  className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-violet-600/30 transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {chatLoading ? <CircleNotch className="size-4 animate-spin" /> : <PaperPlaneTilt weight="fill" className="size-4" />}
                </button>
              </div>
            </form>
          </>
        )}
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
                  isAi ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-violet-600/30" : "bg-white/[0.07] text-white/70",
                )}
              >
                <Ic weight="fill" className="size-[16px]" />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-[13px] font-medium leading-snug text-white">{actionLabel(e.action)}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/45">
                  <span className={cn("inline-flex items-center gap-1", isAi && "text-violet-300/90")}>
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
