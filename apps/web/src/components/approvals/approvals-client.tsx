"use client";

import { CheckCircle, Clock, FileText, Gavel, PenNib, SealCheck, ShieldCheck, XCircle } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { decideApproval, didoxPrepare, didoxSign } from "@/app/(app)/approvals/actions";
import { type EimzoSignature, signWithEimzo } from "@/lib/eimzo";
import { toDisplayHtml } from "@/lib/doc-html";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DocumentView } from "@/components/ui/document-view";
import { RichEditor } from "@/components/ui/rich-editor";
import { cn } from "@/lib/utils";
import { type OverrideItem, PendingOverrides } from "./pending-overrides";

export interface Approval {
  id: string;
  type: "demand_letter" | "court_claim" | "write_off";
  status: string;
  payload: {
    subject?: string;
    body?: string;
    principalMinor?: string;
    penaltyMinor?: string;
    totalMinor?: string;
    currency?: string;
    note?: string;
  };
  createdAt: string;
  decidedAt?: string | null;
  contractorName?: string | null;
  invoiceNumber?: string | null;
  overdueDays?: number | null;
}

type StatusKey = "pending" | "approved" | "rejected";

function fmtMinor(minor?: string, currency = "UZS"): string {
  if (!minor) return "—";
  const neg = minor.startsWith("-");
  const abs = BigInt(neg ? minor.slice(1) : minor);
  const major = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const frac = (abs % 100n).toString().padStart(2, "0");
  return `${neg ? "-" : ""}${major},${frac} ${currency}`;
}

const TYPE_ICON = { demand_letter: FileText, court_claim: Gavel, write_off: XCircle } as const;

export function ApprovalsClient({
  pending,
  approved,
  rejected,
  overrides,
}: {
  pending: Approval[];
  approved: Approval[];
  rejected: Approval[];
  overrides: OverrideItem[];
}) {
  const t = useTranslations("approvals");
  const lists: Record<StatusKey, Approval[]> = { pending, approved, rejected };
  const [status, setStatus] = useState<StatusKey>("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [signature, setSignature] = useState<EimzoSignature | null>(null);
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [didoxBusy, setDidoxBusy] = useState(false);
  const [didoxMsg, setDidoxMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const list = lists[status];
  const selected = selectedId ? list.find((a) => a.id === selectedId) ?? null : null;

  // Tanlangan hujjatning matnini tahrirlash uchun yuklaymiz; imzoni tozalaymiz.
  useEffect(() => {
    setEditBody(typeof selected?.payload.body === "string" ? toDisplayHtml(selected.payload.body) : "");
    setSignature(null);
    setSignError(null);
    setDidoxMsg(null);
  }, [selected?.id]);

  // Talabnoma → Didox: 1) prepare(toSign) → 2) E-IMZO imzo → 3) sign (jo'natish).
  async function sendViaDidox(id: string) {
    if (didoxBusy) return;
    setDidoxBusy(true);
    setDidoxMsg(null);
    try {
      const prep = await didoxPrepare(id);
      if (!prep.available || !prep.toSign) {
        const reasons: Record<string, string> = {
          not_configured: "Didox kaliti sozlanmagan",
          no_didox_invoice: "Bu hisob-faktura Didox'da topilmadi (Didox ID yo'q)",
          empty_notification: "Didox talabnoma qaytarmadi",
          didox_error: `Didox xatosi: ${prep.detail ?? ""}`,
          network: "Tarmoq xatosi",
        };
        setDidoxMsg(reasons[prep.reason ?? ""] ?? "Didox orqali yuborish hozircha mavjud emas");
        return;
      }
      const sig = await signWithEimzo(prep.toSign, "Rahbar"); // toSign'ni E-IMZO bilan imzolaymiz
      const res = await didoxSign(id, sig.pkcs7);
      if (res.status === "sent") {
        setDidoxMsg("✓ Talabnoma Didox orqali yuborildi");
        startTransition(() => setSelectedId(null));
      } else {
        setDidoxMsg(`Yuborilmadi: ${res.error ?? ""}`);
      }
    } catch (e) {
      setDidoxMsg(e instanceof Error ? e.message : "E-IMZO xatosi");
    } finally {
      setDidoxBusy(false);
    }
  }

  async function sign() {
    if (signing) return;
    setSigning(true);
    setSignError(null);
    try {
      const sig = await signWithEimzo(editBody, "Rahbar");
      setSignature(sig);
    } catch (e) {
      setSignError(e instanceof Error ? e.message : t("signFailed"));
    } finally {
      setSigning(false);
    }
  }

  const TABS: { key: StatusKey; count: number }[] = [
    { key: "pending", count: pending.length },
    { key: "approved", count: approved.length },
    { key: "rejected", count: rejected.length },
  ];

  function decide(id: string, decision: "approved" | "rejected") {
    setDecidingId(id);
    const body = typeof selected?.payload.body === "string" ? editBody : undefined;
    const sig = decision === "approved" ? signature ?? undefined : undefined;
    startTransition(async () => {
      await decideApproval(id, decision, body, sig);
      setDecidingId(null);
      setSelectedId(null);
    });
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <PendingOverrides initial={overrides} />

      {/* Status tabs */}
      <div className="mb-4 inline-flex gap-1 self-start rounded-lg border border-border bg-card p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setStatus(tab.key);
              setSelectedId(null);
            }}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              status === tab.key ? "bg-primary-soft text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(tab.key)}
            <span
              className={cn(
                "grid h-5 min-w-5 place-items-center rounded-full px-1 text-xs",
                status === tab.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[380px_1fr]">
        {/* List */}
        <div className="scroll-clean min-h-0 space-y-2 overflow-y-auto pr-1">
          {list.length === 0 && (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
              {t("empty")}
            </div>
          )}
          {list.map((a) => {
            const Icon = TYPE_ICON[a.type];
            const active = selected?.id === a.id;
            return (
              <button
                key={a.id}
                onClick={() => setSelectedId(a.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                  active ? "border-primary bg-primary-soft/40" : "border-border bg-card hover:bg-muted/50",
                )}
              >
                <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-md", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                  <Icon weight={active ? "fill" : "regular"} className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{a.contractorName ?? "—"}</span>
                    <Badge tone={a.type === "court_claim" ? "warning" : "primary"}>{t(`type.${a.type}`)}</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {a.invoiceNumber ?? ""} {a.overdueDays ? `· ${a.overdueDays} ${t("days")}` : ""}
                  </p>
                  {a.payload.totalMinor && (
                    <p className="tabular mt-1 text-sm font-semibold">{fmtMinor(a.payload.totalMinor, a.payload.currency)}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail */}
        <div className="flex min-h-0 flex-col">
          {!selected ? (
            <div className="flex h-full min-h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
              {t("select")}
            </div>
          ) : (
            <Card className="flex h-full min-h-0 flex-col">
              <CardContent className="flex min-h-0 flex-1 flex-col gap-5 p-6">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge tone={selected.type === "court_claim" ? "warning" : "primary"}>{t(`type.${selected.type}`)}</Badge>
                      {selected.status === "approved" && <Badge tone="success">{t("approved")}</Badge>}
                      {selected.status === "rejected" && <Badge tone="danger">{t("rejected")}</Badge>}
                    </div>
                    <h2 className="mt-2 font-display text-lg font-semibold">{selected.contractorName ?? "—"}</h2>
                    <p className="text-sm text-muted-foreground">
                      {selected.invoiceNumber} {selected.overdueDays ? `· ${t("overdue")}: ${selected.overdueDays} ${t("days")}` : ""}
                    </p>
                  </div>
                </div>

                {/* Amounts */}
                {selected.payload.totalMinor && (
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: t("principal"), v: selected.payload.principalMinor, tone: "text-foreground" },
                      { label: t("penalty"), v: selected.payload.penaltyMinor, tone: "text-warning" },
                      { label: t("total"), v: selected.payload.totalMinor, tone: "text-primary" },
                    ].map((x) => (
                      <div key={x.label} className="rounded-lg border border-border bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground">{x.label}</p>
                        <p className={cn("tabular mt-1 text-sm font-semibold", x.tone)}>{fmtMinor(x.v, selected.payload.currency)}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Document body — pending bo'lsa tahrirlanadi, aks holda faqat o'qish */}
                {selected.payload.body ? (
                  <div className="flex min-h-0 flex-1 flex-col">
                    <p className="mb-2 flex items-center justify-between gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <FileText className="size-4" /> {t("document")}
                      </span>
                      {selected.status === "pending" && <span className="normal-case text-[11px] text-muted-foreground/70">{t("editable")}</span>}
                    </p>
                    {selected.status === "pending" ? (
                      <RichEditor value={editBody} onChange={setEditBody} className="min-h-0 flex-1" />
                    ) : (
                      <DocumentView body={selected.payload.body} className="scroll-clean min-h-0 flex-1 overflow-y-auto" />
                    )}
                  </div>
                ) : selected.payload.note ? (
                  <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">{selected.payload.note}</div>
                ) : null}

                {/* E-IMZO imzo (talabnoma uchun) */}
                {selected.status === "pending" && selected.payload.body && (
                  <div className="shrink-0 rounded-lg border border-border bg-muted/20 p-3">
                    {signature ? (
                      <div className="flex items-center gap-2.5">
                        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-success-soft text-success">
                          <ShieldCheck weight="fill" className="size-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-success">
                            {signature.provider === "eimzo" ? t("realSigned") : t("signed")}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {t("signedBy")}: {signature.signerName} · {signature.certSerial}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground">{t("demoNote")}</p>
                          <Button variant="outline" onClick={sign} disabled={signing}>
                            <PenNib weight="fill" className="size-4" />
                            {signing ? t("signing") : t("sign")}
                          </Button>
                        </div>
                        {signError && <p className="text-xs text-danger">{signError}</p>}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                {selected.status === "pending" && (
                  <div className="flex shrink-0 items-center gap-3 border-t border-border pt-4">
                    <Button
                      onClick={() => decide(selected.id, "approved")}
                      disabled={(isPending && decidingId === selected.id) || signing}
                    >
                      <SealCheck weight="fill" className="size-4" />
                      {isPending && decidingId === selected.id
                        ? t("approving")
                        : signature
                          ? t("approveSigned")
                          : t("approve")}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => decide(selected.id, "rejected")}
                      disabled={isPending && decidingId === selected.id}
                      className="text-danger hover:bg-danger-soft"
                    >
                      <XCircle className="size-4" />
                      {t("reject")}
                    </Button>
                    {selected.type === "demand_letter" && (
                      <Button
                        variant="outline"
                        onClick={() => sendViaDidox(selected.id)}
                        disabled={didoxBusy || (isPending && decidingId === selected.id)}
                        className="ml-auto border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
                      >
                        <ShieldCheck weight="fill" className="size-4" />
                        {didoxBusy ? "Didox'ga yuborilmoqda…" : "Didox orqali yuborish (E-IMZO)"}
                      </Button>
                    )}
                  </div>
                )}
                {didoxMsg && (
                  <div
                    className={
                      "shrink-0 rounded-lg border px-3 py-2 text-xs " +
                      (didoxMsg.startsWith("✓")
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-600")
                    }
                  >
                    {didoxMsg}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
