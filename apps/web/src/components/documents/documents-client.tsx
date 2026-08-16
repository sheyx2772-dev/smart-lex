"use client";

import {
  ArrowRight,
  ClipboardText,
  CloudArrowDown,
  Envelope,
  FileArrowUp,
  FileText,
  Funnel,
  Gavel,
  IdentificationBadge,
  MagnifyingGlass,
  NotePencil,
  Plugs,
  Plus,
  Receipt,
  Scroll,
  SealCheck,
  ShieldCheck,
  ShieldWarning,
  Sparkle,
  Tray,
  TrayArrowUp,
  Truck,
  Wallet,
  Warning,
  X,
  type Icon,
} from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { analyzeDocumentRisk, fetchDocuments, getDocumentDetail, signDocument, syncDidox, type RiskAnalysis } from "@/app/(app)/documents/actions";
import { signWithEimzo } from "@/lib/eimzo";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentView } from "@/components/ui/document-view";
import { cn } from "@/lib/utils";

interface DocItem {
  id: string;
  type: string;
  title: string;
  didoxId: string | null;
  createdAt: string;
  contractorName: string | null;
  contractNumber: string | null;
  hasBody: boolean;
}
export interface DocDetail {
  id: string;
  type: string;
  title: string;
  didoxId: string | null;
  s3Key: string | null;
  extracted: Record<string, unknown> | null;
  createdAt: string;
  contractorName: string | null;
  contractNumber: string | null;
}
export interface DocumentsData {
  items: DocItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  byType: Record<string, number>;
  allTotal: number;
}

const TYPE_META: Record<string, { icon: Icon; tone: BadgeProps["tone"] }> = {
  contract: { icon: Scroll, tone: "primary" },
  supplementary_agreement: { icon: FileText, tone: "primary" },
  invoice: { icon: Receipt, tone: "secondary" },
  act: { icon: ClipboardText, tone: "neutral" },
  reconciliation_act: { icon: ClipboardText, tone: "neutral" },
  ttn: { icon: Truck, tone: "neutral" },
  power_of_attorney: { icon: IdentificationBadge, tone: "neutral" },
  letter: { icon: Envelope, tone: "neutral" },
  demand_letter: { icon: Warning, tone: "warning" },
  court_claim: { icon: Gavel, tone: "danger" },
  other: { icon: FileText, tone: "neutral" },
};
const TYPE_ORDER = ["contract", "invoice", "act", "reconciliation_act", "ttn", "power_of_attorney", "letter", "demand_letter", "court_claim", "supplementary_agreement", "other"];

// Didox uslubidagi yon panel papkalari.
const FOLDERS: { key: string; icon: Icon }[] = [
  { key: "incoming", icon: Tray },
  { key: "outgoing", icon: TrayArrowUp },
  { key: "drafts", icon: NotePencil },
  { key: "templates", icon: ClipboardText },
  { key: "excel", icon: FileArrowUp },
];

// Kelgan hujjatni turi bo'yicha keyingi qadamga marshrutlaydi.
const AI_ACTION: Record<string, { cat: "sign" | "reply" | "monitor" | "legal"; href: string; icon: Icon; warn?: boolean }> = {
  contract: { cat: "sign", href: "/contracts", icon: SealCheck },
  supplementary_agreement: { cat: "sign", href: "/contracts", icon: SealCheck },
  letter: { cat: "reply", href: "/studio?template=reply", icon: NotePencil, warn: true },
  power_of_attorney: { cat: "reply", href: "/studio?template=reply", icon: NotePencil },
  invoice: { cat: "monitor", href: "/receivables", icon: Wallet },
  act: { cat: "monitor", href: "/receivables", icon: Wallet },
  reconciliation_act: { cat: "monitor", href: "/receivables", icon: Wallet },
  ttn: { cat: "monitor", href: "/receivables", icon: Wallet },
  demand_letter: { cat: "legal", href: "/approvals", icon: SealCheck },
  court_claim: { cat: "legal", href: "/court", icon: Gavel },
  other: { cat: "reply", href: "/studio", icon: NotePencil },
};

const RISK_TONE: Record<string, BadgeProps["tone"]> = { low: "success", medium: "warning", high: "danger", critical: "danger" };

/**
 * Intl.DateTimeFormat ishlatilmaydi — "uz" lokal uchun Node (server) va brauzer
 * (client) ICU'lari boshqacha naqsh tanlashi mumkin (masalan "04/08/2026" vs
 * "2026-08-04"), bu esa hydration mismatch'ga olib keladi. Shu sabab qo'lda,
 * har doim bir xil formatlanadi.
 */
function fmtDate(s: string): string {
  const d = new Date(s);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

export function DocumentsClient({ initial }: { initial: DocumentsData }) {
  const t = useTranslations("documents");
  const tType = useTranslations("docType");
  const locale = useLocale();

  const [data, setData] = useState<DocumentsData>(initial);
  const [folder, setFolder] = useState("incoming");
  const [type, setType] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DocDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    let alive = true;
    setLoading(true);
    const id = setTimeout(async () => {
      const d = await fetchDocuments({ page, type, q });
      if (alive && d) setData(d);
      if (alive) setLoading(false);
    }, 300);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [type, q, page]);

  async function openDoc(docId: string) {
    setSelectedId(docId);
    setDetail(null);
    setDetailLoading(true);
    const d = await getDocumentDetail(docId);
    setDetail(d);
    setDetailLoading(false);
  }

  async function sync() {
    setSyncing(true);
    setSyncMsg(null);
    const res = await syncDidox();
    if (res && !res.success) {
      setSyncMsg({ kind: "err", text: res.message || "Sinxronlash amalga oshmadi." });
    } else {
      const c = (res?.data ?? {}) as { documents?: number; invoices?: number; contractors?: number };
      const added = (c.documents ?? 0) + (c.invoices ?? 0);
      setSyncMsg({ kind: "ok", text: added > 0 ? `Didox: ${added} ta yozuv sinxronlandi.` : "Didox: yangi hujjat yo'q." });
    }
    const d = await fetchDocuments({ page: 1, type, q });
    if (d) setData(d);
    setSyncing(false);
  }

  const tabs = ["all", ...TYPE_ORDER.filter((ty) => data.byType[ty])];
  const isIncoming = folder === "incoming";
  const rows = isIncoming ? data.items : [];

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/settings?tab=integrations"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/30 transition-opacity hover:opacity-90"
          >
            <Plugs weight="fill" className="size-4" /> {t("connect.button")}
          </Link>
          <button
            onClick={sync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:border-primary/40 disabled:opacity-60"
          >
            <CloudArrowDown className={cn("size-4", syncing && "animate-bounce")} /> {syncing ? t("syncing") : t("syncDidox")}
          </button>
          <Link href="/studio" className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-sm font-semibold text-amber-950 shadow-sm transition-opacity hover:opacity-90">
            <Plus weight="bold" className="size-4" /> {t("create")}
          </Link>
        </div>
      </div>

      {syncMsg && (
        <div
          className={cn(
            "mb-3 flex items-start justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-sm",
            syncMsg.kind === "err" ? "border-danger/30 bg-danger-soft text-danger" : "border-success/30 bg-success-soft text-success",
          )}
        >
          <span>{syncMsg.text}</span>
          <button onClick={() => setSyncMsg(null)} className="shrink-0 opacity-60 hover:opacity-100">
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[184px_1fr]">
        {/* Papkalar (Didox yon paneli) */}
        <div className="space-y-1">
          {FOLDERS.map((f) => {
            const Ic = f.icon;
            const active = folder === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFolder(f.key)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30" : "text-muted-foreground hover:bg-muted",
                )}
              >
                <Ic weight={active ? "fill" : "regular"} className="size-4" /> {t(`folder.${f.key}` as never)}
              </button>
            );
          })}
        </div>

        {/* Asosiy */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
            <div className="relative min-w-0 flex-1">
              <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => {
                  setPage(1);
                  setQ(e.target.value);
                }}
                placeholder={t("searchTin")}
                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary/50"
              />
            </div>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
              <Funnel className="size-4" /> {t("filter")}
            </button>
          </div>

          {/* Tur tab'lari (Didox status qatori uslubida) */}
          <div className="scroll-clean flex items-center gap-1 overflow-x-auto border-b border-border px-3 py-2">
            {tabs.map((ty) => {
              const activeTab = type === ty;
              const count = ty === "all" ? data.allTotal : data.byType[ty] ?? 0;
              return (
                <button
                  key={ty}
                  onClick={() => {
                    setPage(1);
                    setType(ty);
                  }}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
                    activeTab ? "bg-primary-soft text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {ty === "all" ? t("all") : tType(ty as never)}
                  <span className={cn("grid h-5 min-w-5 place-items-center rounded-full px-1 text-xs", activeTab ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Jadval */}
          <div className="scroll-clean min-h-0 flex-1 overflow-auto">
            {!isIncoming ? (
              <div className="flex h-full min-h-52 flex-col items-center justify-center gap-2 text-muted-foreground">
                <Tray className="size-8" />
                <p className="text-sm">{t("folderEmpty")}</p>
              </div>
            ) : rows.length === 0 ? (
              <div className="flex h-full min-h-52 items-center justify-center text-sm text-muted-foreground">{t("empty")}</div>
            ) : (
              <table className="w-full min-w-[820px] text-sm">
                <thead className="sticky top-0 z-10 bg-muted/70 backdrop-blur">
                  <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">{t("col.status")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("col.type")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("col.updated")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("col.contractor")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("col.docNo")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("col.contractNo")}</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const meta = TYPE_META[r.type] ?? TYPE_META.other!;
                    const Ic = meta.icon;
                    const active = selectedId === r.id;
                    return (
                      <tr key={r.id} onClick={() => openDoc(r.id)} className={cn("cursor-pointer border-b border-border/60 transition-colors", active ? "bg-primary-soft/40" : "hover:bg-muted/40")}>
                        <td className="px-4 py-3">
                          <span className="inline-block size-2.5 rounded-full bg-amber-500" title={t("col.status")} />
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-2">
                            <span className="grid size-7 place-items-center rounded-md bg-muted text-muted-foreground">
                              <Ic weight="fill" className="size-4" />
                            </span>
                            <span className="font-medium">{tType(r.type as never)}</span>
                          </span>
                        </td>
                        <td className="tabular px-4 py-3 text-muted-foreground">{fmtDate(r.createdAt)}</td>
                        <td className="max-w-[220px] px-4 py-3">
                          <span className="line-clamp-2 font-medium">{r.contractorName ?? "—"}</span>
                        </td>
                        <td className="tabular px-4 py-3 font-mono text-xs text-muted-foreground">{r.didoxId ?? "—"}</td>
                        <td className="tabular px-4 py-3 font-mono text-xs text-muted-foreground">{r.contractNumber ?? "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <ArrowRight className="size-4 text-muted-foreground" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Sahifalash */}
          {isIncoming && data.pageCount > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-2 text-sm text-muted-foreground">
              <span>
                {(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.total)} / {data.total}
              </span>
              <div className="flex gap-1">
                <button disabled={data.page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-md border border-border px-2 py-1 disabled:opacity-40">
                  ‹
                </button>
                <button disabled={data.page >= data.pageCount} onClick={() => setPage((p) => p + 1)} className="rounded-md border border-border px-2 py-1 disabled:opacity-40">
                  ›
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detal drawer */}
      {selectedId && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setSelectedId(null)}>
          <div className="flex-1 bg-black/30" />
          <div className="scroll-clean flex w-full max-w-md flex-col gap-4 overflow-y-auto border-l border-border bg-background p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-display text-lg font-semibold">{detail?.title ?? t("body")}</h2>
              <button onClick={() => setSelectedId(null)} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted">
                <X className="size-4" />
              </button>
            </div>
            {detail && <DetailBody detail={detail} t={t} tType={tType} locale={locale} onUpdated={() => openDoc(detail.id)} />}
            {detailLoading && <p className="text-sm text-muted-foreground">…</p>}
          </div>
        </div>
      )}

    </div>
  );
}

function DetailBody({
  detail,
  t,
  tType,
  locale,
  onUpdated,
}: {
  detail: DocDetail;
  t: ReturnType<typeof useTranslations>;
  tType: ReturnType<typeof useTranslations>;
  locale: string;
  onUpdated: () => void;
}) {
  const tA = useTranslations("approvals");
  const body = typeof detail.extracted?.body === "string" ? (detail.extracted.body as string) : null;
  const signature = (detail.extracted?.signature ?? null) as { signerName: string; certSerial: string; provider: string } | null;
  const riskAnalysis = (detail.extracted?.riskAnalysis ?? null) as RiskAnalysis | null;
  const [signing, setSigning] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const a = AI_ACTION[detail.type] ?? AI_ACTION.other!;
  const AIcon = a.icon;

  async function doAnalyzeRisk() {
    if (analyzing) return;
    setAnalyzing(true);
    try {
      const res = await analyzeDocumentRisk(detail.id);
      if (res.success) onUpdated();
    } finally {
      setAnalyzing(false);
    }
  }

  /** Hujjat matnini Studioga o'tkazadi (tahrirlash + AI tahlil uchun). */
  function openInStudio() {
    if (!body) return;
    try {
      sessionStorage.setItem("lex:studio-doc", JSON.stringify({ title: detail.title, html: body }));
      window.location.href = "/studio?handoff=1";
    } catch {
      /* ignore */
    }
  }

  async function doSign() {
    if (signing) return;
    setSigning(true);
    try {
      const sig = await signWithEimzo(body ?? detail.title, "Rahbar");
      const res = await signDocument(detail.id, sig);
      if (res.success) onUpdated();
    } finally {
      setSigning(false);
    }
  }

  return (
    <>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <Field label={tType(detail.type as never)} value={fmtDate(detail.createdAt)} />
        <Field label={t("contractor")} value={detail.contractorName} />
        <Field label={t("contract")} value={detail.contractNumber} />
        <Field label={t("didox")} value={detail.didoxId} />
      </dl>

      {/* AI marshrutlash */}
      <div className="rounded-xl border border-primary/25 bg-primary-soft/20 p-3">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary/70">
          <Sparkle weight="fill" className="size-3.5" /> {t("ai.heading")}
        </p>
        <p className="mt-1 text-sm font-semibold">{t(`ai.${a.cat}.title` as never)}</p>
        <p className="text-xs text-muted-foreground">{t(`ai.${a.cat}.desc` as never)}</p>
        {a.warn && (
          <p className="mt-1.5 flex items-center gap-1 rounded-md bg-warning-soft px-2 py-1 text-xs text-warning">
            <Warning weight="fill" className="size-3.5" /> {t("ai.warnManager")}
          </p>
        )}
        <Link href={a.href} className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">
          <AIcon weight="fill" className="size-4" /> {t(`ai.${a.cat}.action` as never)} <ArrowRight className="size-3.5" />
        </Link>
        {body && (
          <button
            onClick={openInStudio}
            className="ml-2 mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary/40"
          >
            <NotePencil weight="fill" className="size-4" /> {locale === "ru" ? "Открыть в Studio (ред. + анализ)" : "Studioda ochish (tahrirlash + tahlil)"}
          </button>
        )}
      </div>

      {/* E-IMZO */}
      <div className="rounded-lg border border-border bg-muted/20 p-3">
        {signature ? (
          <div className="flex items-center gap-2 text-sm text-success">
            <ShieldCheck weight="fill" className="size-4" /> {signature.provider === "eimzo" ? tA("realSigned") : tA("signed")}
          </div>
        ) : (
          <Button variant="outline" onClick={doSign} disabled={signing}>
            <ShieldCheck weight="fill" className="size-4" /> {signing ? tA("signing") : tA("sign")}
          </Button>
        )}
      </div>

      {/* Shartnoma xavf tahlili — faqat "contract" turidagi hujjatlarda, matn mavjud bo'lsa */}
      {detail.type === "contract" && body && (
        <div className="rounded-lg border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {locale === "ru" ? "Анализ риска" : "Xavf tahlili"}
            </p>
            <Button variant="outline" onClick={doAnalyzeRisk} disabled={analyzing}>
              <ShieldWarning weight="fill" className="size-4" />
              {analyzing ? (locale === "ru" ? "Анализирую…" : "Tahlil qilinmoqda…") : locale === "ru" ? "Анализировать" : "Tahlil qil"}
            </Button>
          </div>
          {riskAnalysis && (
            <div className="mt-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <Badge tone={RISK_TONE[riskAnalysis.riskLevel] ?? "neutral"}>{riskAnalysis.riskLevel}</Badge>
                <span className="text-xs text-muted-foreground">{new Date(riskAnalysis.analyzedAt).toLocaleString()}</span>
              </div>
              {riskAnalysis.findings.map((f, i) => (
                <div key={i} className="rounded-lg border border-border bg-muted/20 p-2.5">
                  <div className="flex items-center gap-2">
                    <Badge tone={RISK_TONE[f.riskLevel] ?? "neutral"}>{f.riskLevel}</Badge>
                    <span className="text-sm font-medium">{f.area}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{f.reason}</p>
                </div>
              ))}
              {riskAnalysis.missingClauses.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{locale === "ru" ? "Отсутствующие пункты" : "Yetishmayotgan bandlar"}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {riskAnalysis.missingClauses.map((cl, i) => (
                      <span key={i} className="rounded-md bg-warning-soft px-2 py-0.5 text-xs text-warning">{cl}</span>
                    ))}
                  </div>
                </div>
              )}
              {riskAnalysis.unusualClauses.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{locale === "ru" ? "Необычные пункты" : "G'ayrioddiy bandlar"}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {riskAnalysis.unusualClauses.map((cl, i) => (
                      <span key={i} className="rounded-md bg-danger-soft px-2 py-0.5 text-xs text-danger">{cl}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {body && (
        <div className="rounded-lg border border-border p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("body")}</p>
          <DocumentView body={body} />
        </div>
      )}
    </>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate font-medium">{value || "—"}</dd>
    </div>
  );
}
