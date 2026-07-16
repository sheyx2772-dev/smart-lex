import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  primary: "text-primary bg-primary-soft",
  warning: "text-warning bg-warning-soft",
  danger: "text-danger bg-danger-soft",
  secondary: "text-secondary bg-secondary-soft",
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
  tone?: keyof typeof TONE;
  plain?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className={cn("grid size-8 place-items-center rounded-md", TONE[tone])}>{icon}</span>
      </div>
      <p className={cn("mt-3 font-display font-semibold tracking-tight", plain ? "text-3xl" : "tabular text-2xl")}>
        {value}
      </p>
    </div>
  );
}
