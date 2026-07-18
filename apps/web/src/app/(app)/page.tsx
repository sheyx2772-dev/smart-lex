import {
  ArrowRight,
  Bell,
  ChartLineUp,
  CheckCircle,
  Clock,
  CurrencyCircleDollar,
  FileText,
  Gavel,
  PencilSimpleLine,
  Plus,
  Robot,
  SealCheck,
  ShieldWarning,
  Timer,
  TrendUp,
  Truck,
  Warning,
} from "@phosphor-icons/react/dist/ssr";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { AgingBar } from "@/components/dashboard/aging-bar";
import { StatTile } from "@/components/dashboard/stat-tile";
import { Badge, STATUS_TONE } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiServer } from "@/lib/api";

interface Amount {
  minor: string;
  formatted: string;
}
interface Dashboard {
  currency: string;
  kpis: {
    totalOutstanding: Amount;
    totalPenalty: Amount;
    recovered: Amount;
    totalReceivables: number;
    overdueCount: number;
    paidCount: number;
    highRisk: number;
    avgOverdueDays: number;
    collectionRate: number;
    pendingApprovals: number;
    remindersSent: number;
  };
  todaysWork: { reminders: number; demands: number; documents: number; pendingApprovals: number };
  byStatus: Record<string, number>;
  aging: Record<string, Amount>;
  funnel: { stage: string; count: number }[];
  topDebtors: { contractorId: string; name: string; tin: string; outstanding: Amount; penalty: Amount; overdueDays: number; riskScore: number }[];
  recentReceivables: {
    id: string;
    status: string;
    outstanding: Amount;
    penalty: Amount;
    overdueDays: number;
    riskScore: number;
    invoiceNumber: string;
    dueDate: string;
    contractorName: string;
  }[];
  activity: { id: string; actorType: string; action: string; detail: Record<string, unknown> | null; createdAt: string }[];
}

const STATUS_COLOR: Record<string, string> = {
  paid: "var(--color-success)",
  pending: "var(--color-muted-foreground)",
  partial: "var(--color-warning)",
  overdue: "var(--color-danger)",
  written_off: "var(--color-secondary)",
};
const STAGE_ICON: Record<string, typeof Bell> = {
  soft_reminder: Bell,
  firm_reminder: Warning,
  demand_letter: FileText,
  court: Gavel,
};
const ACTOR_ICON: Record<string, typeof Robot> = { ai_agent: Robot, user: SealCheck, system: ShieldWarning };

function riskTone(score: number): "danger" | "warning" | "success" {
  if (score >= 70) return "danger";
  if (score >= 40) return "warning";
  return "success";
}

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const tStatus = await getTranslations("status");
  const tStage = await getTranslations("stage");
  const tAudit = await getTranslations("audit");
  const tCommon = await getTranslations("common");
  const tNav = await getTranslations("nav");

  const quickActions = [
    { href: "/overdue", label: tNav("overdue"), icon: Timer },
    { href: "/scoring", label: tNav("scoring"), icon: ChartLineUp },
    { href: "/studio", label: tNav("studio"), icon: PencilSimpleLine },
    { href: "/contracts", label: tNav("contracts"), icon: FileText },
    { href: "/court", label: tNav("court"), icon: Gavel },
    { href: "/enforcement", label: tNav("enforcement"), icon: Truck },
  ];

  const res = await apiServer<Dashboard>("/api/dashboard");
  const d = res.data;

  if (!d) {
    return <div className="text-sm text-muted-foreground">{t("empty")}</div>;
  }
  const k = d.kpis;
  const fmtDate = (s: string) => new Date(s).toLocaleDateString();
  const actionLabel = (a: string) => (tAudit.has(`action.${a}` as never) ? tAudit(`action.${a}` as never) : a);

  // Status donut (conic-gradient).
  const statusEntries = Object.entries(d.byStatus).filter(([, n]) => n > 0);
  const statusTotal = statusEntries.reduce((s, [, n]) => s + n, 0);
  let acc = 0;
  const segs = statusEntries.map(([key, n]) => {
    const start = (acc / statusTotal) * 360;
    acc += n;
    const end = (acc / statusTotal) * 360;
    return `${STATUS_COLOR[key] ?? "var(--color-muted)"} ${start}deg ${end}deg`;
  });
  const donut = statusTotal > 0 ? `conic-gradient(${segs.join(", ")})` : "var(--color-muted)";
  const funnelMax = Math.max(1, ...d.funnel.map((f) => f.count));

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t("goodMorning") : hour < 18 ? t("goodDay") : t("goodEvening");
  const w = d.todaysWork;
  const workItems = [
    { n: w.documents, label: t("wDocuments") },
    { n: w.reminders, label: t("wReminders") },
    { n: w.demands, label: t("wDemands") },
  ].filter((x) => x.n > 0);

  return (
    <div className="w-full space-y-5">
      {/* AI Workspace hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary-soft/60 via-card to-secondary-soft/40 p-6">
        <div
          className="pointer-events-none absolute -right-10 -top-10 size-48 rounded-full opacity-50"
          style={{ background: "radial-gradient(circle, rgba(120,124,135,0.14), transparent 70%)" }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{greeting} 👋</p>
            <h1 className="mt-0.5 font-display text-2xl font-semibold tracking-tight">{t("aiToday")}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              {workItems.length === 0 ? (
                <span className="inline-flex items-center gap-2 rounded-lg bg-success-soft px-3 py-1.5 text-sm font-medium text-success">
                  <CheckCircle weight="fill" className="size-4" /> {t("allDone")}
                </span>
              ) : (
                workItems.map((x) => (
                  <span key={x.label} className="inline-flex items-center gap-2 rounded-lg bg-card px-3 py-1.5 text-sm shadow-sm ring-1 ring-border">
                    <CheckCircle weight="fill" className="size-4 text-success" />
                    <span className="tabular font-semibold">{x.n}</span>
                    <span className="text-muted-foreground">{x.label}</span>
                  </span>
                ))
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {w.pendingApprovals > 0 && (
              <Link
                href="/approvals"
                className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 font-medium transition-colors hover:border-primary/40"
              >
                <SealCheck weight="fill" className="size-5 text-primary" />
                <span className="tabular">{w.pendingApprovals}</span> {t("wApprovals")}
              </Link>
            )}
            <Link
              href="/contracts/new"
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-medium text-primary-foreground shadow-sm shadow-primary/30 transition-transform hover:scale-[1.02]"
            >
              <Plus weight="bold" className="size-5" /> {t("newCase")}
            </Link>
          </div>
        </div>
      </div>

      {/* Tezkor amallar — workflow'ga o'tish */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("quickActions")}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {quickActions.map((a) => {
            const Ic = a.icon;
            return (
              <Link
                key={a.href}
                href={a.href}
                className="group flex items-center gap-2.5 rounded-xl border border-border bg-card p-3.5 transition-colors hover:border-primary/40 hover:bg-primary-soft/25"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Ic weight="fill" className="size-5" />
                </span>
                <span className="min-w-0 truncate text-sm font-medium">{a.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={t("totalOutstanding")} value={k.totalOutstanding.formatted} tone="primary" icon={<CurrencyCircleDollar weight="fill" className="size-4" />} />
        <StatTile label={t("recovered")} value={k.recovered.formatted} tone="secondary" icon={<TrendUp weight="fill" className="size-4" />} />
        <StatTile label={t("totalPenalty")} value={k.totalPenalty.formatted} tone="warning" icon={<Warning weight="fill" className="size-4" />} />
        <StatTile label={t("collectionRate")} value={`${k.collectionRate}%`} tone="primary" plain icon={<ChartLineUp weight="fill" className="size-4" />} />
      </div>

      {/* Secondary metrics strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MiniStat icon={<FileText weight="fill" className="size-4" />} label={t("totalReceivables")} value={String(k.totalReceivables)} />
        <MiniStat icon={<Timer weight="fill" className="size-4" />} label={t("overdueCount")} value={String(k.overdueCount)} tone="text-danger" />
        <MiniStat icon={<Clock weight="fill" className="size-4" />} label={t("avgOverdue")} value={`${k.avgOverdueDays} ${t("days")}`} />
        <MiniStat icon={<ShieldWarning weight="fill" className="size-4" />} label={t("highRisk")} value={String(k.highRisk)} tone="text-danger" />
        <MiniStat icon={<Bell weight="fill" className="size-4" />} label={t("remindersSent")} value={String(k.remindersSent)} />
        <MiniStat icon={<SealCheck weight="fill" className="size-4" />} label={t("pendingApprovals")} value={String(k.pendingApprovals)} tone="text-primary" />
      </div>

      {/* Aging + Status */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("aging")}</CardTitle>
          </CardHeader>
          <CardContent>
            <AgingBar aging={d.aging} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("byStatus")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-5">
              <div className="relative grid size-28 shrink-0 place-items-center rounded-full" style={{ background: donut }}>
                <div className="grid size-16 place-items-center rounded-full bg-card">
                  <span className="tabular font-display text-xl font-semibold">{statusTotal}</span>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                {statusEntries.map(([key, n]) => (
                  <div key={key} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="size-2.5 rounded-sm" style={{ background: STATUS_COLOR[key] }} />
                      {tStatus(key as never)}
                    </span>
                    <span className="tabular text-xs font-medium">{n}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Funnel + Top debtors */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("funnel")}</CardTitle>
            <p className="text-xs text-muted-foreground">{t("funnelDesc")}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {d.funnel.map((f) => {
              const Ic = STAGE_ICON[f.stage] ?? Bell;
              return (
                <div key={f.stage} className="flex items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <Ic weight="fill" className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">{tStage(f.stage as never)}</span>
                      <span className="tabular text-muted-foreground">
                        {f.count} {t("reached")}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
                        style={{ width: `${(f.count / funnelMax) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{t("topDebtors")}</CardTitle>
            <Link href="/receivables" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              {t("viewAll")} <ArrowRight className="size-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {d.topDebtors.map((deb, i) => (
              <Link
                key={deb.contractorId}
                href={`/companies/${deb.contractorId}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-2.5 transition-colors hover:border-primary/40 hover:bg-primary-soft/30"
              >
                <span className="tabular grid size-7 shrink-0 place-items-center rounded-md bg-card text-xs font-semibold text-muted-foreground">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{deb.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {deb.tin}
                    {deb.overdueDays > 0 && <span className="text-danger"> · {deb.overdueDays} {t("days")}</span>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="tabular text-sm font-semibold">{deb.outstanding.formatted}</p>
                  <Badge tone={riskTone(deb.riskScore)}>
                    <ShieldWarning weight="fill" className="size-3" />
                    {deb.riskScore}
                  </Badge>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent receivables + Activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{t("recentReceivables")}</CardTitle>
            <Link href="/receivables" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              {t("viewAll")} <ArrowRight className="size-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-2.5 font-medium">{t("contractor")}</th>
                    <th className="px-5 py-2.5 font-medium">{t("invoice")}</th>
                    <th className="px-5 py-2.5 text-right font-medium">{t("amount")}</th>
                    <th className="px-5 py-2.5 text-center font-medium">{t("overdueDays")}</th>
                    <th className="px-5 py-2.5 font-medium">{t("byStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recentReceivables.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                        {t("empty")}
                      </td>
                    </tr>
                  )}
                  {d.recentReceivables.map((r) => (
                    <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                      <td className="px-5 py-3 font-medium">{r.contractorName}</td>
                      <td className="px-5 py-3 text-muted-foreground">{r.invoiceNumber}</td>
                      <td className="tabular px-5 py-3 text-right font-semibold">{r.outstanding.formatted}</td>
                      <td className="tabular px-5 py-3 text-center">
                        {r.overdueDays > 0 ? <span className="text-danger">{r.overdueDays}</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={STATUS_TONE[r.status]}>{tStatus(r.status as never)}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{t("agentActivity")}</CardTitle>
            <Link href="/audit" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              {t("viewAll")} <ArrowRight className="size-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            {d.activity.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("noActivity")}</p>
            ) : (
              <ol className="space-y-3">
                {d.activity.map((a) => {
                  const Ic = ACTOR_ICON[a.actorType] ?? Robot;
                  return (
                    <li key={a.id} className="flex gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                        <Ic weight="fill" className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">{actionLabel(a.action)}</p>
                        <p className="tabular text-xs text-muted-foreground">
                          {new Date(a.createdAt).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MiniStat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3.5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="text-muted-foreground/70">{icon}</span>
        <span className="truncate text-xs">{label}</span>
      </div>
      <p className={`tabular mt-1.5 font-display text-lg font-semibold ${tone ?? ""}`}>{value}</p>
    </div>
  );
}
