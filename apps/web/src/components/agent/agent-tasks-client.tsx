"use client";

import { Brain, CheckCircle, CircleNotch, Gauge, Play, Plus, Robot, Scroll, Sparkle } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createTask, runTask } from "@/app/(app)/agent/tasks/actions";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface AgentTask {
  id: string;
  action: string;
  title: string;
  receivableId: string | null;
  deadline: string | null;
  status: string;
  result: string | null;
  completedAt: string | null;
  createdAt: string;
  contractorName: string | null;
}
export interface TaskDebtor {
  id: string;
  name: string;
  invoice: string;
}

const ACTIONS = [
  { key: "analyze", labelKey: "actAnalyze", icon: Brain },
  { key: "score", labelKey: "actScore", icon: Gauge },
  { key: "demand", labelKey: "actDemand", icon: Scroll },
  { key: "custom", labelKey: "actCustom", icon: Sparkle },
] as const;

export function AgentTasksClient({ tasks, debtors }: { tasks: AgentTask[]; debtors: TaskDebtor[] }) {
  const t = useTranslations("agentTasks");
  const router = useRouter();

  const [action, setAction] = useState<string>("analyze");
  const [title, setTitle] = useState("");
  const [receivableId, setReceivableId] = useState("");
  const [deadline, setDeadline] = useState("");
  const [creating, setCreating] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);

  async function create() {
    if (!title.trim() || creating) return;
    setCreating(true);
    const res = await createTask({ action, title: title.trim(), receivableId: receivableId || undefined, deadline: deadline || undefined });
    setCreating(false);
    if (res.success) {
      setTitle("");
      setReceivableId("");
      setDeadline("");
      router.refresh();
    }
  }
  async function run(id: string) {
    setRunningId(id);
    await runTask(id);
    setRunningId(null);
    router.refresh();
  }

  const actLabel = (a: string) => t((ACTIONS.find((x) => x.key === a)?.labelKey ?? "actCustom") as never);
  const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary/50";

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-secondary text-white shadow-lg shadow-primary/25">
          <Robot weight="fill" className="size-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      {/* Yangi topshiriq */}
      <Card className="p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <Plus weight="bold" className="size-4 text-primary" /> {t("newTask")}
        </h2>
        <div className="space-y-3">
          <div>
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{t("action")}</span>
            <div className="flex flex-wrap gap-2">
              {ACTIONS.map((a) => {
                const Ic = a.icon;
                const active = action === a.key;
                return (
                  <button
                    key={a.key}
                    onClick={() => setAction(a.key)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                      active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Ic weight={active ? "fill" : "regular"} className="size-4" /> {t(a.labelKey as never)}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("taskTitle")}</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("taskTitlePh")} className={field} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("target")}</label>
              <select value={receivableId} onChange={(e) => setReceivableId(e.target.value)} className={field}>
                <option value="">{t("targetNone")}</option>
                {debtors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} · {d.invoice}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t("deadline")}</label>
              <input value={deadline} onChange={(e) => setDeadline(e.target.value)} type="date" className={field} />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={create}
              disabled={creating || !title.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {creating ? <CircleNotch className="size-4 animate-spin" /> : <Plus weight="bold" className="size-4" />}
              {creating ? t("creating") : t("create")}
            </button>
          </div>
        </div>
      </Card>

      {/* Ro'yxat */}
      {tasks.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border text-muted-foreground">
          <Robot weight="fill" className="size-8" />
          <p className="text-sm">{t("empty")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const done = task.status === "done";
            return (
              <Card key={task.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">{actLabel(task.action)}</span>
                      {task.deadline && <span className="text-[11px] text-muted-foreground">{new Date(task.deadline).toLocaleDateString()}</span>}
                    </div>
                    <p className="mt-1 text-sm font-semibold">{task.title}</p>
                    {task.contractorName && <p className="text-xs text-muted-foreground">{task.contractorName}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {done ? (
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                        <CheckCircle weight="fill" className="size-4" /> {t("stDone")}
                      </span>
                    ) : (
                      <button
                        onClick={() => run(task.id)}
                        disabled={runningId === task.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                      >
                        {runningId === task.id ? <CircleNotch className="size-4 animate-spin" /> : <Play weight="fill" className="size-4" />}
                        {runningId === task.id ? t("running") : t("run")}
                      </button>
                    )}
                  </div>
                </div>
                {task.result && (
                  <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("resultLabel")}</p>
                    <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-foreground">{task.result}</pre>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
