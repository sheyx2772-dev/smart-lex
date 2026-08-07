import { AuditClient, type AuditAnchor, type AuditChainStatus, type AuditData } from "@/components/audit/audit-client";
import { apiServer } from "@/lib/api";

export default async function AuditPage() {
  const [res, chainRes, anchorsRes] = await Promise.all([
    apiServer<AuditData>("/api/audit?page=1"),
    apiServer<AuditChainStatus>("/api/audit/verify"),
    apiServer<{ items: AuditAnchor[] }>("/api/audit/anchors"),
  ]);
  return (
    <AuditClient
      initial={res.data ?? { items: [], total: 0, page: 1, pageSize: 25, pageCount: 1, byActor: {}, allTotal: 0 }}
      initialChain={chainRes.data ?? null}
      initialAnchors={anchorsRes.data?.items ?? []}
    />
  );
}
