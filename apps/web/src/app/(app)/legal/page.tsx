import { Briefcase, ChartBar, Clock, FileText, Gavel, Robot, ShieldWarning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { StatTile } from "@/components/dashboard/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiServer } from "@/lib/api";

interface Matter {
  id: string;
  matterNumber: string;
  title: string;
  status: string;
  priority: string;
  riskLevel: string | null;
  dueDate: string | null;
  contractorName: string | null;
  updatedAt: string;
}
interface LegalDashboard {
  kpis: {
    activeMatters: number;
    highRisk: number;
    deadlinesThisWeek: number;
    courtCases: number;
    contractsToReview: number;
    aiTasks: number;
  };
  recentMatters: Matter[];
  activity: { id: string; actorType: string; action: string; detail: Record<string, unknown> | null; createdAt: string }[];
}

const RISK_TONE: Record<string, "danger" | "warning" | "success" | "primary"> = {
  critical: "danger",
  high: "danger",
  medium: "warning",
  low: "success",
};
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

export default async function LegalDashboardPage() {
  const res = await apiServer<LegalDashboard>("/api/legal/dashboard");
  const d = res.data;
  if (!d) return <div className="text-sm text-muted-foreground">Ma'lumot yo'q</div>;
  const k = d.kpis;
  const fmt = (x: string | null) => (x ? new Date(x).toLocaleDateString() : "—");

  return (
    <div className="w-full space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary-soft/60 via-card to-primary-soft/20 p-6">
        <p className="text-sm text-muted-foreground">Yuridik jarayonlar</p>
        <h1 className="mt-0.5 font-display text-2xl font-semibold tracking-tight">Boshqaruv markazi</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">Faol ishlar, muddatlar va AI vazifalarining umumiy holati — bitta ekranda.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile label="Faol ishlar" value={String(k.activeMatters)} tone="primary" icon={<Briefcase weight="fill" className="size-4" />} />
        <StatTile label="Yuqori xavf" value={String(k.highRisk)} tone="danger" icon={<ShieldWarning weight="fill" className="size-4" />} />
        <StatTile label="Bu hafta muddatlar" value={String(k.deadlinesThisWeek)} tone="warning" icon={<Clock weight="fill" className="size-4" />} />
        <StatTile label="Sud ishlari" value={String(k.courtCases)} tone="primary" icon={<Gavel weight="fill" className="size-4" />} />
        <StatTile label="Ko'rib chiqilishi kerak" value={String(k.contractsToReview)} tone="secondary" icon={<FileText weight="fill" className="size-4" />} />
        <StatTile label="AI vazifalari" value={String(k.aiTasks)} tone="primary" plain icon={<Robot weight="fill" className="size-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>So'nggi ishlar</CardTitle>
            <Link href="/legal/agent" className="text-xs font-medium text-primary hover:underline">AI agentga murojaat →</Link>
          </CardHeader>
          <CardContent className="p-0">
            {d.recentMatters.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">Hali yuridik ish yaratilmagan.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-y border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-5 py-2.5 font-medium">Ish</th>
                      <th className="px-5 py-2.5 font-medium">Kontragent</th>
                      <th className="px-5 py-2.5 font-medium">Holat</th>
                      <th className="px-5 py-2.5 font-medium">Muddat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.recentMatters.map((m) => (
                      <tr key={m.id} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                        <td className="px-5 py-3">
                          <p className="font-medium">{m.title}</p>
                          <p className="text-xs text-muted-foreground">{m.matterNumber}</p>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">{m.contractorName ?? "—"}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5">
                            <Badge tone="primary">{STATUS_LABEL[m.status] ?? m.status}</Badge>
                            {m.riskLevel && <Badge tone={RISK_TONE[m.riskLevel] ?? "primary"}>{m.riskLevel}</Badge>}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">{fmt(m.dueDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>So'nggi faoliyat</CardTitle>
            <Link href="/audit" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              <ChartBar className="size-3.5" /> Audit
            </Link>
          </CardHeader>
          <CardContent>
            {d.activity.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Hali faoliyat yo'q</p>
            ) : (
              <ol className="space-y-3">
                {d.activity.map((a) => (
                  <li key={a.id} className="flex gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                      <Robot weight="fill" className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">{a.action}</p>
                      <p className="tabular text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
