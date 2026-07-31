"use client";

import { Buildings, CheckCircle, CircleNotch, DownloadSimple, FileText, PaperPlaneTilt, SealCheck, ShieldCheck, UsersThree, Wallet, X, XCircle } from "@phosphor-icons/react";
import { useState } from "react";
import { fetchTenantDetail, setSubscription, setTenantPlan, type TenantDetail, type TenantDoc } from "@/app/(app)/admin/actions";

const SUB_LABEL: Record<string, string> = { none: "yo'q", trial: "sinov", active: "faol", expired: "tugagan" };
const SUB_CLASS: Record<string, string> = {
  none: "bg-muted text-muted-foreground",
  trial: "bg-amber-500/15 text-amber-600",
  active: "bg-emerald-500/15 text-emerald-600",
  expired: "bg-red-500/15 text-red-500",
};

function downloadWord(title: string, body: string) {
  const name = (title || "hujjat").replace(/[^\p{L}\p{N} _-]/gu, "");
  const html = `<html xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"></head><body style="font-family:'Times New Roman',serif;font-size:14px">${body || ""}</body></html>`;
  const url = URL.createObjectURL(new Blob(["﻿", html], { type: "application/msword" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}

export interface AdminTenant {
  id: string;
  name: string;
  type: string;
  tin: string;
  createdAt: string;
  users: number;
  receivables: number;
  outstanding: string;
  documents: number;
  reminders: number;
  pendingApprovals: number;
  lastActivity: string | null;
  plan: string | null;
  limit: number | null;
  subscription: { plan: string | null; status: "none" | "trial" | "active" | "expired"; until: string | null; trialUntil: string | null };
  ofertaAccepted: boolean;
  ofertaAcceptedAt: string | null;
  isPlatform: boolean;
}
export interface AdminData {
  totals: { tenants: number; users: number; receivables: number; documents: number; reminders: number; pendingApprovals: number; outstanding: string };
  tenants: AdminTenant[];
}

const PLANS = ["Boshlang'ich", "Standart", "Professional"];

export function AdminClient({ data }: { data: AdminData }) {
  const [editId, setEditId] = useState<string | null>(null);
  const [plan, setPlan] = useState("");
  const [limit, setLimit] = useState("");
  const [saving, setSaving] = useState(false);
  // Drill-down: mijoz hujjatlari + oferta
  const [detail, setDetail] = useState<TenantDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [viewDoc, setViewDoc] = useState<TenantDoc | null>(null);

  const [subBusy, setSubBusy] = useState<string | null>(null);

  async function openDetail(id: string) {
    setLoadingDetail(true);
    setDetail(null);
    setViewDoc(null);
    const d = await fetchTenantDetail(id);
    setDetail(d);
    setLoadingDetail(false);
  }
  async function doSub(id: string, opts: { months?: number; action?: "expire" }) {
    setSubBusy(id);
    await setSubscription(id, opts);
    setSubBusy(null);
  }

  const t = data.totals;
  const fmt = (d: string | null) => (d ? new Intl.DateTimeFormat("uz-UZ", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(d)) : "—");

  function openEdit(tn: AdminTenant) {
    setEditId(tn.id);
    setPlan(tn.plan ?? "");
    setLimit(tn.limit != null ? String(tn.limit) : "");
  }
  async function save(id: string) {
    setSaving(true);
    await setTenantPlan(id, plan, Number(limit) || 0);
    setSaving(false);
    setEditId(null);
  }

  const cards = [
    { label: "Mijozlar", value: t.tenants, icon: Buildings, tone: "text-primary" },
    { label: "Foydalanuvchilar", value: t.users, icon: UsersThree, tone: "text-primary" },
    { label: "Qarzlar", value: t.receivables, icon: Wallet, tone: "text-primary" },
    { label: "Hujjatlar", value: t.documents, icon: FileText, tone: "text-primary" },
    { label: "Eslatmalar", value: t.reminders, icon: PaperPlaneTilt, tone: "text-primary" },
    { label: "Kutilayotgan tasdiqlar", value: t.pendingApprovals, icon: SealCheck, tone: "text-danger" },
  ];

  return (
    <div className="w-full space-y-5">
      {/* Sarlavha */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Platforma boshqaruvi</h1>
          <p className="mt-1 text-sm text-muted-foreground">Barcha mijozlar, jarayonlar, obuna va hujjatlar — faqat administrator uchun.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary-soft px-4 py-2.5">
          <Wallet weight="fill" className="size-5 text-primary" />
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Jami qoldiq (qarz)</p>
            <p className="tabular font-display text-lg font-semibold">{t.outstanding}</p>
          </div>
        </div>
      </div>

      {/* Totallar */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => {
          const Ic = c.icon;
          return (
            <div key={c.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Ic weight="fill" className={`size-4 ${c.tone}`} />
                <span className="truncate text-xs">{c.label}</span>
              </div>
              <p className="tabular mt-1.5 font-display text-2xl font-semibold">{c.value}</p>
            </div>
          );
        })}
      </div>

      {/* Mijozlar jadvali */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <h2 className="font-display text-base font-semibold">Mijozlar ({data.tenants.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-2.5 font-medium">Mijoz</th>
                <th className="px-4 py-2.5 font-medium">Tarif / Limit</th>
                <th className="px-4 py-2.5 text-center font-medium">Foyd.</th>
                <th className="px-4 py-2.5 text-center font-medium">Qarzlar</th>
                <th className="px-4 py-2.5 text-right font-medium">Qoldiq</th>
                <th className="px-4 py-2.5 text-center font-medium">Hujjat</th>
                <th className="px-4 py-2.5 text-center font-medium">Eslatma</th>
                <th className="px-4 py-2.5 text-center font-medium">Tasdiq</th>
                <th className="px-4 py-2.5 font-medium">Oferta</th>
                <th className="px-4 py-2.5 font-medium">Obuna</th>
                <th className="px-4 py-2.5 font-medium">Oxirgi faoliyat</th>
              </tr>
            </thead>
            <tbody>
              {data.tenants.map((tn) => (
                <tr key={tn.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5 font-medium">
                      {tn.name}
                      {tn.isPlatform && <span className="rounded bg-primary-soft px-1.5 py-0.5 text-[10px] font-semibold text-primary">platforma</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">STIR: {tn.tin} · {tn.type} · {fmt(tn.createdAt)}</p>
                  </td>
                  <td className="px-4 py-3">
                    {editId === tn.id ? (
                      <div className="flex items-center gap-1.5">
                        <select value={plan} onChange={(e) => setPlan(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none">
                          <option value="">—</option>
                          {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <input value={limit} onChange={(e) => setLimit(e.target.value.replace(/\D/g, ""))} placeholder="limit" className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none" />
                        <button onClick={() => save(tn.id)} disabled={saving} className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"><CheckCircle weight="fill" className="size-4" /></button>
                        <button onClick={() => setEditId(null)} className="grid size-7 place-items-center rounded-lg border border-border"><XCircle className="size-4" /></button>
                      </div>
                    ) : (
                      <button onClick={() => openEdit(tn)} className="text-left transition-colors hover:text-primary">
                        <span className="font-medium">{tn.plan ?? <span className="text-muted-foreground">tarif yo&apos;q</span>}</span>
                        <span className="text-muted-foreground"> · {tn.limit != null ? `${tn.limit} limit` : "∞"}</span>
                      </button>
                    )}
                  </td>
                  <td className="tabular px-4 py-3 text-center">{tn.users}</td>
                  <td className="tabular px-4 py-3 text-center">{tn.receivables}</td>
                  <td className="tabular px-4 py-3 text-right font-medium">{tn.outstanding}</td>
                  <td className="tabular px-4 py-3 text-center">
                    <button onClick={() => openDetail(tn.id)} className="rounded px-2 py-0.5 font-medium text-primary underline-offset-2 hover:underline" title="Hujjatlarni ko'rish">
                      {tn.documents}
                    </button>
                  </td>
                  <td className="tabular px-4 py-3 text-center">{tn.reminders}</td>
                  <td className="tabular px-4 py-3 text-center">{tn.pendingApprovals > 0 ? <span className="text-danger">{tn.pendingApprovals}</span> : "0"}</td>
                  <td className="px-4 py-3">
                    {tn.ofertaAccepted ? (
                      <span className="inline-flex items-center gap-1 text-xs text-success"><ShieldCheck weight="fill" className="size-3.5" /> imzolangan</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex w-fit items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${SUB_CLASS[tn.subscription.status]}`}>
                        {SUB_LABEL[tn.subscription.status]}
                        {tn.subscription.status === "active" && tn.subscription.until ? ` · ${fmt(tn.subscription.until)}` : ""}
                        {tn.subscription.status === "trial" && tn.subscription.trialUntil ? ` · ${fmt(tn.subscription.trialUntil)}` : ""}
                      </span>
                      <div className="flex gap-1">
                        <button onClick={() => doSub(tn.id, { months: 1 })} disabled={subBusy === tn.id} className="rounded border border-emerald-500/40 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 transition-colors hover:bg-emerald-500/10 disabled:opacity-50" title="To'lov tasdiqlandi — +1 oy">+1 oy</button>
                        {(tn.subscription.status === "active" || tn.subscription.status === "trial") && (
                          <button onClick={() => doSub(tn.id, { action: "expire" })} disabled={subBusy === tn.id} className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50" title="To'xtatish">to'xtat</button>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmt(tn.lastActivity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drill-down: mijoz hujjatlari + oferta */}
      {(loadingDetail || detail) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setDetail(null); setLoadingDetail(false); }}>
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h3 className="font-display text-base font-semibold">{detail ? detail.tenant.name : "Yuklanmoqda…"}</h3>
              <button onClick={() => setDetail(null)} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
            </div>
            {loadingDetail ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><CircleNotch className="size-5 animate-spin" /> Yuklanmoqda…</div>
            ) : detail ? (
              <div className="scroll-clean min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                {/* Oferta */}
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ommaviy oferta</p>
                  {detail.oferta.accepted ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm text-success">
                        <ShieldCheck weight="fill" className="size-4" /> Imzolangan
                        <span className="text-muted-foreground">· {detail.oferta.signer} · {fmt(detail.oferta.acceptedAt)} · {detail.oferta.method ?? "One-ID"}</span>
                      </div>
                      <a href="/oferta" target="_blank" rel="noreferrer" className="text-xs font-medium text-primary hover:underline">ofertani ochish →</a>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Hali imzolanmagan</p>
                  )}
                </div>

                {/* Hujjatlar */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hujjatlar ({detail.documents.length})</p>
                  {detail.documents.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Hujjat yo&apos;q</p>
                  ) : (
                    <div className="space-y-1.5">
                      {detail.documents.map((d) => (
                        <div key={d.id} className="flex items-center gap-3 rounded-lg border border-border bg-background p-2.5">
                          <FileText weight="fill" className="size-4 shrink-0 text-primary" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{d.title}</p>
                            <p className="text-xs text-muted-foreground">{d.type} · {fmt(d.createdAt)} {d.signed && <span className="text-success">· imzolangan</span>}</p>
                          </div>
                          <button onClick={() => setViewDoc(d)} className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted">Ko&apos;rish</button>
                          <button onClick={() => downloadWord(d.title, d.body)} className="grid size-8 place-items-center rounded-lg border border-border text-primary hover:bg-primary-soft" title="Word yuklab olish"><DownloadSimple className="size-4" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Hujjatni ko'rish */}
      {viewDoc && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => setViewDoc(null)}>
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h3 className="truncate font-display text-sm font-semibold">{viewDoc.title}</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => downloadWord(viewDoc.title, viewDoc.body)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary-soft"><DownloadSimple className="size-4" /> Word</button>
                <button onClick={() => setViewDoc(null)} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
              </div>
            </div>
            <div className="scroll-clean min-h-0 flex-1 overflow-y-auto bg-white p-8">
              <div className="prose prose-sm mx-auto max-w-none text-black [&_h2]:text-center" dangerouslySetInnerHTML={{ __html: viewDoc.body || "<p>Matn yo'q</p>" }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
