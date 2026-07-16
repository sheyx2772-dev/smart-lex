"use client";

import { CircleNotch, ClipboardText } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { generateReconciliation } from "@/app/(app)/companies/[id]/actions";

export function ReconciliationButton({ contractorId }: { contractorId: string }) {
  const t = useTranslations("companies");
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    if (busy) return;
    setBusy(true);
    const res = await generateReconciliation(contractorId);
    setBusy(false);
    if (res.success) router.refresh();
  }

  return (
    <button
      onClick={run}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-60"
    >
      {busy ? <CircleNotch className="size-4 animate-spin" /> : <ClipboardText weight="fill" className="size-4" />}
      {busy ? t("generating") : t("generateRecon")}
    </button>
  );
}
