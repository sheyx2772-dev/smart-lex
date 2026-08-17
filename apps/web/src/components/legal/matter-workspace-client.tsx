"use client";

import {
  CheckCircle,
  Clock,
  FileText,
  Gavel,
  Robot,
  ShieldWarning,
  Sparkle,
  UserCircle,
  Warning,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { patchMatter, type MatterDetail } from "@/app/(app)/legal/matters/[id]/actions";
import {
  MATTER_PRIORITY_LABEL,
  MATTER_PRIORITY_TONE,
  MATTER_RISK_TONE,
  MATTER_STATUS_LABEL,
  MATTER_TYPE_LABEL,
} from "@/components/legal/matter-labels";
import { MatterDraftPanel } from "@/components/legal/matter-draft-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "overview", label: "Umumiy ko'rinish", icon: UserCircle },
  { key: "ai", label: "AI Tahlili", icon: ShieldWarning },
  { key: "documents", label: "Hujjatlar", icon: FileText },
  { key: "approvals", label: "Loyihalar / Tasdiqlar", icon: CheckCircle },
  { key: "timeline", label: "Tarix", icon: Clock },
] as const;

const RISK_TONE: Record<string, "danger" | "warning" | "success" | "neutral"> = {
  critical: "danger",
  high: "danger",
  medium: "warning",
  low: "success",
};

const fmt = (x: string | null) => (x ? new Date(x).toLocaleDateString() : "—");
const fmtDT = (x: string | null) => (x ? new Date(x).toLocaleString() : "—");

export function MatterWorkspaceClient({ data }: { data: MatterDetail }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("overview");
  const [matter, setMatter] = useState(data.matter);
  const [pending, startTransition] = useTransition();

  function updateStatus(status: string) {
    setMatter((m) => ({ ...m, status }));
    startTransition(async () => {
      await patchMatter(matter.id, { status });
    });
  }
  function updatePriority(priority: string) {
    setMatter((m) => ({ ...m, priority }));
    startTransition(async () => {
      await patchMatter(matter.id, { priority });
    });
  }

  const docsWithRisk = data.documents.filter((d) => d.extracted?.riskAnalysis);

  return (
    <div className="w-full space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{matter.matterNumber}</p>
            <h1 className="font-display text-xl font-semibold tracking-tight">{matter.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{MATTER_TYPE_LABEL[matter.type] ?? matter.type}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {matter.riskLevel && <Badge tone={MATTER_RISK_TONE[matter.riskLevel] ?? "neutral"}>{matter.riskLevel}</Badge>}
            <Select value={matter.status} onChange={(e) => updateStatus(e.target.value)} disabled={pending} className="h-9 w-auto min-w-[9rem] text-xs">
              {Object.entries(MATTER_STATUS_LABEL).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
            <Select value={matter.priority} onChange={(e) => updatePriority(e.target.value)} disabled={pending} className="h-9 w-auto min-w-[7rem] text-xs">
              {Object.entries(MATTER_PRIORITY_LABEL).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-muted-foreground">
          <span>Kontragent: <span className="font-medium text-foreground">{matter.contractorName ?? "—"}</span></span>
          <span>Muddat: <span className="font-medium text-foreground">{fmt(matter.dueDate)}</span></span>
          {matter.contractNumber && <span>Shartnoma: <span className="font-medium text-foreground">{matter.contractNumber}</span></span>}
          <span>Ustuvorlik: <Badge tone={MATTER_PRIORITY_TONE[matter.priority] ?? "neutral"}>{MATTER_PRIORITY_LABEL[matter.priority] ?? matter.priority}</Badge></span>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid gap-4 lg:grid-cols-[188px_1fr]">
        <nav className="flex gap-1 overflow-x-auto lg:sticky lg:top-0 lg:flex-col lg:self-start lg:overflow-visible">
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={cn(
                  "flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon weight={active ? "fill" : "regular"} className="size-5 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0">
          {tab === "overview" && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Kontragent</CardTitle>
                </CardHeader>
                <CardContent>
                  {matter.contractorName ? (
                    <div className="grid gap-2 text-sm sm:grid-cols-2">
                      <p>Nomi: <span className="font-medium">{matter.contractorName}</span></p>
                      <p>STIR: <span className="font-medium">{matter.contractorTin ?? "—"}</span></p>
                      <p>Telefon: <span className="font-medium">{matter.contractorPhone ?? "—"}</span></p>
                      <p>Email: <span className="font-medium">{matter.contractorEmail ?? "—"}</span></p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Bu ish kontragentga bog'lanmagan.</p>
                  )}
                </CardContent>
              </Card>
              {matter.description && (
                <Card>
                  <CardHeader>
                    <CardTitle>Tavsif</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-line text-sm text-muted-foreground">{matter.description}</p>
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardHeader>
                  <CardTitle>AI Vazifalari</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {data.tasks.length === 0 ? (
                    <p className="px-5 py-6 text-center text-sm text-muted-foreground">Bu ish bo'yicha AI vazifasi yo'q.</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {data.tasks.map((t) => (
                        <li key={t.id} className="flex items-start gap-3 px-5 py-3">
                          <Sparkle weight="fill" className="mt-0.5 size-4 shrink-0 text-primary" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{t.title}</p>
                            <p className="text-xs text-muted-foreground">{t.reason}</p>
                          </div>
                          <Badge tone={t.status === "done" ? "success" : "neutral"}>{t.status}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
              {(matter.status === "filed" || matter.status === "in_court") && (
                <Link href="/court" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                  <Gavel className="size-4" /> Sudda ko'rish
                </Link>
              )}
            </div>
          )}

          {tab === "ai" && (
            <div className="space-y-3">
              {docsWithRisk.length === 0 ? (
                <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                  Hali AI tahlili yo'q — Hujjatlar bo'limidan shartnomani tahlil qiling.
                </div>
              ) : (
                docsWithRisk.map((d) => {
                  const ra = d.extracted!.riskAnalysis!;
                  return (
                    <Card key={d.id}>
                      <CardHeader className="flex-row items-center justify-between">
                        <CardTitle className="text-sm">{d.title}</CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge tone={RISK_TONE[ra.riskLevel] ?? "neutral"}>{ra.riskLevel}</Badge>
                          <span className="text-xs text-muted-foreground">{fmtDT(ra.analyzedAt)}</span>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2.5">
                        {ra.findings.map((f, i) => (
                          <div key={i} className="rounded-lg border border-border bg-muted/20 p-2.5">
                            <div className="flex items-center gap-2">
                              <Badge tone={RISK_TONE[f.riskLevel] ?? "neutral"}>{f.riskLevel}</Badge>
                              <span className="text-sm font-medium">{f.area}</span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{f.reason}</p>
                          </div>
                        ))}
                        {ra.missingClauses.length > 0 && (
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Yetishmayotgan bandlar</p>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {ra.missingClauses.map((cl, i) => (
                                <span key={i} className="rounded-md bg-warning-soft px-2 py-0.5 text-xs text-warning">{cl}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {ra.unusualClauses.length > 0 && (
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">G'ayrioddiy bandlar</p>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {ra.unusualClauses.map((cl, i) => (
                                <span key={i} className="rounded-md bg-danger-soft px-2 py-0.5 text-xs text-danger">{cl}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          )}

          {tab === "documents" && (
            <Card>
              <CardContent className="p-0">
                {data.documents.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm text-muted-foreground">Bog'langan hujjat yo'q.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {data.documents.map((d) => (
                      <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{d.title}</p>
                          <p className="text-xs text-muted-foreground">{d.type} · {fmt(d.createdAt)}</p>
                        </div>
                        <Link href={`/documents?id=${d.id}`} className="text-xs font-medium text-primary hover:underline">
                          Ko'rish
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          {tab === "approvals" && (
            <div className="space-y-4">
              <MatterDraftPanel
                matterId={matter.id}
                matter={{
                  title: matter.title,
                  type: matter.type,
                  contractorName: matter.contractorName,
                  contractorTin: matter.contractorTin,
                  description: matter.description,
                }}
              />
              <Card>
                <CardContent className="p-0">
                  {data.approvals.length === 0 ? (
                    <p className="px-5 py-10 text-center text-sm text-muted-foreground">Bu ish bo'yicha loyiha/tasdiq yo'q.</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {data.approvals.map((a) => (
                        <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                          <Warning className="size-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{a.type}</p>
                            <p className="text-xs text-muted-foreground">{fmtDT(a.createdAt)}</p>
                          </div>
                          <Badge tone={a.status === "approved" ? "success" : a.status === "rejected" ? "danger" : "neutral"}>{a.status}</Badge>
                          <Link href="/approvals" className="text-xs font-medium text-primary hover:underline">
                            Ko'rish
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {tab === "timeline" && (
            <Card>
              <CardContent className="p-0">
                {data.activity.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm text-muted-foreground">Hali faoliyat qayd etilmagan.</p>
                ) : (
                  <ol className="space-y-3 p-5">
                    {data.activity.map((a) => (
                      <li key={a.id} className="flex gap-3">
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                          {a.actorType === "ai_agent" ? <Robot weight="fill" className="size-4" /> : <UserCircle weight="fill" className="size-4" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-snug">{a.action}</p>
                          <p className="tabular text-xs text-muted-foreground">{fmtDT(a.createdAt)}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
