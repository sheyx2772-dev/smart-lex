import { ReceivablesClient, type ReceivablesData } from "@/components/receivables/receivables-client";
import { apiServer } from "@/lib/api";

export default async function ReceivablesPage() {
  const res = await apiServer<ReceivablesData>("/api/receivables?page=1&sort=overdue");
  return (
    <ReceivablesClient
      initial={res.data ?? { items: [], total: 0, page: 1, pageSize: 25, pageCount: 1, byStatus: {}, allTotal: 0 }}
    />
  );
}
