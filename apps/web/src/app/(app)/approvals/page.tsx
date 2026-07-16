import { ApprovalsClient, type Approval } from "@/components/approvals/approvals-client";
import { apiServer } from "@/lib/api";

export default async function ApprovalsPage() {
  const [pending, approved, rejected] = await Promise.all([
    apiServer<Approval[]>("/api/approvals?status=pending"),
    apiServer<Approval[]>("/api/approvals?status=approved"),
    apiServer<Approval[]>("/api/approvals?status=rejected"),
  ]);

  return (
    <ApprovalsClient
      pending={pending.data ?? []}
      approved={approved.data ?? []}
      rejected={rejected.data ?? []}
    />
  );
}
