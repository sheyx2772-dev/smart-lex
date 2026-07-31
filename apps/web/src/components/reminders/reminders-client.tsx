"use client";

import {
  Bell,
  CheckCircle,
  EnvelopeSimple,
  FileText,
  Gavel,
  MagnifyingGlass,
  PaperPlaneTilt,
  TelegramLogo,
  Warning,
  XCircle,
  type Icon,
} from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { fetchReminders, sendReminder, type SendReminderResult } from "@/app/(app)/reminders/actions";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DocumentView } from "@/components/ui/document-view";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

interface ReminderItem {
  id: string;
  stage: string;
  channel: string;
  status: string;
  address: string;
  body: string;
  paymentLink: string | null;
  sentAt: string | null;
  createdAt: string;
  contractorName: string;
  contractorTin: string;
  invoiceNumber: string;
}
export interface RemindersData {
  items: ReminderItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  byChannel: Record<string, number>;
  byStatus: Record<string, number>;
  allTotal: number;
}
export interface ReminderDebtor {
  id: string;
  name: string;
  invoice: string;
  overdueDays: number;
}

const CHANNEL_ICON: Record<string, Icon> = {
  sms: PaperPlaneTilt,
  email: EnvelopeSimple,
  telegram: TelegramLogo,
  hybrid_post: FileText,
};
const STAGE_ICON: Record<string, Icon> = {
  soft_reminder: Bell,
  firm_reminder: Warning,
  demand_letter: FileText,
  court: Gavel,
};
const CHANNEL_ORDER = ["sms", "email", "telegram", "hybrid_post"];
const STATUS_ORDER = ["sent", "delivered", "queued", "failed"];

function statusTone(s: string): BadgeProps["tone"] {
  if (s === "delivered") return "success";
  if (s === "sent") return "primary";
  if (s === "failed") return "danger";
  return "neutral";
}

export function RemindersClient({ initial, debtors = [] }: { initial: RemindersData; debtors?: ReminderDebtor[] }) {
  const t = useTranslations("reminders");
  const tChannel = useTranslations("channel");
  const tStage = useTranslations("stage");
  const tStatus = useTranslations("reminderStatus");
  const locale = useLocale();
  const ru = locale === "ru";

  const [data, setData] = useState<RemindersData>(initial);
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const firstQ = useRef(true);

  // «Yangi eslatma» (SMS) yuborish modali
  const [sendOpen, setSendOpen] = useState(false);
  const [sendRecId, setSendRecId] = useState("");
  const [sendStage, setSendStage] = useState<"soft_reminder" | "firm_reminder">("soft_reminder");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<SendReminderResult | null>(null);

  async function doSend() {
    if (!sendRecId || sending) return;
    setSending(true);
    setSendResult(null);
    const res = await sendReminder(sendRecId, sendStage);
    setSendResult(res);
    setSending(false);
    if (res.status === "sent") load(1, channel, status, q);
  }

  const fmtDateTime = (d: string | null) =>
    d
      ? new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d))
      : "—";

  async function load(page: number, ch = channel, st = status, query = q) {
    setLoading(true);
    setSelectedId(null);
    const d = await fetchReminders({ page, channel: ch, status: st, q: query });
    if (d) setData(d);
    setLoading(false);
  }

  useEffect(() => {
    if (firstQ.current) {
      firstQ.current = false;
      return;
    }
    const id = setTimeout(() => load(1, channel, status, q), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const selected = selectedId ? data.items.find((r) => r.id === selectedId) ?? null : null;
  const channels = ["all", ...CHANNEL_ORDER.filter((ch) => data.byChannel[ch])];
  const statuses = STATUS_ORDER.filter((s) => data.byStatus[s]);

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
            onClick={() => {
              setSendResult(null);
              setSendRecId(debtors[0]?.id ?? "");
              setSendOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:scale-[1.02]"
          >
            <PaperPlaneTilt weight="fill" className="size-4" /> {ru ? "Новое напоминание (SMS)" : "Yangi eslatma (SMS)"}
          </button>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2">
            <span className="text-xs text-muted-foreground">{t("total")}</span>
            <span className="tabular font-display text-lg font-semibold">{data.allTotal}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
          {channels.map((ch) => (
            <button
              key={ch}
              onClick={() => {
                setChannel(ch);
                load(1, ch, status, q);
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                channel === ch ? "bg-primary-soft text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {ch === "all" ? t("all") : tChannel(ch as never)}
              <span
                className={cn(
                  "grid h-5 min-w-5 place-items-center rounded-full px-1 text-xs",
                  channel === ch ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {ch === "all" ? data.allTotal : data.byChannel[ch] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {statuses.length > 1 && (
          <div className="inline-flex gap-1 rounded-lg border border-border bg-card p-1">
            <button
              onClick={() => {
                setStatus("all");
                load(1, channel, "all", q);
              }}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                status === "all" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t("all")}
            </button>
            {statuses.map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatus(st);
                  load(1, channel, st, q);
                }}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  status === st ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tStatus(st as never)}
              </button>
            ))}
          </div>
        )}

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
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[420px_1fr]">
        {/* List + pagination */}
        <div className="flex min-h-0 flex-col">
          <div className={cn("scroll-clean min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 transition-opacity", loading && "opacity-50")}>
            {data.items.length === 0 && (
              <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                {t("empty")}
              </div>
            )}
            {data.items.map((r) => {
              const Ch = CHANNEL_ICON[r.channel] ?? PaperPlaneTilt;
              const active = selected?.id === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
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
                    <Ch weight={active ? "fill" : "regular"} className="size-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{r.contractorName}</span>
                      <Badge tone={statusTone(r.status)}>{tStatus(r.status as never)}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {tStage(r.stage as never)} · {r.invoiceNumber}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/80">{r.body.replace(/<[^>]+>/g, " ")}</p>
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
            <Preview r={selected} t={t} tChannel={tChannel} tStage={tStage} tStatus={tStatus} fmtDateTime={fmtDateTime} />
          )}
        </div>
      </div>

      {/* «Yangi eslatma» (SMS) yuborish modali */}
      {sendOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !sending && setSendOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-xl bg-primary-soft text-primary">
                <PaperPlaneTilt weight="fill" className="size-5" />
              </span>
              <div>
                <h3 className="font-display text-base font-semibold">{ru ? "Отправить напоминание (SMS)" : "Eslatma yuborish (SMS)"}</h3>
                <p className="text-xs text-muted-foreground">{ru ? "Простое SMS-напоминание должнику" : "Qarzdorga oddiy SMS eslatma"}</p>
              </div>
            </div>

            {debtors.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{ru ? "Нет должников" : "Qarzdorlar yo'q"}</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">{ru ? "Должник" : "Qarzdor"}</label>
                  <select
                    value={sendRecId}
                    onChange={(e) => setSendRecId(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
                  >
                    {debtors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} · {d.invoice}
                        {d.overdueDays > 0 ? ` · ${d.overdueDays} ${ru ? "дн" : "kun"}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">{ru ? "Тип" : "Turi"}</label>
                  <div className="flex gap-2">
                    {(["soft_reminder", "firm_reminder"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setSendStage(s)}
                        className={cn(
                          "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                          sendStage === s ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-foreground hover:border-primary/40",
                        )}
                      >
                        {tStage(s as never)}
                      </button>
                    ))}
                  </div>
                </div>

                {sendResult && (
                  <div
                    className={cn(
                      "rounded-lg border px-3 py-2 text-xs",
                      sendResult.status === "sent" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : "border-red-500/30 bg-red-500/10 text-red-500",
                    )}
                  >
                    {sendResult.status === "sent"
                      ? sendResult.simulated
                        ? ru
                          ? "✓ Отправлено (симуляция — SMS-ключ Eskiz не подключён)"
                          : "✓ Yuborildi (simulyatsiya — Eskiz SMS kaliti ulanmagan)"
                        : ru
                          ? "✓ SMS реально отправлено"
                          : "✓ SMS haqiqatan yuborildi"
                      : ru
                        ? `Ошибка: ${sendResult.error ?? ""}`
                        : `Xato: ${sendResult.error ?? ""}`}
                    {sendResult.preview && <div className="mt-1 line-clamp-3 text-muted-foreground">{sendResult.preview}</div>}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={() => setSendOpen(false)} disabled={sending} className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50">
                    {ru ? "Закрыть" : "Yopish"}
                  </button>
                  <button
                    onClick={doSend}
                    disabled={sending || !sendRecId}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    <PaperPlaneTilt weight="fill" className="size-4" /> {sending ? (ru ? "Отправка…" : "Yuborilmoqda…") : ru ? "Отправить" : "Yuborish"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Preview({
  r,
  t,
  tChannel,
  tStage,
  tStatus,
  fmtDateTime,
}: {
  r: ReminderItem;
  t: ReturnType<typeof useTranslations>;
  tChannel: ReturnType<typeof useTranslations>;
  tStage: ReturnType<typeof useTranslations>;
  tStatus: ReturnType<typeof useTranslations>;
  fmtDateTime: (d: string | null) => string;
}) {
  const Ch = CHANNEL_ICON[r.channel] ?? PaperPlaneTilt;
  const St = STAGE_ICON[r.stage] ?? Bell;
  const StatusIcon = r.status === "failed" ? XCircle : CheckCircle;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
            <Ch weight="fill" className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge tone="neutral">{tChannel(r.channel as never)}</Badge>
              <Badge tone={statusTone(r.status)}>
                <StatusIcon weight="fill" className="size-3" />
                {tStatus(r.status as never)}
              </Badge>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <St className="size-3.5" /> {tStage(r.stage as never)}
              </span>
            </div>
            <h2 className="font-display text-lg font-semibold tracking-tight">{r.contractorName}</h2>
            <p className="text-sm text-muted-foreground">
              {r.invoiceNumber} · {r.contractorTin}
            </p>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Field label={t("recipient")} value={r.address} mono />
          <Field label={t("sentAt")} value={fmtDateTime(r.sentAt ?? r.createdAt)} />
        </dl>
      </Card>

      <Card className="p-5">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <EnvelopeSimple className="size-4" /> {t("body")}
        </p>
        <DocumentView body={r.body} />
        {r.paymentLink && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary-soft px-3 py-2 text-sm">
            <span className="text-muted-foreground">{t("paymentLink")}:</span>
            <span className="tabular truncate font-mono text-xs text-primary">{r.paymentLink}</span>
          </div>
        )}
      </Card>
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
