"use client";

import { CurrencyBtc, DownloadSimple, GearSix, MagnifyingGlass, Robot, ShieldCheck, ShieldWarning, User, type Icon } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { fetchAudit } from "@/app/(app)/audit/actions";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

interface AuditItem {
  id: string;
  actorType: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  detail: Record<string, unknown> | null;
  createdAt: string;
}
export interface AuditData {
  items: AuditItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  byActor: Record<string, number>;
  allTotal: number;
}
export interface AuditChainStatus {
  totalRecords: number;
  isValid: boolean;
  brokenAtId: string | null;
  brokenAtCreated: string | null;
}
export interface AuditAnchor {
  id: string;
  chainTipHash: string;
  status: string;
  bitcoinBlockHeight: number | null;
  confirmedAt: string | null;
  createdAt: string;
}

const ACTOR_META: Record<string, { icon: Icon; tone: BadgeProps["tone"]; ring: string }> = {
  ai_agent: { icon: Robot, tone: "primary", ring: "bg-primary-soft text-primary" },
  user: { icon: User, tone: "secondary", ring: "bg-secondary-soft text-secondary" },
  system: { icon: GearSix, tone: "neutral", ring: "bg-muted text-muted-foreground" },
};
const ACTOR_ORDER = ["ai_agent", "user", "system"];

export function AuditClient({
  initial,
  initialChain,
  initialAnchors,
}: {
  initial: AuditData;
  initialChain: AuditChainStatus | null;
  initialAnchors: AuditAnchor[];
}) {
  const t = useTranslations("audit");
  const tStage = useTranslations("stage");
  const tChannel = useTranslations("channel");
  const locale = useLocale();

  const [data, setData] = useState<AuditData>(initial);
  const [actor, setActor] = useState("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [anchorsOpen, setAnchorsOpen] = useState(false);
  const firstQ = useRef(true);

  const fmtDateTime = (d: string) =>
    new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(d));

  const actionLabel = (a: string) => (t.has(`action.${a}` as never) ? t(`action.${a}` as never) : a);

  async function load(page: number, a = actor, query = q) {
    setLoading(true);
    const d = await fetchAudit({ page, actor: a, q: query });
    if (d) setData(d);
    setLoading(false);
  }

  // Qidiruvni debounce bilan (350ms) server tomonga yuboramiz.
  useEffect(() => {
    if (firstQ.current) {
      firstQ.current = false;
      return;
    }
    const id = setTimeout(() => load(1, actor, q), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const actors = ["all", ...ACTOR_ORDER.filter((a) => data.byActor[a])];

  const detailChips = (detail: Record<string, unknown> | null) => {
    if (!detail) return [];
    const out: string[] = [];
    if (typeof detail.stage === "string") out.push(tStage(detail.stage as never));
    if (typeof detail.channel === "string") out.push(tChannel(detail.channel as never));
    if (typeof detail.decision === "string") out.push(String(detail.decision));
    return out;
  };

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2">
            <Robot weight="fill" className="size-4 text-primary" />
            <span className="text-xs text-muted-foreground">{t("total")}</span>
            <span className="tabular font-display text-lg font-semibold">{data.allTotal}</span>
          </div>
          {initialChain && (
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3.5 py-2",
                initialChain.isValid ? "border-success/25 bg-success-soft text-success" : "border-danger/25 bg-danger-soft text-danger",
              )}
              title={initialChain.isValid ? undefined : `${initialChain.brokenAtId ?? ""} ${initialChain.brokenAtCreated ?? ""}`.trim()}
            >
              {initialChain.isValid ? (
                <ShieldCheck weight="fill" className="size-4" />
              ) : (
                <ShieldWarning weight="fill" className="size-4" />
              )}
              <span className="text-xs font-medium">
                {initialChain.isValid ? t("chain.verified", { count: initialChain.totalRecords }) : t("chain.broken")}
              </span>
            </div>
          )}
          <a
            href="/api/audit/report"
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <DownloadSimple weight="fill" className="size-4 text-primary" />
            {t("downloadReport")}
          </a>
          <div className="relative">
            <button
              onClick={() => setAnchorsOpen((v) => !v)}
              className={cn(
                "flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
                anchorsOpen && "border-primary/25 text-foreground",
              )}
            >
              <CurrencyBtc weight="fill" className="size-4 text-warning" />
              {t("anchors.toggle")}
            </button>
            {anchorsOpen && (
              <div className="absolute right-0 top-full z-10 mt-2 w-80 rounded-xl border border-border bg-card p-3 shadow-lg">
                <p className="mb-2 text-xs font-semibold">{t("anchors.title")}</p>
                <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">{t("anchors.hint")}</p>
                {initialAnchors.length === 0 ? (
                  <p className="py-2 text-center text-xs text-muted-foreground">{t("anchors.empty")}</p>
                ) : (
                  <ul className="scroll-clean max-h-64 space-y-2 overflow-y-auto">
                    {initialAnchors.map((a) => (
                      <li key={a.id} className="rounded-lg border border-border/70 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <Badge tone={a.status === "confirmed" ? "success" : "warning"}>
                            {a.status === "confirmed" ? t("anchors.confirmed") : t("anchors.pending")}
                          </Badge>
                          <span className="tabular text-[11px] text-muted-foreground">{fmtDateTime(a.createdAt)}</span>
                        </div>
                        <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground/80">{a.chainTipHash}</p>
                        {a.status === "confirmed" && a.bitcoinBlockHeight != null && (
                          <p className="mt-0.5 text-[11px] font-medium text-success">{t("anchors.blockHeight", { height: a.bitcoinBlockHeight })}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
          {actors.map((a) => (
            <button
              key={a}
              onClick={() => {
                setActor(a);
                load(1, a, q);
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                actor === a ? "bg-primary-soft text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {a === "all" ? t("all") : t(`actor.${a}` as never)}
              <span
                className={cn(
                  "grid h-5 min-w-5 place-items-center rounded-full px-1 text-xs",
                  actor === a ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {a === "all" ? data.allTotal : data.byActor[a] ?? 0}
              </span>
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-9 w-64 rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none transition-shadow placeholder:text-muted-foreground/55 focus:ring-4 focus:ring-primary/10"
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="scroll-clean min-h-0 flex-1 overflow-y-auto pr-1">
        {data.items.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
            {t("empty")}
          </div>
        ) : (
          <ol className={cn("relative transition-opacity", loading && "opacity-50")}>
            {data.items.map((r, i) => {
              const meta = ACTOR_META[r.actorType] ?? ACTOR_META.system;
              const Ic = meta.icon;
              const chips = detailChips(r.detail);
              return (
                <li key={r.id} className="relative flex gap-4 pb-3">
                  <div className="flex flex-col items-center">
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-full ring-4 ring-card", meta.ring)}>
                      <Ic weight="fill" className="size-[18px]" />
                    </span>
                    {i < data.items.length - 1 && <span className="w-px flex-1 bg-border" />}
                  </div>
                  <div className="min-w-0 flex-1 rounded-xl border border-border bg-card p-3.5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{actionLabel(r.action)}</span>
                      <span className="tabular text-xs text-muted-foreground">{fmtDateTime(r.createdAt)}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <Badge tone={meta.tone}>{t(`actor.${r.actorType}` as never)}</Badge>
                      {r.actorName && <span className="text-xs text-muted-foreground">{r.actorName}</span>}
                      {chips.map((ch) => (
                        <span key={ch} className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {ch}
                        </span>
                      ))}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Pagination */}
      <div className="mt-3">
        <Pagination
          page={data.page}
          pageCount={data.pageCount}
          pageSize={data.pageSize}
          total={data.total}
          onPage={(p) => load(p)}
          disabled={loading}
        />
      </div>
    </div>
  );
}
