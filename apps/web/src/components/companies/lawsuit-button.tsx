"use client";

import { CircleNotch, Gavel } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { generateLawsuit } from "@/app/(app)/companies/[id]/actions";

export function LawsuitButton({ contractorId }: { contractorId: string }) {
  const t = useTranslations("companies");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    const res = await generateLawsuit(contractorId);
    setBusy(false);
    if (res.success) router.push("/approvals");
    else setErr(res.message || "—");
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={run}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/15 disabled:opacity-60"
      >
        {busy ? <CircleNotch className="size-4 animate-spin" /> : <Gavel weight="fill" className="size-4" />}
        {busy ? t("preparingLawsuit") : t("generateLawsuit")}
      </button>
      {err && <span className="text-xs text-danger">{err}</span>}
    </div>
  );
}
