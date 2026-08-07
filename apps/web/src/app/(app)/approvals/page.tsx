import { ApprovalsClient, type Approval } from "@/components/approvals/approvals-client";
import type { CommandCenterData } from "@/components/command-center/command-center";
import { apiServer } from "@/lib/api";

export default async function ApprovalsPage() {
  const [pending, approved, rejected, cc] = await Promise.all([
    apiServer<Approval[]>("/api/approvals?status=pending"),
    apiServer<Approval[]>("/api/approvals?status=approved"),
    apiServer<Approval[]>("/api/approvals?status=rejected"),
    apiServer<CommandCenterData>("/api/command-center"),
  ]);

  return (
    <ApprovalsClient
      pending={pending.data ?? []}
      approved={approved.data ?? []}
      rejected={rejected.data ?? []}
      overrides={cc.data?.pendingOverrides ?? []}
    />
  );
}
