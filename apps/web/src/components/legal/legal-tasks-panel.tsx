"use client";

import { ArrowRight, CheckCircle, CircleNotch, Lightbulb, Robot, Sparkle, Warning } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import { fetchLegalTasks, resolveLegalTask, runLegalTaskAgent, type LegalTask } from "@/app/(app)/legal/actions";

const CATEGORY_META: Record<LegalTask["category"], { icon: typeof Warning; label: string; cls: string }> = {
  urgent: { icon: Warning, label: "Shoshilinch", cls: "bg-danger-soft text-danger" },
  recommendation: { icon: Lightbulb, label: "Tavsiya", cls: "bg-warning-soft text-warning" },
  auto_check: { icon: Sparkle, label: "Avtomatik tekshiruv", cls: "bg-primary-soft text-primary" },
};

/** "AI Vazifalari" navbati — apps/worker/src/legal-tasks.ts fon jarayonida to'ldiradi
 * (muddat skaneri, yangi shartnoma avtomatik tahlili, band muammosi topilsa tavsiya).
 * Static "0" tile o'rniga — real, harakat qilinadigan ro'yxat. */
export function LegalTasksPanel({ initial }: { initial: LegalTask[] }) {
  const [tasks, setTasks] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  async function refresh() {
    setTasks(await fetchLegalTasks());
  }

  async function resolve(id: string) {
    if (busyId) return;
    setBusyId(id);
    try {
      await resolveLegalTask(id);
      setTasks((t) => t.filter((x) => x.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  async function runAgent(id: string) {
    if (busyId) return;
    setBusyId(id);
    try {
      const res = await runLegalTaskAgent(id);
      if (res.success && res.data) {
        setDrafts((d) => ({ ...d, [id]: res.data!.draft }));
        setTasks((t) => t.filter((x) => x.id !== id));
      }
    } finally {
      setBusyId(null);
    }
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Robot weight="fill" className="size-4 text-primary" />
          <h2 className="font-display text-base font-semibold">AI Vazifalari</h2>
        </div>
        <p className="py-6 text-center text-sm text-muted-foreground">Hammasi nazoratda — hozircha e'tibor talab qiladigan narsa yo'q.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Robot weight="fill" className="size-4 text-primary" />
          <h2 className="font-display text-base font-semibold">AI Vazifalari</h2>
          <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger">{tasks.length}</span>
        </div>
        <button onClick={refresh} className="text-xs font-medium text-primary hover:underline">Yangilash</button>
      </div>
      <ul className="space-y-2.5">
        {tasks.map((t) => {
          const meta = CATEGORY_META[t.category];
          const Ic = meta.icon;
          const href = t.legalMatterId ? "/legal" : t.documentId ? "/documents" : t.contractorId ? `/companies/${t.contractorId}` : "/legal";
          const busy = busyId === t.id;
          return (
            <li key={t.id} className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${meta.cls}`}>
                  <Ic weight="fill" className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${meta.cls}`}>{meta.label}</span>
                    {t.contractorName && <span className="text-xs text-muted-foreground">{t.contractorName}</span>}
                  </div>
                  <p className="mt-1 text-sm font-semibold leading-snug">{t.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t.reason}</p>
                  {drafts[t.id] && (
                    <div className="mt-2 rounded-lg border border-success/30 bg-success-soft/40 p-2.5 text-xs">
                      <p className="mb-1 font-semibold text-success">AI tayyorladi — Tasdiqlar bo'limiga qo'yildi:</p>
                      <p className="whitespace-pre-wrap text-muted-foreground">{drafts[t.id]!.slice(0, 240)}{drafts[t.id]!.length > 240 ? "…" : ""}</p>
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Link href={href} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    Ko'rish <ArrowRight className="size-3" />
                  </Link>
                  {t.category === "urgent" && (
                    <button
                      onClick={() => runAgent(t.id)}
                      disabled={busy}
                      className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      {busy ? <CircleNotch className="size-3 animate-spin" /> : <Robot weight="fill" className="size-3" />}
                      Agent ishlasin
                    </button>
                  )}
                  <button
                    onClick={() => resolve(t.id)}
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
                  >
                    <CheckCircle className="size-3" /> Tasdiqlash
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
