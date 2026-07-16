import { OverdueClient, type OverdueData } from "@/components/overdue/overdue-client";
import { apiServer } from "@/lib/api";

export default async function OverduePage() {
  const res = await apiServer<OverdueData>("/api/overdue?page=1");
  return (
    <OverdueClient
      initial={res.data ?? { items: [], summary: null, total: 0, page: 1, pageSize: 25, pageCount: 1 }}
    />
  );
}
