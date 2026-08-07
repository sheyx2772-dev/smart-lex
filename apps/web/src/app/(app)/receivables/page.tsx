import type { CommandCenterData } from "@/components/command-center/command-center";
import { ReceivablesClient, type ReceivablesData } from "@/components/receivables/receivables-client";
import { apiServer } from "@/lib/api";

export default async function ReceivablesPage() {
  const [res, cc] = await Promise.all([
    apiServer<ReceivablesData>("/api/receivables?page=1&sort=overdue"),
    apiServer<CommandCenterData>("/api/command-center"),
  ]);
  return (
    <ReceivablesClient
      initial={res.data ?? { items: [], total: 0, page: 1, pageSize: 25, pageCount: 1, byStatus: {}, allTotal: 0 }}
      portfolio={cc.data ? { ...cc.data.portfolio, topPriority: cc.data.topPriority } : null}
    />
  );
}
