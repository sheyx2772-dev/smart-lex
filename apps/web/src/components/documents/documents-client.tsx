"use client";

import {
  ArrowRight,
  CircleNotch,
  ClipboardText,
  CloudArrowDown,
  Envelope,
  FilePlus,
  FileText,
  Gavel,
  IdentificationBadge,
  MagnifyingGlass,
  NotePencil,
  Package,
  PenNib,
  Receipt,
  Scroll,
  SealCheck,
  ShieldCheck,
  Sparkle,
  Truck,
  Wallet,
  Warning,
  type Icon,
} from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { fetchDocuments, getDocumentDetail, signDocument, syncDidox } from "@/app/(app)/documents/actions";
import { signWithEimzo } from "@/lib/eimzo";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DocumentView } from "@/components/ui/document-view";
import { Pagination } from "@/components/ui/pagination";
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
  supplementary_agreement: { icon: FilePlus, tone: "primary" },
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
const TYPE_ORDER = [
  "contract",
  "invoice",
  "act",
  "reconciliation_act",
  "ttn",
  "power_of_attorney",
  "letter",
  "demand_letter",
  "court_claim",
  "supplementary_agreement",
  "other",
];

// Kelgan Didox hujjatini turi bo'yicha keyingi qadamga marshrutlaydi:
// shartnoma → imzolash, rasmiy xat → javob (studio) + rahbarni ogohlantirish,
// faktura/akt → qarzdorlik nazoratiga, huquqiy hujjat → tegishli bo'lim.
const AI_ACTION: Record<string, { cat: "sign" | "reply" | "monitor" | "legal"; href: string; icon: Icon; warn?: boolean }> = {
  contract: { cat: "sign", href: "/contracts", icon: PenNib },
  supplementary_agreement: { cat: "sign", href: "/contracts", icon: PenNib },
  letter: { cat: "reply", href: "/studio", icon: NotePencil, warn: true },
  power_of_attorney: { cat: "reply", href: "/studio", icon: NotePencil },
  invoice: { cat: "monitor", href: "/receivables", icon: Wallet },
  act: { cat: "monitor", href: "/receivables", icon: Wallet },
  reconciliation_act: { cat: "monitor", href: "/receivables", icon: Wallet },
  ttn: { cat: "monitor", href: "/receivables", icon: Wallet },
  demand_letter: { cat: "legal", href: "/approvals", icon: SealCheck },
  court_claim: { cat: "legal", href: "/court", icon: Gavel },
  other: { cat: "reply", href: "/studio", icon: NotePencil },
};

function DocAiAction({ type, t }: { type: string; t: ReturnType<typeof useTranslations> }) {
  const a = AI_ACTION[type] ?? AI_ACTION.other;
  const Icon = a.icon;
  return (
    <Card className="border-primary/25 bg-primary-soft/20 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-secondary text-white">
          <Sparkle weight="fill" className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-primary/70">{t("ai.heading")}</p>
          <p className="mt-0.5 text-sm font-semibold">{t(`ai.${a.cat}.title` as never)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t(`ai.${a.cat}.desc` as never)}</p>
          {a.warn && (
            <p className="mt-2 flex items-center gap-1.5 rounded-md bg-warning-soft px-2 py-1 text-xs text-warning">
              <Warning weight="fill" className="size-3.5 shrink-0" /> {t("ai.warnManager")}
            </p>
          )}
        </div>
      </div>
      <Link
        href={a.href}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        <Icon weight="fill" className="size-4" /> {t(`ai.${a.cat}.action` as never)} <ArrowRight className="size-3.5" />
      </Link>
    </Card>
  );
}

export function DocumentsClient({ initial }: { initial: DocumentsData }) {
  const t = useTranslations("documents");
  const tType = useTranslations("docType");
  const locale = useLocale();
  const router = useRouter();

  const [data, setData] = useState<DocumentsData>(initial);
  const [type, setType] = useState("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DocDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const firstQ = useRef(true);

  const fmtDate = (d: string) =>
    new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d));

  async function load(page: number, ty = type, query = q) {
    setLoading(true);
    setSelectedId(null);
    const d = await fetchDocuments({ page, type: ty, q: query });
    if (d) setData(d);
    setLoading(false);
  }

  useEffect(() => {
    if (firstQ.current) {
      firstQ.current = false;
      return;
    }
    const id = setTimeout(() => load(1, type, q), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Tanlangan hujjatning to'liq matnini kerak bo'lganda tortamiz.
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetail(null);
    getDocumentDetail(selectedId).then((d) => {
      if (!cancelled) {
        setDetail(d);
        setDetailLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const selected = selectedId ? data.items.find((d) => d.id === selectedId) ?? null : null;
  const types = ["all", ...TYPE_ORDER.filter((ty) => data.byType[ty])];

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              if (syncing) return;
              setSyncing(true);
              await syncDidox();
              setSyncing(false);
              router.refresh();
            }}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-60"
          >
            {syncing ? <CircleNotch className="size-4 animate-spin" /> : <CloudArrowDown weight="fill" className="size-4" />}
            {syncing ? t("syncing") : t("syncDidox")}
          </button>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2">
            <FileText weight="fill" className="size-4 text-primary" />
            <span className="text-xs text-muted-foreground">{t("total")}</span>
            <span className="tabular font-display text-lg font-semibold">{data.allTotal}</span>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
          {types.map((ty) => (
            <button
              key={ty}
              onClick={() => {
                setType(ty);
                load(1, ty, q);
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                type === ty ? "bg-primary-soft text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {ty === "all" ? t("all") : tType(ty as never)}
              <span
                className={cn(
                  "grid h-5 min-w-5 place-items-center rounded-full px-1 text-xs",
                  type === ty ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {ty === "all" ? data.allTotal : data.byType[ty] ?? 0}
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

      {/* Master-detail */}
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[400px_1fr]">
        {/* List + pagination */}
        <div className="flex min-h-0 flex-col">
          <div className={cn("scroll-clean min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 transition-opacity", loading && "opacity-50")}>
            {data.items.length === 0 && (
              <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                {t("empty")}
              </div>
            )}
            {data.items.map((d) => {
              const meta = TYPE_META[d.type] ?? TYPE_META.other;
              const Ic = meta.icon;
              const active = selected?.id === d.id;
              return (
                <button
                  key={d.id}
                  onClick={() => setSelectedId(d.id)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all",
                    active
                      ? "border-primary bg-primary-soft/40 shadow-sm"
                      : "border-border bg-card hover:border-muted-foreground/25 hover:bg-muted/40",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-lg",
                      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Ic weight={active ? "fill" : "regular"} className="size-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium leading-snug">{d.title}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge tone={meta.tone}>{tType(d.type as never)}</Badge>
                      <span className="truncate text-xs text-muted-foreground">{d.contractorName ?? "—"}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-3">
            <Pagination page={data.page} pageCount={data.pageCount} pageSize={data.pageSize} total={data.total} onPage={(p) => load(p)} disabled={loading} />
          </div>
        </div>

        {/* Preview */}
        <div className="scroll-clean min-h-0 overflow-y-auto">
          {!selected ? (
            <div className="flex h-full min-h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
              {t("select")}
            </div>
          ) : (
            <Preview
              item={selected}
              detail={detail && detail.id === selected.id ? detail : null}
              loading={detailLoading}
              t={t}
              tType={tType}
              fmtDate={fmtDate}
              onSigned={() => selectedId && getDocumentDetail(selectedId).then(setDetail)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Preview({
  item,
  detail,
  loading,
  t,
  tType,
  fmtDate,
  onSigned,
}: {
  item: DocItem;
  detail: DocDetail | null;
  loading: boolean;
  t: ReturnType<typeof useTranslations>;
  tType: ReturnType<typeof useTranslations>;
  fmtDate: (d: string) => string;
  onSigned: () => void;
}) {
  const tA = useTranslations("approvals");
  const meta = TYPE_META[item.type] ?? TYPE_META.other;
  const Ic = meta.icon;
  const body = typeof detail?.extracted?.body === "string" ? (detail.extracted.body as string) : null;
  const signature = (detail?.extracted?.signature ?? null) as { signerName: string; certSerial: string; provider: string } | null;
  const [signing, setSigning] = useState(false);
  const [signErr, setSignErr] = useState<string | null>(null);

  async function doSign() {
    if (signing) return;
    setSigning(true);
    setSignErr(null);
    try {
      const sig = await signWithEimzo(body ?? item.title, "Rahbar");
      const res = await signDocument(item.id, sig);
      if (res.success) onSigned();
      else setSignErr(res.message || tA("signFailed"));
    } catch (e) {
      setSignErr(e instanceof Error ? e.message : tA("signFailed"));
    } finally {
      setSigning(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
            <Ic weight="fill" className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <Badge tone={meta.tone}>{tType(item.type as never)}</Badge>
              <span className="text-xs text-muted-foreground">{fmtDate(item.createdAt)}</span>
            </div>
            <h2 className="font-display text-lg font-semibold leading-snug tracking-tight">{item.title}</h2>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
          <Field label={t("contractor")} value={item.contractorName} />
          <Field label={t("contract")} value={item.contractNumber} />
          <Field label={t("didox")} value={item.didoxId} mono />
        </dl>

        {/* E-IMZO imzo — istalgan hujjatni imzolash */}
        {detail && (
          <div className="mt-4 border-t border-border pt-4">
            {signature ? (
              <div className="flex items-center gap-2.5">
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-success-soft text-success">
                  <ShieldCheck weight="fill" className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-success">{signature.provider === "eimzo" ? tA("realSigned") : tA("signed")}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {tA("signedBy")}: {signature.signerName} · {signature.certSerial}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">{tA("demoNote")}</p>
                  <Button variant="outline" onClick={doSign} disabled={signing}>
                    <PenNib weight="fill" className="size-4" />
                    {signing ? tA("signing") : tA("sign")}
                  </Button>
                </div>
                {signErr && <p className="text-xs text-danger">{signErr}</p>}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* AI marshrutlash — hujjat turi bo'yicha keyingi qadam */}
      <DocAiAction type={item.type} t={t} />

      {loading ? (
        <Card className="flex items-center justify-center p-10 text-muted-foreground">
          <CircleNotch className="size-6 animate-spin" />
        </Card>
      ) : body ? (
        <Card className="p-5">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <FileText className="size-4" /> {t("body")}
          </p>
          <DocumentView body={body} />
        </Card>
      ) : (
        <Card className="flex flex-col items-center justify-center gap-3 p-10 text-center">
          <div className="grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
            <Package className="size-6" />
          </div>
          <p className="max-w-xs text-sm text-muted-foreground">{t("noPreview")}</p>
          {item.didoxId && (
            <span className="tabular rounded-md bg-muted px-2.5 py-1 font-mono text-xs text-muted-foreground">{item.didoxId}</span>
          )}
        </Card>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("truncate font-medium", mono && "font-mono text-xs")}>{value || "—"}</dd>
    </div>
  );
}
