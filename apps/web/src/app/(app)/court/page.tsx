import { CourtClient, type CourtData } from "@/components/court/court-client";
import { apiServer } from "@/lib/api";

export default async function CourtPage() {
  const res = await apiServer<CourtData>("/api/court");
  return <CourtClient initial={res.data ?? { items: [], total: 0 }} />;
}
