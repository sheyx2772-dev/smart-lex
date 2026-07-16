"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const BUCKETS = ["current", "1_30", "31_60", "61_90", "90_plus"] as const;
const COLORS: Record<string, string> = {
  current: "bg-success",
  "1_30": "bg-primary",
  "31_60": "bg-warning",
  "61_90": "bg-[#f97316]",
  "90_plus": "bg-danger",
};

interface Amount {
  minor: string;
  formatted: string;
}

export function AgingBar({ aging }: { aging: Record<string, Amount> }) {
  const t = useTranslations("aging");
  const values = BUCKETS.map((b) => ({ key: b, minor: BigInt(aging[b]?.minor ?? "0"), formatted: aging[b]?.formatted ?? "" }));
  const total = values.reduce((s, v) => s + v.minor, 0n);

  return (
    <div className="space-y-4">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {total > 0n &&
          values.map((v) =>
            v.minor > 0n ? (
              <div
                key={v.key}
                className={cn(COLORS[v.key])}
                style={{ width: `${(Number(v.minor) / Number(total)) * 100}%` }}
                title={`${t(v.key as never)}: ${v.formatted}`}
              />
            ) : null,
          )}
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
        {values.map((v) => (
          <div key={v.key} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={cn("size-2.5 rounded-sm", COLORS[v.key])} />
              {t(v.key as never)}
            </span>
            <span className="tabular text-xs font-medium">{v.formatted || "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
