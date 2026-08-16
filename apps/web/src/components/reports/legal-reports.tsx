import { Briefcase, CalendarCheck, ChartLineUp, ShieldWarning } from "@phosphor-icons/react/dist/ssr";
import { StatTile } from "@/components/dashboard/stat-tile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiServer } from "@/lib/api";

interface LegalReportData {
  total: number;
  closedCount: number;
  avgResolutionDays: number | null;
  statusCounts: Record<string, number>;
  priorityCounts: Record<string, number>;
  riskCounts: Record<string, number>;
  contractRisk: Record<string, number>;
  analyzedContractsCount: number;
  totalContractsCount: number;
  recentClosed: { matterNumber: string; title: string; closedAt: string | null; contractorName: string | null }[];
}

const STATUS_LABEL: Record<string, string> = {
  new: "Yangi",
  in_review: "Ko'rib chiqilmoqda",
  in_progress: "Jarayonda",
  waiting_for_approval: "Tasdiq kutilmoqda",
  filed: "Topshirildi",
  in_court: "Sudda",
  decision: "Qaror",
  execution: "Ijroda",
  closed: "Yakunlangan",
};
const STATUS_ORDER = ["new", "in_review", "in_progress", "waiting_for_approval", "filed", "in_court", "decision", "execution", "closed"];
const RISK_COLOR: Record<string, string> = { low: "var(--color-success)", medium: "var(--color-warning)", high: "var(--color-danger)", critical: "var(--color-secondary)" };
const RISK_LABEL: Record<string, string> = { low: "Past", medium: "O'rta", high: "Yuqori", critical: "Kritik" };

export async function LegalReports() {
  const res = await apiServer<LegalReportData>("/api/legal/reports");
  const d = res.data;
  if (!d) return <div className="text-sm text-muted-foreground">Ma'lumot yo'q</div>;

  const statusMax = Math.max(1, ...Object.values(d.statusCounts));
  const inProgress = d.total - d.closedCount;
  const highRiskContracts = (d.contractRisk.high ?? 0) + (d.contractRisk.critical ?? 0);

  return (
    <div className="w-full space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Hisobotlar</h1>
        <p className="mt-1 text-sm text-muted-foreground">Yuridik ishlar, shartnoma xavfi va bajarilish tahlili</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Jami ishlar" value={String(d.total)} tone="primary" icon={<Briefcase weight="fill" className="size-4" />} />
        <StatTile label="Jarayonda" value={String(inProgress)} tone="secondary" icon={<ChartLineUp weight="fill" className="size-4" />} />
        <StatTile label="O'rtacha yechish muddati" value={d.avgResolutionDays === null ? "—" : `${d.avgResolutionDays} kun`} tone="primary" plain icon={<CalendarCheck weight="fill" className="size-4" />} />
        <StatTile label="Yuqori xavfli shartnomalar" value={String(highRiskContracts)} tone="danger" icon={<ShieldWarning weight="fill" className="size-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Ishlar bosqichlar bo'yicha</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {STATUS_ORDER.map((s) => (
              <div key={s}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">{STATUS_LABEL[s] ?? s}</span>
                  <span className="tabular text-muted-foreground">{d.statusCounts[s] ?? 0}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary" style={{ width: `${((d.statusCounts[s] ?? 0) / statusMax) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ishlar xavf darajasi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {(["low", "medium", "high", "critical"] as const).map((r) => (
                <div key={r} className="rounded-lg border border-border bg-muted/20 p-3">
                  <span className="inline-block size-2.5 rounded-sm" style={{ background: RISK_COLOR[r] }} />
                  <p className="tabular mt-1.5 font-display text-2xl font-semibold">{d.riskCounts[r] ?? 0}</p>
                  <p className="text-xs text-muted-foreground">{RISK_LABEL[r]}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Shartnoma xavf tahlili</CardTitle>
            <p className="text-xs text-muted-foreground">{d.analyzedContractsCount} / {d.totalContractsCount} shartnoma tahlil qilingan</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {(["low", "medium", "high", "critical"] as const).map((r) => (
              <div key={r}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">{RISK_LABEL[r]}</span>
                  <span className="tabular text-muted-foreground">{d.contractRisk[r] ?? 0}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${((d.contractRisk[r] ?? 0) / Math.max(1, d.analyzedContractsCount)) * 100}%`, background: RISK_COLOR[r] }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ustuvorlik bo'yicha</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {(["low", "normal", "high", "urgent"] as const).map((p) => (
                <div key={p} className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="tabular font-display text-2xl font-semibold">{d.priorityCounts[p] ?? 0}</p>
                  <p className="text-xs capitalize text-muted-foreground">{p}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>So'nggi yakunlangan ishlar</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {d.recentClosed.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">Hali yakunlangan ish yo'q</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-2.5 font-medium">Ish</th>
                    <th className="px-5 py-2.5 font-medium">Kontragent</th>
                    <th className="px-5 py-2.5 font-medium">Yakunlangan</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recentClosed.map((m, i) => (
                    <tr key={i} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                      <td className="px-5 py-3">
                        <p className="font-medium">{m.title}</p>
                        <p className="text-xs text-muted-foreground">{m.matterNumber}</p>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{m.contractorName ?? "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">{m.closedAt ? new Date(m.closedAt).toLocaleDateString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
