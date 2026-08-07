import { fetchChannelStatus } from "@/app/(app)/reminders/actions";
import type { ReceivablesData } from "@/components/receivables/receivables-client";
import { RemindersClient, type RemindersData, type ReminderDebtor } from "@/components/reminders/reminders-client";
import { apiServer } from "@/lib/api";

export default async function RemindersPage() {
  const [res, recs, channelStatus] = await Promise.all([
    apiServer<RemindersData>("/api/reminders?page=1"),
    apiServer<ReceivablesData>("/api/receivables?page=1&sort=overdue"),
    fetchChannelStatus(),
  ]);
  const debtors: ReminderDebtor[] = (recs.data?.items ?? []).slice(0, 100).map((r) => ({
    id: r.id,
    name: r.contractorName,
    invoice: r.invoiceNumber,
    overdueDays: r.overdueDays,
    phone: r.contractorPhone,
    email: r.contractorEmail,
  }));
  return (
    <RemindersClient
      initial={
        res.data ?? { items: [], total: 0, page: 1, pageSize: 25, pageCount: 1, byChannel: {}, byStatus: {}, allTotal: 0 }
      }
      debtors={debtors}
      channelStatus={channelStatus}
    />
  );
}
