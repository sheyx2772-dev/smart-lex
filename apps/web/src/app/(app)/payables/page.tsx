import { fetchPayables } from "./actions";
import { PayablesClient } from "@/components/payables/payables-client";

export default async function PayablesPage() {
  const data = await fetchPayables();
  return <PayablesClient data={data} />;
}
