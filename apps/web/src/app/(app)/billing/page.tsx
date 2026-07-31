import { BillingClient, type Sub } from "@/components/billing/billing-client";
import { apiServer } from "@/lib/api";

interface Me {
  subscription?: Sub;
  tenant?: { name: string; tin: string } | null;
}

export default async function BillingPage() {
  const res = await apiServer<Me>("/api/me");
  return (
    <BillingClient
      subscription={res.data?.subscription ?? { plan: null, status: "none", until: null, trialUntil: null }}
      tenant={res.data?.tenant ?? null}
    />
  );
}
