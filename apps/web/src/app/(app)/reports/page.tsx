import { Bank, ChartLineUp, CurrencyCircleDollar, ShieldWarning, TrendUp, Warning } from "@phosphor-icons/react/dist/ssr";
import { getTranslations } from "next-intl/server";
import { StatTile } from "@/components/dashboard/stat-tile";
import { LegalReports } from "@/components/reports/legal-reports";
import { ReportActions, type ReportData } from "@/components/reports/report-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiServer } from "@/lib/api";

const STAGE_ICON_KEYS = ["soft_reminder", "firm_reminder", "demand_letter", "court"];

function riskTone(score: number): "danger" | "warning" | "success" {
  if (score >= 70) return "danger";
  if (score >= 40) return "warning";
  return "success";
}

export default async function ReportsPage() {
  const meRes = await apiServer<{ workMode?: "debt" | "legal" }>("/api/me");
  if (meRes.data?.workMode === "legal") return <LegalReports />;

  const t = await getTranslations("reports");
  const tAging = await getTranslations("aging");
  const tStage = await getTranslations("stage");

  const res = await apiServer<ReportData>("/api/reports");
  const d = res.data;
  if (!d) return <div className="text-sm text-muted-foreground">{t("empty")}</div>;

  const f = d.financial;
  const monthMax = Math.max(1, ...d.months.flatMap((m) => [Number(m.invoiced.minor), Number(m.collected.minor)]));
  const shortMonth = (m: string) => m.slice(5); // "YYYY-MM" → "MM"
  const riskTiles = [
    { key: "riskLow", n: d.risk.low, color: "var(--color-success)" },
    { key: "riskMedium", n: d.risk.medium, color: "var(--color-warning)" },
    { key: "riskHigh", n: d.risk.high, color: "var(--color-danger)" },
    { key: "riskCritical", n: d.risk.critical, color: "var(--color-secondary)" },
  ] as const;
  const funnelMax = Math.max(1, ...d.funnel.map((x) => x.count));

  return (
    <div className="w-full space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <ReportActions data={d} />
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={t("invoiced")} value={f.invoiced.formatted} tone="primary" icon={<Bank weight="fill" className="size-4" />} />
        <StatTile label={t("collected")} value={f.collected.formatted} tone="secondary" icon={<TrendUp weight="fill" className="size-4" />} />
        <StatTile label={t("outstanding")} value={f.outstanding.formatted} tone="warning" icon={<CurrencyCircleDollar weight="fill" className="size-4" />} />
        <StatTile label={t("collectionRate")} value={`${f.collectionRate}%`} tone="primary" plain icon={<ChartLineUp weight="fill" className="size-4" />} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label={t("penalty")} value={f.penalty.formatted} icon={<Warning weight="fill" className="size-4" />} />
        <MiniStat label={t("writtenOff")} value={f.writtenOff.formatted} icon={<ShieldWarning weight="fill" className="size-4" />} />
      </div>

      {/* 6 oylik dinamika + Risk */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{t("monthlyTitle")}</CardTitle>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary" /> {t("monthlyInvoiced")}</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-secondary" /> {t("monthlyCollected")}</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex h-48 items-end justify-between gap-3">
              {d.months.map((m) => (
                <div key={m.month} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex h-40 w-full items-end justify-center gap-1">
                    <div className="w-1/2 rounded-t bg-primary transition-all" style={{ height: `${(Number(m.invoiced.minor) / monthMax) * 100}%` }} title={m.invoiced.formatted} />
                    <div className="w-1/2 rounded-t bg-secondary transition-all" style={{ height: `${(Number(m.collected.minor) / monthMax) * 100}%` }} title={m.collected.formatted} />
                  </div>
                  <span className="tabular text-[11px] text-muted-foreground">{shortMonth(m.month)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("riskTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {riskTiles.map((r) => (
                <div key={r.key} className="rounded-lg border border-border bg-muted/20 p-3">
                  <span className="inline-block size-2.5 rounded-sm" style={{ background: r.color }} />
                  <p className="tabular mt-1.5 font-display text-2xl font-semibold">{r.n}</p>
                  <p className="text-xs text-muted-foreground">{t(r.key as never)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Aging + Funnel */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("agingTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {d.aging.map((a) => (
              <div key={a.bucket}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">{tAging(a.bucket as never)}</span>
                  <span className="tabular text-muted-foreground">
                    {a.formatted} · {a.count}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary" style={{ width: `${a.pct}%` }} />
                  </div>
                  <span className="tabular w-9 text-right text-xs text-muted-foreground">{a.pct}%</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("funnelTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {STAGE_ICON_KEYS.map((stage) => {
              const item = d.funnel.find((x) => x.stage === stage) ?? { stage, count: 0 };
              return (
                <div key={stage}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{tStage(stage as never)}</span>
                    <span className="tabular text-muted-foreground">{item.count}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary" style={{ width: `${(item.count / funnelMax) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Top qarzdorlar */}
      <Card>
        <CardHeader>
          <CardTitle>{t("topDebtorsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">{t("colContractor")}</th>
                  <th className="hidden px-5 py-2.5 font-medium sm:table-cell">STIR</th>
                  <th className="px-5 py-2.5 text-right font-medium">{t("outstanding")}</th>
                  <th className="px-5 py-2.5 text-center font-medium">{t("colOverdue")}</th>
                  <th className="px-5 py-2.5 text-center font-medium">{t("colRisk")}</th>
                </tr>
              </thead>
              <tbody>
                {d.topDebtors.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">{t("empty")}</td>
                  </tr>
                )}
                {d.topDebtors.map((deb) => (
                  <tr key={deb.contractorId} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                    <td className="px-5 py-3 font-medium">{deb.name}</td>
                    <td className="hidden px-5 py-3 tabular-nums text-muted-foreground sm:table-cell">{deb.tin}</td>
                    <td className="tabular px-5 py-3 text-right font-semibold">{deb.outstanding.formatted}</td>
                    <td className="tabular px-5 py-3 text-center">
                      {deb.overdueDays > 0 ? <span className="text-danger">{deb.overdueDays} {t("days")}</span> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <Badge tone={riskTone(deb.riskScore)}>
                        <ShieldWarning weight="fill" className="size-3" /> {deb.riskScore}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3.5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="text-muted-foreground/70">{icon}</span>
        <span className="truncate text-xs">{label}</span>
      </div>
      <p className="tabular mt-1.5 font-display text-base font-semibold">{value}</p>
    </div>
  );
}
