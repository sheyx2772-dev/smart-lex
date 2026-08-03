import {
  ArrowLeft,
  Bank,
  Bell,
  Buildings,
  CheckCircle,
  CurrencyCircleDollar,
  EnvelopeSimple,
  FileText,
  Gavel,
  MapPin,
  Phone,
  Receipt,
  Scroll,
  SealCheck,
  ShieldWarning,
  TelegramLogo,
  Timer,
  Warning,
} from "@phosphor-icons/react/dist/ssr";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CollectionPipeline } from "@/components/companies/collection-pipeline";
import { InteractionLog, type Interaction } from "@/components/companies/interaction-log";
import { LawsuitButton } from "@/components/companies/lawsuit-button";
import { PaymentReminderButton } from "@/components/companies/payment-reminder-button";
import { ReconciliationButton } from "@/components/companies/reconciliation-button";
import { StatTile } from "@/components/dashboard/stat-tile";
import { Badge, STATUS_TONE } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiServer } from "@/lib/api";

interface Amount {
  minor: string;
  formatted: string;
}
interface CaseData {
  contractor: {
    id: string;
    name: string;
    tin: string;
    legalAddress: string | null;
    bankAccount: string | null;
    bankMfo: string | null;
    phone: string | null;
    email: string | null;
    telegramId: string | null;
  };
  summary: {
    totalOutstanding: Amount;
    totalPenalty: Amount;
    totalPaid: Amount;
    overdueCount: number;
    riskScore: number;
    contractsCount: number;
    invoicesCount: number;
    documentsCount: number;
    remindersCount: number;
  };
  contracts: { id: string; number: string; signedAt: string | null; penaltyDailyBps: number; penaltyCapBps: number | null }[];
  invoices: { id: string; number: string; amount: Amount; issuedAt: string; dueDate: string; status: string; overdueDays: number; outstanding: Amount; penalty: Amount }[];
  documents: { id: string; type: string; title: string; didoxId: string | null; createdAt: string }[];
  reminders: { id: string; stage: string; channel: string; status: string; sentAt: string | null; createdAt: string }[];
  approvals: { id: string; type: string; status: string; createdAt: string; decidedAt: string | null }[];
  timeline: { at: string | null; type: string; title: string; ref: string | null }[];
}

const EVENT_ICON: Record<string, typeof Bell> = {
  contract: Scroll,
  invoice: Receipt,
  payment: CheckCircle,
  reminder: Bell,
  document: FileText,
  approval_demand_letter: Warning,
  approval_court_claim: Gavel,
  approval_write_off: FileText,
};
const EVENT_TONE: Record<string, string> = {
  contract: "bg-primary-soft text-primary",
  invoice: "bg-secondary-soft text-secondary",
  payment: "bg-success-soft text-success",
  reminder: "bg-muted text-muted-foreground",
  document: "bg-primary-soft text-primary",
  approval_demand_letter: "bg-warning-soft text-warning",
  approval_court_claim: "bg-danger-soft text-danger",
  approval_write_off: "bg-muted text-muted-foreground",
};

function riskTone(score: number): "danger" | "warning" | "success" {
  if (score >= 70) return "danger";
  if (score >= 40) return "warning";
  return "success";
}

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("companies");
  const tStatus = await getTranslations("status");
  const tStage = await getTranslations("stage");
  const tDocType = await getTranslations("docType");

  const [res, intRes] = await Promise.all([
    apiServer<CaseData>(`/api/companies/${id}`),
    apiServer<{ items: Interaction[] }>(`/api/companies/${id}/interactions`),
  ]);
  const d = res.data;
  if (!d) notFound();
  const interactions = intRes.data?.items ?? [];

  const s = d.summary;
  const fmtDate = (x: string | null) => (x ? new Date(x).toLocaleDateString() : "—");
  const evLabel = (type: string) => (t.has(`ev.${type}` as never) ? t(`ev.${type}` as never) : type);

  // Deterministik AI tavsiyasi (LLM emas — biznes qoidasi).
  const hasPendingApproval = d.approvals.some((a) => a.status === "pending");
  let recKey = "recNothing";
  let recTone: "success" | "warning" | "danger" | "primary" = "success";
  if (hasPendingApproval) {
    recKey = "recApprove";
    recTone = "primary";
  } else if (s.overdueCount > 0) {
    if (s.remindersCount === 0) {
      recKey = "recRemind";
      recTone = "warning";
    } else {
      recKey = "recDemand";
      recTone = "danger";
    }
  }

  // ── Undiruv voronkasi: hozirgi bosqich (0..5) + keyingi qadam ──────────
  const approvedAny = d.approvals.some((a) => a.status === "approved");
  const approvedClaim = d.approvals.some((a) => (a.type || "").includes("court") && a.status === "approved");
  let pipeStage = 0; // Qarzdorlik
  if (s.remindersCount > 0) pipeStage = 1; // Eslatma yuborildi
  if (d.approvals.length > 0) pipeStage = 2; // Talabnoma/Da'vo tayyorlandi
  if (approvedAny) pipeStage = 3; // Tasdiqlandi
  if (approvedClaim) pipeStage = 4; // Sudga tayyor
  const pipeNext =
    pipeStage === 0
      ? { text: t("pipeNext0") }
      : pipeStage === 1
        ? { text: t("pipeNext1") }
        : pipeStage === 2
          ? { text: t("pipeNext2"), href: "/approvals", cta: t("pipeCtaApprove") }
          : pipeStage === 3 || pipeStage === 4
            ? { text: t("pipeNext3"), href: "/court", cta: t("pipeCtaFile") }
            : { text: t("pipeNext5") };
  const pipeLabels = [t("pipe0"), t("pipe1"), t("pipe2"), t("pipe3"), t("pipe4"), t("pipe5")];

  return (
    <div className="w-full space-y-5">
      {/* Back */}
      <Link href="/companies" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" /> {t("back")}
      </Link>

      {/* Header */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-secondary text-white shadow-sm shadow-primary/30">
              <Buildings weight="fill" className="size-6" />
            </div>
            <div>
              <h1 className="font-display text-xl font-semibold tracking-tight">{d.contractor.name}</h1>
              <p className="text-sm text-muted-foreground">{t("tin")}: {d.contractor.tin}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PaymentReminderButton name={d.contractor.name} amount={d.summary.totalOutstanding.formatted} />
            <ReconciliationButton contractorId={d.contractor.id} />
            <LawsuitButton contractorId={d.contractor.id} />
            <Badge tone={riskTone(s.riskScore)}>
              <ShieldWarning weight="fill" className="size-3.5" />
              {t("risk")} · {s.riskScore}
            </Badge>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
          <Info icon={MapPin} label={t("legalAddress")} value={d.contractor.legalAddress} />
          <Info icon={Bank} label={t("bankAccount")} value={d.contractor.bankAccount} />
          <Info icon={Receipt} label={t("bankMfo")} value={d.contractor.bankMfo} />
          <Info icon={Phone} label={t("phone")} value={d.contractor.phone} />
          <Info icon={EnvelopeSimple} label={t("email")} value={d.contractor.email} />
          <Info icon={TelegramLogo} label={t("telegram")} value={d.contractor.telegramId} />
        </dl>
      </Card>

      {/* Undiruv voronkasi — hozirgi bosqich + keyingi qadam (chalkashlikni kamaytiradi) */}
      <CollectionPipeline current={pipeStage} labels={pipeLabels} heading={t("pipeHeading")} nextLabel={t("pipeNextLabel")} next={pipeNext} />

      {/* Stat tiles */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={t("totalDebt")} value={s.totalOutstanding.formatted} tone="primary" icon={<CurrencyCircleDollar weight="fill" className="size-4" />} />
        <StatTile label={t("paid")} value={s.totalPaid.formatted} tone="secondary" icon={<CheckCircle weight="fill" className="size-4" />} />
        <StatTile label={t("penalty")} value={s.totalPenalty.formatted} tone="warning" icon={<Warning weight="fill" className="size-4" />} />
        <StatTile label={t("overdueCount")} value={String(s.overdueCount)} tone="danger" plain icon={<Timer weight="fill" className="size-4" />} />
      </div>

      {/* AI recommendation */}
      <div
        className={`flex items-center gap-3 rounded-xl border p-4 ${
          recTone === "success"
            ? "border-success/30 bg-success-soft"
            : recTone === "warning"
              ? "border-warning/30 bg-warning-soft"
              : recTone === "danger"
                ? "border-danger/30 bg-danger-soft"
                : "border-primary/30 bg-primary-soft"
        }`}
      >
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-card/70">
          <SealCheck weight="fill" className={`size-5 ${recTone === "success" ? "text-success" : recTone === "warning" ? "text-warning" : recTone === "danger" ? "text-danger" : "text-primary"}`} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("aiHeading")} · {t("recommend")}</p>
          <p className="font-medium">{t(recKey as never)}</p>
        </div>
        {hasPendingApproval && (
          <Link href="/approvals" className="ml-auto shrink-0 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
            {t("aiHeading")}
          </Link>
        )}
      </div>

      {/* Timeline + sections */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Left: invoices + documents + contracts */}
        <div className="space-y-4">
          {/* Invoices */}
          <Card>
            <CardHeader>
              <CardTitle>{t("invoices")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-y border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-5 py-2.5 font-medium">{t("invoiceNo")}</th>
                      <th className="px-5 py-2.5 text-right font-medium">{t("amount")}</th>
                      <th className="px-5 py-2.5 font-medium">{t("due")}</th>
                      <th className="px-5 py-2.5 font-medium">{t("status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.invoices.length === 0 && (
                      <tr><td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">{t("noData")}</td></tr>
                    )}
                    {d.invoices.map((inv) => (
                      <tr key={inv.id} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                        <td className="px-5 py-3 font-medium">{inv.number}</td>
                        <td className="tabular px-5 py-3 text-right font-semibold">{inv.amount.formatted}</td>
                        <td className="px-5 py-3 text-muted-foreground">
                          {fmtDate(inv.dueDate)}
                          {inv.overdueDays > 0 && <span className="ml-1 text-danger">· {inv.overdueDays}k</span>}
                        </td>
                        <td className="px-5 py-3"><Badge tone={STATUS_TONE[inv.status]}>{tStatus(inv.status as never)}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader>
              <CardTitle>{t("documents")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {d.documents.length === 0 && <p className="text-sm text-muted-foreground">{t("noData")}</p>}
              {d.documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-card text-muted-foreground">
                    <FileText className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">{tDocType(doc.type as never)} · {fmtDate(doc.createdAt)}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Contracts */}
          <Card>
            <CardHeader>
              <CardTitle>{t("contractsSection")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {d.contracts.length === 0 && <p className="text-sm text-muted-foreground">{t("noData")}</p>}
              {d.contracts.map((k) => (
                <div key={k.id} className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-card text-primary">
                    <Scroll className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{k.number}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(k.signedAt)} · {(k.penaltyDailyBps / 100).toFixed(2)}%/kun</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <InteractionLog contractorId={id} initial={interactions} />
        </div>

        {/* Right: Timeline */}
        <Card className="lg:sticky lg:top-0 lg:self-start">
          <CardHeader>
            <CardTitle>{t("timeline")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="relative">
              {d.timeline.map((e, i) => {
                const Ic = EVENT_ICON[e.type] ?? FileText;
                const tone = EVENT_TONE[e.type] ?? "bg-muted text-muted-foreground";
                return (
                  <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                    <div className="flex flex-col items-center">
                      <span className={`grid size-8 shrink-0 place-items-center rounded-full ring-4 ring-card ${tone}`}>
                        <Ic weight="fill" className="size-4" />
                      </span>
                      {i < d.timeline.length - 1 && <span className="w-px flex-1 bg-border" />}
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="text-sm font-medium leading-snug">{evLabel(e.type)}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {e.title}
                        {e.ref && <span> · {e.ref}</span>}
                      </p>
                      <p className="tabular text-[11px] text-muted-foreground/70">{fmtDate(e.at)}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Bell; label: string; value: string | null }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="truncate text-sm font-medium">{value || "—"}</dd>
      </div>
    </div>
  );
}
