import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell/app-shell";
import { apiServer } from "@/lib/api";

interface Me {
  user: { fullName: string; role: string; email: string } | null;
  tenant: { name: string; type: string } | null;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [meRes, approvalsRes] = await Promise.all([
    apiServer<Me>("/api/me"),
    apiServer<unknown[]>("/api/approvals?status=pending"),
  ]);
  if (!meRes.success || !meRes.data?.user || !meRes.data.tenant) {
    redirect("/login");
  }
  const pendingApprovals = approvalsRes.success ? (approvalsRes.data?.length ?? 0) : 0;

  return (
    <AppShell user={meRes.data.user} tenant={meRes.data.tenant} pendingApprovals={pendingApprovals}>
      {children}
    </AppShell>
  );
}
