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
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border bg-gradient-to-br from-primary-soft/60 to-transparent p-7">
        <div>
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <TrendUp weight="bold" className="size-6" />
            </div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">Qarzdorlik qanday yechildi</h2>
          </div>
          <p className="mt-2 max-w-md text-sm font-medium text-muted-foreground">
            Barcha mijozlar bo&apos;yicha — undirilgan qarzning qaysi kanal orqali yechilganligi
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Jami undirilgan</p>
          <p className="font-display text-4xl font-extrabold tabular leading-tight text-primary">{data.total.amount}</p>
          <p className="mt-0.5 text-sm font-semibold text-muted-foreground">{data.total.count} ta qarz</p>
        </div>
      </div>

      {!hasData ? (
        <div className="m-7 flex h-40 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
          Hozircha to&apos;langan qarzdorlik yo&apos;q — birinchi natijalar shu yerda ko&apos;rinadi.
        </div>
      ) : (
        <div className="grid gap-8 p-7 md:grid-cols-[240px_1fr]">
          <div className="relative mx-auto h-[240px] w-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={68} outerRadius={104} paddingAngle={4} strokeWidth={0} animationDuration={800} cornerRadius={6}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--color-card)", fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}
                  formatter={(value: number, _name, item) => [`${value} ta (${item.payload.pct}%)`, item.payload.name]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="text-center">
                <p className="font-display text-4xl font-extrabold tabular leading-none text-foreground">{data.total.count}</p>
                <p className="mt-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">yechilgan qarz</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {data.channels.map((ch) => {
              const meta = CHANNEL_META[ch.key];
              const Icon = meta?.icon ?? Bell;
              return (
                <div key={ch.key} className="flex items-center gap-4 rounded-xl border border-border bg-background p-4 transition-shadow hover:shadow-sm">
                  <div className="grid size-12 shrink-0 place-items-center rounded-xl shadow-sm" style={{ background: meta?.soft, color: meta?.color }}>
                    <Icon weight="fill" className="size-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-display text-base font-bold text-foreground">{ch.label}</p>
                      <p className="shrink-0 font-display text-xl font-extrabold tabular" style={{ color: meta?.color }}>
                        {ch.pct}%
                      </p>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full transition-all" style={{ width: `${ch.pct}%`, background: meta?.color }} />
                    </div>
                    <p className="mt-1.5 text-sm font-semibold text-muted-foreground">
                      {ch.count} ta qarz &middot; <span className="text-foreground">{ch.amount}</span>
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
