import { Briefcase, ChartBar, Clock, FileText, Gavel, Robot, ShieldWarning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { fetchLegalTasks } from "@/app/(app)/legal/actions";
import { LegalAgentChat } from "@/components/agent/legal-agent-chat";
import { StatTile } from "@/components/dashboard/stat-tile";
import { LegalTasksPanel } from "@/components/legal/legal-tasks-panel";
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

/** Yuridik ish rejimining yagona bosh sahifasi — Debitorlik tarafidagi /agent bilan bir xil
 * falsafa: sof "ma'lumotlar bazasi" (raqamlar) emas, balki real ishlaydigan AI agent +
 * kontekst uchun real ko'rsatkichlar BIR sahifada. Alohida "Boshqaruv paneli" yo'q. */
export default async function LegalHomePage() {
  const [res, tasks] = await Promise.all([apiServer<LegalDashboard>("/api/legal/dashboard"), fetchLegalTasks()]);
  const d = res.data;
  const k = d?.kpis ?? { activeMatters: 0, highRisk: 0, deadlinesThisWeek: 0, courtCases: 0, contractsToReview: 0, aiTasks: 0 };
  const fmt = (x: string | null) => (x ? new Date(x).toLocaleDateString() : "—");

  return (
    <div className="w-full space-y-5">
      {/* Hero — Debitorlikdagi "AI Undiruv Agenti" bilan bir xil naqsh */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/12 via-card to-card p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Robot weight="fill" className="size-6" />
          </span>
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight">Yuridik AI Agent</h1>
            <p className="text-sm text-muted-foreground">Ishlar va shartnomalarni o'qiydi, xavfni tahlil qiladi, hujjat tayyorlaydi — siz tasdiqlaysiz.</p>
          </div>
        </div>
      </div>

      {/* Real kontekst — nechta ish, qanchasi xavfli, muddat qachon */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Faol ishlar" value={String(k.activeMatters)} tone="primary" icon={<Briefcase weight="fill" className="size-4" />} />
        <StatTile label="Yuqori xavf" value={String(k.highRisk)} tone="danger" icon={<ShieldWarning weight="fill" className="size-4" />} />
        <StatTile label="Bu hafta muddat" value={String(k.deadlinesThisWeek)} tone="warning" icon={<Clock weight="fill" className="size-4" />} />
        <StatTile label="Sud ishlari" value={String(k.courtCases)} tone="primary" icon={<Gavel weight="fill" className="size-4" />} />
        <StatTile label="Ko'rib chiqilishi kerak" value={String(k.contractsToReview)} tone="secondary" icon={<FileText weight="fill" className="size-4" />} />
        <StatTile label="AI vazifalari" value={String(k.aiTasks)} tone="primary" plain icon={<Robot weight="fill" className="size-4" />} />
      </div>

      {/* Bugungi diqqat — real, harakat qilinadigan AI vazifalar navbati */}
      <LegalTasksPanel initial={tasks} />

      {/* Real harakat — asosiy sirt: agent bilan ishlash */}
      <div className="rounded-3xl border border-border bg-card p-5">
        <LegalAgentChat />
      </div>

      {/* Qo'llab-quvvatlovchi kontekst — so'nggi ishlar va agent faoliyati */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>So'nggi ishlar</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!d || d.recentMatters.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">Hali yuridik ish yaratilmagan — agentdan so'rang.</p>
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
            <CardTitle>Agent nima qildi</CardTitle>
            <Link href="/audit" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              <ChartBar className="size-3.5" /> Audit
            </Link>
          </CardHeader>
          <CardContent>
            {!d || d.activity.length === 0 ? (
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
