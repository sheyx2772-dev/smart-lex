import { RemindersClient, type RemindersData } from "@/components/reminders/reminders-client";
import { apiServer } from "@/lib/api";

export default async function RemindersPage() {
  const res = await apiServer<RemindersData>("/api/reminders?page=1");
  return (
    <RemindersClient
      initial={
        res.data ?? { items: [], total: 0, page: 1, pageSize: 25, pageCount: 1, byChannel: {}, byStatus: {}, allTotal: 0 }
      }
    />
  );
}
