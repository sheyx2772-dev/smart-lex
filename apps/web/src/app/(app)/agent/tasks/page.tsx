import { AgentTasksClient, type AgentTask, type TaskDebtor } from "@/components/agent/agent-tasks-client";
import type { ReceivablesData } from "@/components/receivables/receivables-client";
import { apiServer } from "@/lib/api";

/**
 * Platformaga topshiriqlar — foydalanuvchi AI agentga ish biriktiradi
 * (tahlil, risk baholash, talabnoma), platforma bajaradi va natijani yozadi.
 */
export default async function AgentTasksPage() {
  const [tasksRes, recRes] = await Promise.all([
    apiServer<{ items: AgentTask[] }>("/api/agent/tasks"),
    apiServer<ReceivablesData>("/api/receivables?page=1&sort=overdue"),
  ]);
  const debtors: TaskDebtor[] = (recRes.data?.items ?? []).slice(0, 50).map((r) => ({
    id: r.id,
    name: r.contractorName,
    invoice: r.invoiceNumber,
  }));
  return <AgentTasksClient tasks={tasksRes.data?.items ?? []} debtors={debtors} />;
}
