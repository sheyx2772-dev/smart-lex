import { ReportsClient, type ReportsData } from "@/components/reports/reports-client";
import { apiServer } from "@/lib/api";

export default async function ReportsPage() {
  const res = await apiServer<ReportsData>("/api/reports");
  return <ReportsClient data={res.data ?? null} />;
}
