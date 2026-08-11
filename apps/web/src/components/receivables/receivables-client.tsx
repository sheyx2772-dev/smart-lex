"use client";

import {
  Bank,
  Bell,
  Buildings,
  CheckCircle,
  CircleNotch,
  Clock,
  EnvelopeSimple,
  FileText,
  Gavel,
  HandCoins,
  MagnifyingGlass,
  MapPin,
  PaperPlaneTilt,
  Phone,
  Receipt,
  ShieldWarning,
  Sparkle,
  TelegramLogo,
  Warning,
} from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { generateLawsuit } from "@/app/(app)/companies/[id]/actions";
import {
  fetchReceivables,
  getReceivableDetail,
  listForFinancing,
  recordPayment,
  sendReminder,
  withdrawFromFinancing,
  writeOffReceivable,
} from "@/app/(app)/receivables/actions";
import { formatMoneyInput, unformatMoney } from "@/lib/format";
import { Badge, STATUS_TONE, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { PortfolioSummary, type PortfolioSummaryData } from "./portfolio-summary";
import type { ReceivableDetail, ReceivableRow } from "./types";

export interface ReceivablesData {
  items: ReceivableRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  byStatus: Record<string, number>;
  allTotal: number;
}

const STATUS_ORDER = ["overdue", "partial", "pending", "paid", "written_off"] as const;
const STAGES = [
  { key: "soft_reminder", icon: Bell },
  { key: "firm_reminder", icon: Warning },
  { key: "demand_letter", icon: FileText },
  { key: "court", icon: Gavel },
] as const;
type SortKey = "overdue" | "amount" | "risk";

function riskInfo(score: number): { tone: BadgeProps["tone"]; key: string } {
  if (score >= 70) return { tone: "danger", key: "riskHigh" };
  if (score >= 40) return { tone: "warning", key: "riskMedium" };
  return { tone: "success", key: "riskLow" };
}

const CHANNEL_ICON: Record<string, typeof Bell> = {
  sms: PaperPlaneTilt,
  email: EnvelopeSimple,
  telegram: TelegramLogo,
  hybrid_post: FileText,
};

export function ReceivablesClient({ initial, portfolio }: { initial: ReceivablesData; portfolio: PortfolioSummaryData | null }) {
  const t = useTranslations("receivables");
  const tStatus = useTranslations("status");
  const tAging = useTranslations("aging");
  const locale = useLocale();

  const [data, setData] = useState<ReceivablesData>(initial);
  const [status, setStatus] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("overdue");
  const [query, setQuery] = useState("");
  const [listLoading, setListLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReceivableDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const firstQ = useRef(true);

  const fmtDate = (d: string | null | undefined) =>
    d ? new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d)) : "—";

  async function load(page: number, st = status, srt = sort, q = query) {
    setListLoading(true);
    setSelectedId(null);
    const d = await fetchReceivables({ page, status: st, sort: srt, q });
    if (d) setData(d);
    setListLoading(false);
  }

  // Tanlovni saqlab, ro'yxat + tafsilotni yangilaydi (to'lovdan keyin).
  async function refresh() {
    const d = await fetchReceivables({ page: data.page, status, sort, q: query });
    if (d) setData(d);
    if (selectedId) getReceivableDetail(selectedId).then(setDetail);
  }

  // Qidiruvni debounce bilan server tomonga yuboramiz.
  useEffect(() => {
    if (firstQ.current) {
      firstQ.current = false;
      return;
    }
    const id = setTimeout(() => load(1, status, sort, query), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const selected = selectedId ? data.items.find((r) => r.id === selectedId) ?? null : null;
  const selectedKey = selected?.id ?? null;

  // Tanlangan qator o'zgarganda tafsilotni server action orqali yuklaymiz.
  useEffect(() => {
    if (!selectedKey) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetail(null);
    getReceivableDetail(selectedKey).then((d) => {
      if (!cancelled) {
        setDetail(d);
        setDetailLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedKey]);

  const tabs = ["all", ...STATUS_ORDER.filter((s) => data.byStatus[s])];

  return (
    <div className="flex min-h-full w-full flex-col">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2">
          <Receipt weight="fill" className="size-4 text-primary" />
          <span className="text-xs text-muted-foreground">{t("totalCount")}</span>
          <span className="tabular font-display text-lg font-semibold">{data.allTotal}</span>
        </div>
      </div>

      {portfolio && <PortfolioSummary data={portfolio} />}

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex gap-1 rounded-lg border border-border bg-card p-1">
          {tabs.map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatus(s);
                load(1, s, sort, query);
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                status === s ? "bg-primary-soft text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "all" ? t("all") : tStatus(s as never)}
              <span
                className={cn(
                  "grid h-5 min-w-5 place-items-center rounded-full px-1 text-xs",
                  status === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {s === "all" ? data.allTotal : data.byStatus[s] ?? 0}
              </span>
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Sort */}
          <div className="inline-flex rounded-lg border border-border bg-card p-1">
            {(["overdue", "amount", "risk"] as SortKey[]).map((k) => (
              <button
                key={k}
                onClick={() => {
                  setSort(k);
                  load(1, status, k, query);
                }}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  sort === k ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(k === "overdue" ? "sortOverdue" : k === "amount" ? "sortAmount" : "sortRisk")}
              </button>
            ))}
          </div>
          {/* Search */}
          <div className="relative">
            <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="h-9 w-64 rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none transition-shadow placeholder:text-muted-foreground/55 focus:ring-4 focus:ring-primary/10"
            />
          </div>
        </div>
      </div>

      {/* Master-detail */}
      <div className="grid min-h-[560px] flex-1 gap-4 lg:grid-cols-[400px_1fr]">
        {/* List + pagination */}
        <div className="flex min-h-0 flex-col">
        <div className={cn("scroll-clean min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 transition-opacity", listLoading && "opacity-50")}>
          {data.items.length === 0 && (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
              {t("empty")}
            </div>
          )}
          {data.items.map((r) => {
            const active = selected?.id === r.id;
            const risk = riskInfo(r.riskScore);
            return (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={cn(
                  "w-full rounded-xl border p-3.5 text-left transition-all",
                  active
                    ? "border-primary bg-primary-soft/40 shadow-sm"
                    : "border-border bg-card hover:border-muted-foreground/25 hover:bg-muted/40",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{r.contractorName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {r.invoiceNumber} · {r.contractorTin}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[r.status]}>{tStatus(r.status as never)}</Badge>
                </div>
                <div className="mt-2.5 flex items-end justify-between gap-2">
                  <div>
                    <p className="tabular font-display text-base font-semibold">{r.outstanding.formatted}</p>
                    {r.penalty.minor !== "0" && (
                      <p className="tabular mt-0.5 text-xs text-warning">+{r.penalty.formatted}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {r.overdueDays > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-danger">
                        <Clock weight="fill" className="size-3.5" />
                        {r.overdueDays} {t("overdueDays")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-success">
                        <CheckCircle weight="fill" className="size-3.5" />
                        {t("onTime")}
                      </span>
                    )}
                    <span className={cn("inline-flex items-center gap-1 text-[11px]", `text-${risk.tone === "danger" ? "danger" : risk.tone === "warning" ? "warning" : "success"}`)}>
                      <span className={cn("size-1.5 rounded-full", risk.tone === "danger" ? "bg-danger" : risk.tone === "warning" ? "bg-warning" : "bg-success")} />
                      {t("risk")} {r.riskScore}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
          <div className="mt-3">
            <Pagination page={data.page} pageCount={data.pageCount} pageSize={data.pageSize} total={data.total} onPage={(p) => load(p)} disabled={listLoading} />
          </div>
        </div>

        {/* Detail */}
        <div className="scroll-clean min-h-0 overflow-y-auto">
          {!selected ? (
            <div className="flex h-full min-h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
              {t("select")}
            </div>
          ) : (
            <DetailPanel
              key={selected.id}
              row={selected}
              detail={detail && detail.id === selected.id ? detail : null}
              loading={detailLoading}
              t={t}
              tStatus={tStatus}
              tAging={tAging}
              fmtDate={fmtDate}
              onPaid={refresh}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function DetailPanel({
  row,
  detail,
  loading,
  t,
  tStatus,
  tAging,
  fmtDate,
  onPaid,
}: {
  row: ReceivableRow;
  detail: ReceivableDetail | null;
  loading: boolean;
  t: ReturnType<typeof useTranslations>;
  tStatus: ReturnType<typeof useTranslations>;
  tAging: ReturnType<typeof useTranslations>;
  fmtDate: (d: string | null | undefined) => string;
  onPaid: () => void;
}) {
  const tStage = useTranslations("stage");
  const tChannel = useTranslations("channel");
  const tRemStatus = useTranslations("reminderStatus");
  const tPayStatus = useTranslations("paymentStatus");
  const router = useRouter();
  const risk = riskInfo(row.riskScore);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [paying, setPaying] = useState(false);
  const [writingOff, setWritingOff] = useState(false);
  const [escalating, setEscalating] = useState(false);

  async function doEscalateToCourt() {
    if (escalating) return;
    setEscalating(true);
    const res = await generateLawsuit(row.contractorId);
    setEscalating(false);
    if (res.success) router.push("/approvals");
  }

  const canPay = row.status !== "paid" && row.status !== "written_off";

  async function doWriteOff() {
    if (writingOff || !window.confirm(t("writeOffConfirm"))) return;
    setWritingOff(true);
    const res = await writeOffReceivable(row.id);
    setWritingOff(false);
    if (res.success) onPaid();
  }

  const [reminding, setReminding] = useState(false);
  async function doSendReminder() {
    if (reminding) return;
    setReminding(true);
    const res = await sendReminder(row.id);
    setReminding(false);
    if (res.success) onPaid();
  }

  const [financingBusy, setFinancingBusy] = useState(false);
  async function doListForFinancing() {
    if (financingBusy) return;
    setFinancingBusy(true);
    const res = await listForFinancing(row.id);
    setFinancingBusy(false);
    if (res.success) onPaid();
  }
  async function doWithdrawFinancing(listingId: string) {
    if (financingBusy) return;
    setFinancingBusy(true);
    const res = await withdrawFromFinancing(listingId);
    setFinancingBusy(false);
    if (res.success) onPaid();
  }

  async function submitPayment() {
    const minor = unformatMoney(payAmount);
    if (!minor || minor === "0" || paying) return;
    setPaying(true);
    const res = await recordPayment(row.id, (BigInt(minor) * 100n).toString(), new Date(payDate).toISOString());
    setPaying(false);
    if (res.success) {
      setPayOpen(false);
      setPayAmount("");
      onPaid();
    }
  }

  return (
    <div className="space-y-4">
      {/* Header card */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
              <Buildings weight="fill" className="size-5" />
            </div>
            <div className="min-w-0">
              <Link href={`/companies/${row.contractorId}`} className="font-display text-lg font-semibold tracking-tight hover:text-primary hover:underline">
                {row.contractorName}
              </Link>
              <p className="text-sm text-muted-foreground">
                {t("tin")}: {row.contractorTin} · {row.invoiceNumber}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
            <Badge tone={STATUS_TONE[row.status]}>{tStatus(row.status as never)}</Badge>
            <Badge tone={risk.tone}>
              <ShieldWarning weight="fill" className="size-3" />
              {t(risk.key)} · {row.riskScore}
            </Badge>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Clock className="size-4" />
            {row.overdueDays > 0 ? (
              <span className="font-medium text-danger">
                {row.overdueDays} {t("overdueDays")}
              </span>
            ) : (
              <span className="font-medium text-success">{t("onTime")}</span>
            )}
          </span>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            {tAging(row.agingBucket as never)}
          </span>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Bell className="size-4" />
            {row.reminderCount} {t("reminders")}
          </span>
        </div>
      </Card>

      {/* AI izohi — nega bu tavsiya (explainability) */}
      {detail?.latestDecision && (
        <Card className="border-primary/20 bg-primary-soft/20 p-5">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
            <Sparkle weight="fill" className="size-3.5" /> {t("aiWhyHeading")}
          </h3>
          <p className="text-sm">{detail.latestDecision.reason}</p>
          {detail.latestDecision.factors.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {detail.latestDecision.factors.map((f) => (
                <span
                  key={f.label}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                    f.impact > 0 ? "bg-success-soft text-success" : f.impact < 0 ? "bg-danger-soft text-danger" : "bg-muted text-muted-foreground",
                  )}
                >
                  {f.label} {f.impact > 0 ? `+${f.impact}` : f.impact}
                </span>
              ))}
            </div>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">{fmtDate(detail.latestDecision.createdAt)}</p>
        </Card>
      )}

      {/* Va'da qilingan to'lov (Promise-to-Pay) */}
      {detail?.promise && (
        <Card
          className={cn(
            "p-5",
            detail.promise.status === "pending" && "border-primary/25 bg-primary-soft/15",
            detail.promise.status === "kept" && "border-success/25 bg-success-soft/40",
            detail.promise.status === "broken" && "border-danger/25 bg-danger-soft/40",
          )}
        >
          <h3
            className={cn(
              "mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide",
              detail.promise.status === "pending" && "text-primary",
              detail.promise.status === "kept" && "text-success",
              detail.promise.status === "broken" && "text-danger",
            )}
          >
            <Clock weight="fill" className="size-3.5" />
            {detail.promise.status === "pending" ? t("promisePending") : detail.promise.status === "kept" ? t("promiseKept") : t("promiseBroken")}
          </h3>
          <p className="text-sm">{detail.promise.offerText}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("promiseAmount")}: <span className="font-medium text-foreground">{detail.promise.amount.formatted}</span> · {t("promiseDueDate")}: {fmtDate(detail.promise.dueDate)}
          </p>
        </Card>
      )}

      {/* Moliyalashtirish bozori — DS-Score bilan tasdiqlangan qarzni bank/NBKT ga sotish (sud o'rniga muqobil) */}
      {detail?.financing && (detail.financing.eligible || detail.financing.activeListingId) && (
        <Card className="border-primary/20 bg-primary-soft/10 p-5">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
            <HandCoins weight="fill" className="size-3.5" /> {t("financingHeading")}
          </h3>
          {detail.financing.activeListingId ? (
            <>
              <p className="text-sm">{t("financingListed")}</p>
              <Button variant="outline" onClick={() => doWithdrawFinancing(detail.financing.activeListingId!)} disabled={financingBusy} className="mt-3">
                {financingBusy ? t("saving") : t("financingWithdraw")}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {t("financingSuggested")}: <span className="font-medium text-foreground">{(detail.financing.suggestedDiscountBps / 100).toFixed(1)}%</span>
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">{t("financingHint")}</p>
              <Button onClick={doListForFinancing} disabled={financingBusy} className="mt-3">
                <HandCoins weight="fill" className="size-4" />
                {financingBusy ? t("saving") : t("financingList")}
              </Button>
            </>
          )}
        </Card>
      )}

      {/* Amounts */}
      <Card className="p-5">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("amountsHeading")}</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label={t("invoiceAmount")} value={detail?.amounts.invoice.formatted ?? row.invoiceAmount.formatted} />
          <Metric label={t("paid")} value={detail?.amounts.paid.formatted ?? "—"} tone="text-success" />
          <Metric label={t("outstanding")} value={detail?.amounts.outstanding.formatted ?? row.outstanding.formatted} />
          <Metric label={t("penalty")} value={detail?.amounts.penalty.formatted ?? row.penalty.formatted} tone="text-warning" />
        </div>
        <div className="mt-3 flex items-center justify-between rounded-lg bg-primary px-4 py-3 text-primary-foreground">
          <span className="text-sm font-medium opacity-90">{t("total")}</span>
          <span className="tabular font-display text-lg font-semibold">
            {detail?.amounts.total.formatted ?? row.outstanding.formatted}
          </span>
        </div>

        {/* To'lov qayd etish — oqimni yopadi */}
        {canPay && (
          <div className="mt-3 border-t border-border pt-3">
            {payOpen ? (
              <div className="space-y-2.5">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <Input
                    inputMode="numeric"
                    value={payAmount}
                    onChange={(e) => setPayAmount(formatMoneyInput(e.target.value))}
                    placeholder={t("paymentAmount")}
                    autoFocus
                  />
                  <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={submitPayment} disabled={paying || !unformatMoney(payAmount)}>
                    <CheckCircle weight="fill" className="size-4" />
                    {paying ? t("saving") : t("savePayment")}
                  </Button>
                  <Button variant="outline" onClick={() => setPayOpen(false)} disabled={paying}>
                    {t("cancel")}
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setPayOpen(true)} className="w-full">
                <CheckCircle weight="fill" className="size-4 text-success" />
                {t("recordPayment")}
              </Button>
            )}
            {!payOpen && (
              <>
                <Button variant="outline" onClick={doSendReminder} disabled={reminding} className="mt-2 w-full">
                  <PaperPlaneTilt weight="fill" className="size-4 text-primary" />
                  {reminding ? t("saving") : t("sendReminder")}
                </Button>
                <Button variant="outline" onClick={doEscalateToCourt} disabled={escalating} className="mt-2 w-full">
                  <Gavel weight="fill" className="size-4 text-danger" />
                  {escalating ? t("saving") : t("escalateToCourt")}
                </Button>
                <button
                  onClick={doWriteOff}
                  disabled={writingOff}
                  className="mt-2 w-full text-center text-xs font-medium text-muted-foreground transition-colors hover:text-danger disabled:opacity-50"
                >
                  {writingOff ? "…" : t("writeOff")}
                </button>
              </>
            )}
          </div>
        )}
      </Card>

      {/* Contractor + Contract */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("contractorHeading")}</h3>
          {detail ? (
            <dl className="space-y-2.5 text-sm">
              <InfoRow icon={MapPin} label={t("legalAddress")} value={detail.contractor.legalAddress} />
              <InfoRow icon={Bank} label={t("bankAccount")} value={detail.contractor.bankAccount} />
              <InfoRow icon={Receipt} label={t("bankMfo")} value={detail.contractor.bankMfo} />
              <InfoRow icon={Phone} label={t("phone")} value={detail.contractor.phone} />
              <InfoRow icon={EnvelopeSimple} label={t("email")} value={detail.contractor.email} />
              <InfoRow icon={TelegramLogo} label={t("telegram")} value={detail.contractor.telegramId} />
            </dl>
          ) : (
            <Loader />
          )}
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("contractHeading")}</h3>
          {detail ? (
            detail.contract ? (
              <dl className="space-y-2.5 text-sm">
                <InfoRow icon={FileText} label={t("contractNumber")} value={detail.contract.number} />
                <InfoRow icon={Clock} label={t("signedAt")} value={fmtDate(detail.contract.signedAt)} />
                <InfoRow
                  icon={Warning}
                  label={t("penaltyRate")}
                  value={`${detail.contract.penaltyDailyBps} bps · ${(detail.contract.penaltyDailyBps / 100).toFixed(2)}%/${t("overdueDays").split(" ")[0]}`}
                />
                <InfoRow
                  icon={ShieldWarning}
                  label={t("penaltyCap")}
                  value={detail.contract.penaltyCapBps ? `${(detail.contract.penaltyCapBps / 100).toFixed(0)}%` : t("noCap")}
                />
                <InfoRow icon={Receipt} label={t("invoiceHeading")} value={detail.invoice.number} />
                <InfoRow icon={Clock} label={t("dueDate")} value={fmtDate(detail.invoice.dueDate)} />
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">{t("noContract")}</p>
            )
          ) : (
            <Loader />
          )}
        </Card>
      </div>

      {/* Collection stages */}
      <Card className="p-5">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("collectionHeading")}</h3>
        <div className="flex items-center">
          {STAGES.map((s, i) => {
            const done = detail?.executedStages.includes(s.key) ?? false;
            const Icon = s.icon;
            return (
              <div key={s.key} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      "grid size-10 place-items-center rounded-full border-2 transition-colors",
                      done ? "border-success bg-success-soft text-success" : "border-border bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon weight={done ? "fill" : "regular"} className="size-5" />
                  </div>
                  <span className={cn("text-center text-[11px] font-medium", done ? "text-foreground" : "text-muted-foreground")}>
                    {tStage(s.key as never)}
                  </span>
                </div>
                {i < STAGES.length - 1 && (
                  <div className={cn("mx-1 h-0.5 flex-1 rounded-full", done ? "bg-success/50" : "bg-border")} />
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Reminders */}
      <Card className="p-5">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("reminderHeading")}</h3>
        {detail ? (
          detail.reminders.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noReminders")}</p>
          ) : (
            <ul className="space-y-3">
              {detail.reminders.map((rm) => {
                const Icon = CHANNEL_ICON[rm.channel] ?? PaperPlaneTilt;
                const tone: BadgeProps["tone"] =
                  rm.status === "delivered" || rm.status === "sent" ? "success" : rm.status === "failed" ? "danger" : "neutral";
                return (
                  <li key={rm.id} className="flex gap-3 rounded-lg border border-border bg-muted/20 p-3">
                    <div className="grid size-8 shrink-0 place-items-center rounded-md bg-card text-muted-foreground">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{tStage(rm.stage as never)}</span>
                        <Badge tone="neutral">{tChannel(rm.channel as never)}</Badge>
                        <Badge tone={tone}>{tRemStatus(rm.status as never)}</Badge>
                        <span className="ml-auto text-xs text-muted-foreground">{fmtDate(rm.sentAt ?? rm.createdAt)}</span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{rm.body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        ) : (
          <Loader />
        )}
      </Card>

      {/* Payments */}
      {detail && detail.payments.length > 0 && (
        <Card className="p-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("paymentHeading")}</h3>
          <ul className="divide-y divide-border">
            {detail.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <CheckCircle weight="fill" className="size-4 text-success" />
                  {fmtDate(p.paidAt)}
                </span>
                <span className="flex items-center gap-3">
                  <Badge tone="success">{tPayStatus(p.status as never)}</Badge>
                  <span className="tabular font-semibold">{p.amount.formatted}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {loading && <p className="text-center text-xs text-muted-foreground">…</p>}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/25 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("tabular mt-1 text-sm font-semibold", tone)}>{value}</p>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Bell; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="truncate font-medium">{value || "—"}</dd>
      </div>
    </div>
  );
}

function Loader() {
  return (
    <div className="flex items-center justify-center py-6 text-muted-foreground">
      <CircleNotch className="size-6 animate-spin" />
    </div>
  );
}
