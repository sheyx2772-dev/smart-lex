import { EnforcementClient } from "@/components/enforcement/enforcement-client";
import type { CourtData } from "@/components/court/court-client";
import { apiServer } from "@/lib/api";

/**
 * Ijro bosqichi — sud qarori kuchga kirgach, ijro varaqasini Majburiy ijro
 * byurosiga gibrid pochta (hybrid.pochta.uz) orqali yuborish. Nomzodlar —
 * sud bosqichida "completed" (qaror chiqqan) ishlar.
 */
export default async function EnforcementPage() {
  const res = await apiServer<CourtData>("/api/court");
  const cases = (res.data?.items ?? []).filter((c) => c.status === "completed");
  return <EnforcementClient cases={cases} />;
}
