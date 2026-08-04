import { MerchantConnect } from "@/components/settings/merchant-connect";
import { SettingsClient, type SettingsData, type TeamUser } from "@/components/settings/settings-client";
import { apiServer } from "@/lib/api";
import { type MerchantData } from "./merchant-actions";

export default async function SettingsPage() {
  const [res, usersRes, merchantRes] = await Promise.all([
    apiServer<SettingsData>("/api/settings"),
    apiServer<TeamUser[]>("/api/settings/users"),
    apiServer<MerchantData>("/api/merchant"),
  ]);
  if (!res.success || !res.data) {
    return <div className="text-sm text-muted-foreground">—</div>;
  }
  const role = res.data.profile?.role ?? "viewer";
  return (
    <div className="space-y-6">
      <SettingsClient data={res.data} users={usersRes.data ?? []} currentRole={role} currentUserId={res.data.profile?.id ?? ""} />
      {(role === "owner" || role === "admin") && <MerchantConnect initial={merchantRes.data ?? null} webUrl="https://api.lexai.com.uz" />}
    </div>
  );
}
