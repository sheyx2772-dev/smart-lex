import { cn } from "@/lib/utils";

const GRADIENT: Record<string, string> = {
  primary: "from-primary to-secondary",
  secondary: "from-secondary to-primary",
  warning: "from-amber-500 to-orange-600",
  danger: "from-rose-500 to-red-600",
};
const ACCENT: Record<string, string> = {
  primary: "from-primary/70 to-secondary/70",
  secondary: "from-secondary/70 to-primary/70",
  warning: "from-amber-400/70 to-orange-500/70",
  danger: "from-rose-400/70 to-red-500/70",
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
  tone?: keyof typeof GRADIENT;
  plain?: boolean;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/70 bg-gradient-to-b from-card to-muted/25 p-5 shadow-[0_1px_2px_-1px_rgba(13,21,38,0.06),0_10px_26px_-14px_rgba(13,21,38,0.16)] transition-all hover:-translate-y-0.5 hover:shadow-[0_2px_4px_-1px_rgba(13,21,38,0.08),0_16px_34px_-16px_rgba(13,21,38,0.22)]">
      {/* Yuqori aksent chizig'i */}
      <span className={cn("pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r", ACCENT[tone])} />
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className={cn("grid size-9 place-items-center rounded-lg bg-gradient-to-br text-white shadow-sm ring-1 ring-black/5 transition-transform group-hover:scale-105", GRADIENT[tone])}>
          {icon}
        </span>
      </div>
      <p className={cn("mt-3.5 font-display font-semibold tracking-tight", plain ? "text-3xl" : "tabular text-[26px] leading-none")}>{value}</p>
    </div>
  );
}
