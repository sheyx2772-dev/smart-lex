import { EnforcementClient } from "@/components/enforcement/enforcement-client";
import type { CourtData } from "@/components/court/court-client";
import { apiServer } from "@/lib/api";

interface SettingsData {
  profile: { fullName: string; role: string } | null;
  company: { name: string; tin: string; bankAccount: string; bankMfo: string } | null;
}

/**
 * Ijro bosqichi — sud qarori kuchga kirgach, ijro varaqasini Majburiy ijro
 * byurosiga gibrid pochta (hybrid.pochta.uz) orqali yuborish. Nomzodlar —
 * sud bosqichida "completed" (qaror chiqqan) ishlar.
 */
export default async function EnforcementPage() {
  const [res, settings] = await Promise.all([
    apiServer<CourtData>("/api/court"),
    apiServer<SettingsData>("/api/settings"),
  ]);
  const cases = (res.data?.items ?? []).filter((c) => c.status === "completed");
  return <EnforcementClient cases={cases} company={settings.data?.company ?? null} profile={settings.data?.profile ?? null} />;
}
