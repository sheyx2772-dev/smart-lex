"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/** Ko'rsatiladigan sahifa raqamlari (joriy atrofida + chekkalar, ellipsis bilan). */
function pageWindow(current: number, count: number): (number | "…")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(count - 1, current + 1);
  if (start > 2) out.push("…");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < count - 1) out.push("…");
  out.push(count);
  return out;
}

export function Pagination({
  page,
  pageCount,
  pageSize,
  total,
  onPage,
  disabled,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("common");
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
      <p className="text-xs text-muted-foreground">
        <span className="tabular font-medium text-foreground">
          {from}–{to}
        </span>{" "}
        / <span className="tabular">{total}</span>
      </p>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={disabled || page <= 1}
          aria-label={t("prev")}
          className="grid size-8 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-muted-foreground/30 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <CaretLeft className="size-4" />
        </button>

        {pageCount > 1 &&
          pageWindow(page, pageCount).map((p, i) =>
            p === "…" ? (
              <span key={`e${i}`} className="px-1.5 text-sm text-muted-foreground">
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onPage(p)}
                disabled={disabled}
                className={cn(
                  "tabular grid h-8 min-w-8 place-items-center rounded-lg border px-2 text-sm font-medium transition-colors disabled:pointer-events-none",
                  p === page
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground",
                )}
              >
                {p}
              </button>
            ),
          )}

        <button
          onClick={() => onPage(page + 1)}
          disabled={disabled || page >= pageCount}
          aria-label={t("next")}
          className="grid size-8 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-muted-foreground/30 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <CaretRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
