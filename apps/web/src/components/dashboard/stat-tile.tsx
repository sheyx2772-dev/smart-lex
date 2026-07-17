import { cn } from "@/lib/utils";

/** Monoxrom asos: primary/secondary neytral (qora/kulrang); warning/danger —
 * funksional ranglar (ma'no tashiydi). */
const CHIP: Record<string, string> = {
  primary: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  warning: "bg-warning text-white",
  danger: "bg-danger text-white",
};

export function StatTile({
  label,
  value,
  icon,
  tone = "primary",
  plain = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: keyof typeof CHIP;
  plain?: boolean;
}) {
  return (
    <div className="group rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_-1px_rgba(13,21,38,0.06),0_10px_26px_-14px_rgba(13,21,38,0.16)] transition-all hover:-translate-y-0.5 hover:shadow-[0_2px_4px_-1px_rgba(13,21,38,0.08),0_16px_34px_-16px_rgba(13,21,38,0.20)]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className={cn("grid size-9 place-items-center rounded-lg shadow-sm ring-1 ring-black/5 transition-transform group-hover:scale-105", CHIP[tone])}>{icon}</span>
      </div>
      <p className={cn("mt-3.5 font-display font-semibold tracking-tight", plain ? "text-3xl" : "tabular text-[26px] leading-none")}>{value}</p>
    </div>
  );
}
