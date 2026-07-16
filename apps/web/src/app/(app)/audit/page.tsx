import { AuditClient, type AuditData } from "@/components/audit/audit-client";
import { apiServer } from "@/lib/api";

export default async function AuditPage() {
  const res = await apiServer<AuditData>("/api/audit?page=1");
  return (
    <AuditClient
      initial={res.data ?? { items: [], total: 0, page: 1, pageSize: 25, pageCount: 1, byActor: {}, allTotal: 0 }}
    />
  );
}
