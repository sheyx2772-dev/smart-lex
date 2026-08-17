"use client";

import { Briefcase, ClockCounterClockwise, Plus, ShieldWarning, UserFocus } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { fetchLegalMatters, type MatterListData } from "@/app/(app)/legal/matters/actions";
import { MATTER_RISK_TONE, MATTER_STATUS_LABEL, MATTER_TYPE_LABEL } from "@/components/legal/matter-labels";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

const FILTERS: { key: string; label: string; icon: typeof Briefcase }[] = [
  { key: "", label: "Barchasi", icon: Briefcase },
  { key: "mine", label: "Mening ishlarim", icon: UserFocus },
  { key: "due", label: "Muddati yaqin", icon: ClockCounterClockwise },
  { key: "risk", label: "Xavf ostidagi", icon: ShieldWarning },
];

export function LegalMattersClient({ initial, initialFilter }: { initial: MatterListData; initialFilter: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filter = searchParams.get("filter") ?? initialFilter;
  const [data, setData] = useState<MatterListData>(initial);
  const [loading, setLoading] = useState(false);
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchLegalMatters({ filter, page: 1 }).then((d) => {
      if (!cancelled && d) setData(d);
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function load(page: number) {
    setLoading(true);
    const d = await fetchLegalMatters({ filter, page });
    if (d) setData(d);
    setLoading(false);
  }

  const fmt = (x: string | null) => (x ? new Date(x).toLocaleDateString() : "—");

  return (
    <div className="flex h-full w-full flex-col">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Ishlar</h1>
          <p className="mt-1 text-sm text-muted-foreground">Yuridik ishlar ro'yxati — har biri huquqiy ish uchun yagona ish maydoni.</p>
        </div>
        <Link
          href="/legal/matters/new"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus weight="bold" className="size-4" />
          Yangi ish
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => router.push(f.key ? `/legal/matters?filter=${f.key}` : "/legal/matters")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              filter === f.key
                ? "border-primary bg-primary-soft text-primary"
                : "border-border bg-card text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground",
            )}
          >
            <f.icon weight={filter === f.key ? "fill" : "regular"} className="size-4" />
            {f.label}
          </button>
        ))}
      </div>

      <div className="scroll-clean min-h-0 flex-1 overflow-y-auto pr-1">
        {data.items.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
            Hech qanday ish topilmadi.
          </div>
        ) : (
          <div className={cn("overflow-x-auto rounded-xl border border-border bg-card transition-opacity", loading && "opacity-50")}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">Ish</th>
                  <th className="px-5 py-2.5 font-medium">Kontragent</th>
                  <th className="px-5 py-2.5 font-medium">Turi</th>
                  <th className="px-5 py-2.5 font-medium">Holat</th>
                  <th className="px-5 py-2.5 font-medium">Muddat</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((m) => (
                  <tr key={m.id} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                    <td className="p-0">
                      <Link href={`/legal/matters/${m.id}`} className="block px-5 py-3">
                        <p className="font-medium">{m.title}</p>
                        <p className="text-xs text-muted-foreground">{m.matterNumber}</p>
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{m.contractorName ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{MATTER_TYPE_LABEL[m.type] ?? m.type}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <Badge tone="primary">{MATTER_STATUS_LABEL[m.status] ?? m.status}</Badge>
                        {m.riskLevel && <Badge tone={MATTER_RISK_TONE[m.riskLevel] ?? "primary"}>{m.riskLevel}</Badge>}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{fmt(m.dueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-3">
        <Pagination page={data.page} pageCount={data.pageCount} pageSize={data.pageSize} total={data.total} onPage={load} disabled={loading} />
      </div>
    </div>
  );
}
