"use client";

import { ShieldCheck } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export interface OverrideItem {
  id: string;
  type: string;
  debtCaseId: string;
  debtorMessage: string | null;
  autoExecuteAt: string | null;
}

const fmtTime = (d: string | null) =>
  d ? new Intl.DateTimeFormat("uz-UZ", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(d)) : "";

export function PendingOverrides({ initial }: { initial: OverrideItem[] }) {
  const [items, setItems] = useState(initial);
  const [pending, start] = useTransition();
  const router = useRouter();

  function decide(id: string, decision: "approved" | "rejected") {
    start(async () => {
      await fetch(`/api/command-center/overrides/${id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      setItems((prev) => prev.filter((o) => o.id !== id));
      router.refresh();
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="mb-5 space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-amber-600">
        <ShieldCheck className="size-4" /> AI tasdiq so&apos;rovlari (avto-ijro)
      </h2>
      <div className="space-y-3">
        {items.map((o) => (
          <div key={o.id} className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <p className="text-sm font-medium">Kelishuv / override · {o.type}</p>
            {o.debtorMessage && <p className="mt-1 text-sm italic text-muted-foreground">&ldquo;{o.debtorMessage}&rdquo;</p>}
            {o.autoExecuteAt && <p className="mt-1 text-xs text-muted-foreground">Avto-ijro: {fmtTime(o.autoExecuteAt)}</p>}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => decide(o.id, "approved")}
                disabled={pending}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                Tasdiqlash
              </button>
              <button
                type="button"
                onClick={() => decide(o.id, "rejected")}
                disabled={pending}
                className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-60"
              >
                Rad etish
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
