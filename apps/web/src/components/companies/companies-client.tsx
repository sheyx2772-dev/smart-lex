"use client";

import { ArrowRight, Buildings, FilePlus, FileText, MagnifyingGlass, ShieldWarning, Timer } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { fetchCompanies } from "@/app/(app)/companies/actions";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

interface Amount {
  minor: string;
  formatted: string;
}
interface CompanyItem {
  id: string;
  name: string;
  tin: string;
  phone: string | null;
  email: string | null;
  outstanding: Amount;
  penalty: Amount;
  overdueCount: number;
  riskScore: number;
  maxOverdueDays: number;
  documentsCount: number;
  contractsCount: number;
}
export interface CompaniesData {
  items: CompanyItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

function riskTone(score: number): BadgeProps["tone"] {
  if (score >= 70) return "danger";
  if (score >= 40) return "warning";
  return "success";
}

export function CompaniesClient({ initial, workMode = "debt" }: { initial: CompaniesData; workMode?: "debt" | "legal" }) {
  const isLegal = workMode === "legal";
  const t = useTranslations("companies");
  const tNew = useTranslations("newContract");
  const [data, setData] = useState<CompaniesData>(initial);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const firstQ = useRef(true);

  async function load(page: number, query = q) {
    setLoading(true);
    const d = await fetchCompanies({ page, q: query });
    if (d) setData(d);
    setLoading(false);
  }

  useEffect(() => {
    if (firstQ.current) {
      firstQ.current = false;
      return;
    }
    const id = setTimeout(() => load(1, q), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="h-9 w-64 rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none transition-shadow placeholder:text-muted-foreground/55 focus:ring-4 focus:ring-primary/10"
            />
          </div>
          <Link
            href="/contracts/new"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <FilePlus weight="fill" className="size-4" />
            {tNew("newBtn")}
          </Link>
        </div>
      </div>

      {/* Grid */}
      <div className="scroll-clean min-h-0 flex-1 overflow-y-auto pr-1">
        {data.items.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
            {t("empty")}
          </div>
        ) : (
          <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-3 transition-opacity", loading && "opacity-50")}>
            {data.items.map((c) => (
              <Link
                key={c.id}
                href={`/companies/${c.id}`}
                className="group flex flex-col rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                    <Buildings weight="fill" className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold leading-tight">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{t("tin")}: {c.tin}</p>
                  </div>
                  {!isLegal && (
                    <Badge tone={riskTone(c.riskScore)}>
                      <ShieldWarning weight="fill" className="size-3" />
                      {c.riskScore}
                    </Badge>
                  )}
                </div>

                {isLegal ? (
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("contracts")}</p>
                      <p className="tabular font-display text-lg font-semibold">{c.contractsCount}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{c.documentsCount} {t("docs")}</span>
                  </div>
                ) : (
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("totalDebt")}</p>
                      <p className="tabular font-display text-lg font-semibold">{c.outstanding.formatted}</p>
                    </div>
                    {c.overdueCount > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-danger-soft px-2 py-1 text-xs font-medium text-danger">
                        <Timer weight="fill" className="size-3.5" />
                        {c.overdueCount} {t("overdue")}
                      </span>
                    ) : (
                      <span className="text-xs text-success">{t("noOverdue")}</span>
                    )}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <FileText className="size-3.5" /> {c.documentsCount} {t("docs")}
                    </span>
                    <span>· {c.contractsCount} {t("contracts")}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    {t("openCase")} <ArrowRight className="size-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3">
        <Pagination page={data.page} pageCount={data.pageCount} pageSize={data.pageSize} total={data.total} onPage={(p) => load(p)} disabled={loading} />
      </div>
    </div>
  );
}
