"use client";

import { Bell, Gavel, HandCoins, Percent, TrendUp } from "@phosphor-icons/react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { ResolutionChannels } from "@/app/(app)/admin/actions";

const CHANNEL_META: Record<string, { icon: typeof Bell; color: string; soft: string }> = {
  reminder: { icon: Bell, color: "var(--color-primary)", soft: "var(--color-primary-soft)" },
  court: { icon: Gavel, color: "var(--color-warning)", soft: "var(--color-warning-soft)" },
  tax: { icon: Percent, color: "var(--color-brand)", soft: "var(--color-brand-soft)" },
  factoring: { icon: HandCoins, color: "var(--color-success)", soft: "var(--color-success-soft)" },
};

export function ResolutionChannelsCard({ data }: { data: ResolutionChannels }) {
  const hasData = data.total.count > 0;
  const chartData = data.channels.map((ch) => ({
    name: ch.label,
    value: ch.count,
    pct: ch.pct,
    color: CHANNEL_META[ch.key]?.color ?? "var(--color-secondary)",
  }));

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-xl bg-primary-soft text-primary">
              <TrendUp weight="fill" className="size-5" />
            </div>
            <h2 className="font-display text-lg font-semibold">Qarzdorlik qanday yechildi</h2>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Barcha mijozlar bo&apos;yicha — undirilgan qarzning qaysi kanal orqali yechilganligi
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Jami undirilgan</p>
          <p className="font-display text-2xl font-bold tabular text-primary">{data.total.amount}</p>
          <p className="text-xs text-muted-foreground">{data.total.count} ta qarz</p>
        </div>
      </div>

      {!hasData ? (
        <div className="mt-6 flex h-40 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
          Hozircha to&apos;langan qarzdorlik yo&apos;q — birinchi natijalar shu yerda ko&apos;rinadi.
        </div>
      ) : (
        <div className="mt-6 grid gap-6 md:grid-cols-[220px_1fr]">
          <div className="relative mx-auto h-[220px] w-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={95} paddingAngle={3} strokeWidth={0} animationDuration={700}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--color-card)", fontSize: 13 }}
                  formatter={(value: number, _name, item) => [`${value} ta (${item.payload.pct}%)`, item.payload.name]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="text-center">
                <p className="font-display text-2xl font-bold tabular">{data.total.count}</p>
                <p className="text-[11px] text-muted-foreground">yechilgan qarz</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {data.channels.map((ch) => {
              const meta = CHANNEL_META[ch.key];
              const Icon = meta?.icon ?? Bell;
              return (
                <div key={ch.key} className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-lg" style={{ background: meta?.soft, color: meta?.color }}>
                    <Icon weight="fill" className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{ch.label}</p>
                      <p className="shrink-0 font-display text-sm font-bold tabular" style={{ color: meta?.color }}>
                        {ch.pct}%
                      </p>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full transition-all" style={{ width: `${ch.pct}%`, background: meta?.color }} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {ch.count} ta qarz &middot; {ch.amount}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
