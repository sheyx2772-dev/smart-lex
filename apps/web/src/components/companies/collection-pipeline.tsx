import { ArrowRight, Bell, CheckCircle, CurrencyCircleDollar, Gavel, SealCheck, Truck, Warning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const ICONS = [CurrencyCircleDollar, Bell, Warning, SealCheck, Gavel, Truck] as const;

/**
 * Undiruv "voronkasi" — qarzdorning butun jarayondagi HOZIRGI bosqichi va
 * KEYINGI QADAMI bir qarashda ko'rinadi. Chalkashlik kamayadi: foydalanuvchi
 * qaysi menyuga borishini ham darhol biladi.
 *
 * Bosqichlar: 0 Qarzdorlik · 1 Eslatma · 2 Talabnoma/Da'vo · 3 Tasdiq · 4 Sud · 5 Ijro
 */
export function CollectionPipeline({
  current,
  labels,
  heading,
  nextLabel,
  next,
}: {
  current: number;
  labels: string[]; // 6 ta bosqich nomi
  heading: string; // "Undiruv bosqichi"
  nextLabel: string; // "Keyingi qadam"
  next?: { text: string; href?: string; cta?: string };
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
          <SealCheck weight="fill" className="size-4" />
        </span>
        <p className="text-[13px] font-semibold">{heading}</p>
      </div>

      {/* Voronka bosqichlari */}
      <div className="scroll-clean overflow-x-auto px-4 py-5">
        <ol className="flex min-w-[560px] items-start">
          {labels.map((label, i) => {
            const Icon = ICONS[i] ?? CurrencyCircleDollar;
            const done = i < current;
            const active = i === current;
            return (
              <li key={i} className="relative flex flex-1 flex-col items-center">
                {/* Konnektor chizig'i (chapdagi) */}
                {i > 0 && (
                  <span
                    className={cn(
                      "absolute right-1/2 top-5 h-0.5 w-full -translate-y-1/2 rounded",
                      i <= current ? "bg-gradient-to-r from-indigo-500 to-violet-500" : "bg-border",
                    )}
                  />
                )}
                <span
                  className={cn(
                    "relative z-10 grid size-10 place-items-center rounded-xl shadow-sm transition-colors",
                    done
                      ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-violet-500/25"
                      : active
                        ? "bg-white text-violet-600 shadow-md ring-2 ring-violet-500"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <CheckCircle weight="fill" className="size-5" /> : <Icon weight="fill" className="size-5" />}
                  {active && (
                    <span className="absolute -right-0.5 -top-0.5 flex size-3">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-violet-400 opacity-70" />
                      <span className="relative inline-flex size-3 rounded-full bg-violet-500 ring-2 ring-card" />
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "mt-2 max-w-[92px] text-center text-[11px] font-medium leading-tight",
                    active ? "text-foreground" : done ? "text-foreground/70" : "text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Keyingi qadam */}
      {next && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border bg-muted/30 px-5 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{nextLabel}</p>
            <p className="text-[13px] font-medium">{next.text}</p>
          </div>
          {next.href && next.cta && (
            <Link
              href={next.href}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm shadow-violet-500/25 transition-opacity hover:opacity-90"
            >
              {next.cta} <ArrowRight weight="bold" className="size-3.5" />
            </Link>
          )}
        </div>
      )}
    </Card>
  );
}
