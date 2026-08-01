import { DebtorPortal, type DebtData } from "@/components/pay/debtor-portal";
import { API_URL } from "@/lib/api";

// Qarzdor portali — PUBLIC (login yo'q). SMS/eslatmadagi havoladan ochiladi.
export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let data: DebtData | null = null;
  try {
    const res = await fetch(`${API_URL}/pay/${id}`, { cache: "no-store" });
    const json = (await res.json()) as { success?: boolean; data?: DebtData };
    if (json?.success && json.data) data = json.data;
  } catch {
    data = null;
  }
  return <DebtorPortal id={id} data={data} />;
}
