import { SettingsClient, type SettingsData, type TeamUser } from "@/components/settings/settings-client";
import { apiServer } from "@/lib/api";

export default async function SettingsPage() {
  const [res, usersRes] = await Promise.all([
    apiServer<SettingsData>("/api/settings"),
    apiServer<TeamUser[]>("/api/settings/users"),
  ]);
  if (!res.success || !res.data) {
    return <div className="text-sm text-muted-foreground">—</div>;
  }
  return <SettingsClient data={res.data} users={usersRes.data ?? []} currentRole={res.data.profile?.role ?? "viewer"} />;
}
