"use client";

import { Buildings, CheckCircle, FileText, PaperPlaneTilt, SealCheck, ShieldCheck, UsersThree, Wallet, XCircle } from "@phosphor-icons/react";
import { useState } from "react";
import { setTenantPlan } from "@/app/(app)/admin/actions";

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
                  <td className="tabular px-4 py-3 text-center">{tn.documents}</td>
                  <td className="tabular px-4 py-3 text-center">{tn.reminders}</td>
                  <td className="tabular px-4 py-3 text-center">{tn.pendingApprovals > 0 ? <span className="text-danger">{tn.pendingApprovals}</span> : "0"}</td>
                  <td className="px-4 py-3">
                    {tn.ofertaAccepted ? (
                      <span className="inline-flex items-center gap-1 text-xs text-success"><ShieldCheck weight="fill" className="size-3.5" /> imzolangan</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmt(tn.lastActivity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
