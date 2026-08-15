"use client";

import {
  ArrowLineDown,
  ArrowLineUp,
  Buildings,
  CaretDown,
  CaretUp,
  CaretUpDown,
  CheckCircle,
  CircleNotch,
  Clock,
  DownloadSimple,
  FileText,
  Gavel,
  PaperPlaneTilt,
  Robot,
  Scales,
  SealCheck,
  ShieldCheck,
  Truck,
  User,
  UsersThree,
  Wallet,
  X,
  XCircle,
  type Icon,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { fetchTenantDetail, setSubscription, setTenantPlan, type TenantDetail, type TenantDoc } from "@/app/(app)/admin/actions";
import { sanitizeHtml } from "@/lib/doc-html";

const SUB_LABEL: Record<string, string> = { none: "yo'q", trial: "sinov", active: "faol", expired: "tugagan" };
const SUB_CLASS: Record<string, string> = {
  none: "bg-muted text-muted-foreground",
  trial: "bg-amber-500/15 text-amber-600",
  active: "bg-emerald-500/15 text-emerald-600",
  expired: "bg-red-500/15 text-red-500",
};

const STAGE_META: Record<string, { label: string; icon: Icon; tone: string }> = {
  pre_legal: { label: "Pre-sud (eslatma/kelishuv)", icon: Clock, tone: "text-primary" },
  legal: { label: "Sudda", icon: Gavel, tone: "text-amber-600" },
  enforcement: { label: "Ijroda", icon: Truck, tone: "text-danger" },
  closed: { label: "Yakunlangan", icon: CheckCircle, tone: "text-success" },
};
const STAGE_ORDER = ["pre_legal", "legal", "enforcement", "closed"];

const ACTOR_ICON: Record<string, Icon> = { ai_agent: Robot, user: User, system: SealCheck };

function authMethodLabel(m?: string): string {
  const map: Record<string, string> = {
    PKCSMETHOD: "E-IMZO (PKCS7)",
    LEPKCSMETHOD: "E-IMZO (yuridik shaxs)",
    MOBILEIDMETHOD: "Mobile-ID",
    LOGINPASSMETHOD: "Login/parol",
    QR: "QR",
  };
  return (m && map[m]) || m || "—";
}

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
  totals: {
    tenants: number;
    users: number;
    receivables: number;
    documents: number;
    reminders: number;
    pendingApprovals: number;
    outstanding: string;
    balance: { currency: string; debitMinor: string; debit: string; kreditMinor: string; kredit: string; monitoredMinor: string; monitored: string };
  };
  tenants: AdminTenant[];
}

const PLANS = ["Boshlang'ich", "Standart", "Professional"];

const SUB_RANK: Record<string, number> = { none: 0, expired: 1, trial: 2, active: 3 };

type SortKey = "name" | "plan" | "users" | "receivables" | "outstanding" | "documents" | "reminders" | "pendingApprovals" | "oferta" | "subscription" | "lastActivity";

const SORT_COLUMNS: { key: SortKey; label: string; align?: "center" | "right" }[] = [
  { key: "name", label: "Mijoz" },
  { key: "plan", label: "Tarif / Limit" },
  { key: "users", label: "Foyd.", align: "center" },
  { key: "receivables", label: "Qarzlar", align: "center" },
  { key: "outstanding", label: "Qoldiq", align: "right" },
  { key: "documents", label: "Hujjat", align: "center" },
  { key: "reminders", label: "Eslatma", align: "center" },
  { key: "pendingApprovals", label: "Tasdiq", align: "center" },
  { key: "oferta", label: "Oferta" },
  { key: "subscription", label: "Obuna" },
  { key: "lastActivity", label: "Oxirgi faoliyat" },
];

/** Har bir ustun uchun taqqoslanadigan qiymat — raqam/matn/sana aralash bo'lgani uchun. */
function sortValue(tn: AdminTenant, key: SortKey): string | number {
  switch (key) {
    case "name":
      return tn.name;
    case "plan":
      return tn.plan ?? "";
    case "users":
      return tn.users;
    case "receivables":
      return tn.receivables;
    case "outstanding":
      return Number(tn.outstanding.replace(/[^\d.-]/g, "")) || 0;
    case "documents":
      return tn.documents;
    case "reminders":
      return tn.reminders;
    case "pendingApprovals":
      return tn.pendingApprovals;
    case "oferta":
      return tn.ofertaAccepted ? 1 : 0;
    case "subscription":
      return SUB_RANK[tn.subscription.status] ?? 0;
    case "lastActivity":
      return tn.lastActivity ? new Date(tn.lastActivity).getTime() : -Infinity;
  }
}

export function AdminClient({ data }: { data: AdminData }) {
  const [editId, setEditId] = useState<string | null>(null);
  const [plan, setPlan] = useState("");
  const [limit, setLimit] = useState("");
  const [saving, setSaving] = useState(false);
  // Drill-down: mijoz hujjatlari + oferta
  const [detail, setDetail] = useState<TenantDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [viewDoc, setViewDoc] = useState<TenantDoc | null>(null);
  const [proofOpen, setProofOpen] = useState(false);

  const [subBusy, setSubBusy] = useState<string | null>(null);

  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);
  function toggleSort(key: SortKey) {
    setSort((prev) => (prev && prev.key === key ? (prev.dir === "asc" ? { key, dir: "desc" } : null) : { key, dir: "asc" }));
  }
  const sortedTenants = useMemo(() => {
    if (!sort) return data.tenants;
    const { key, dir } = sort;
    return [...data.tenants].sort((a, b) => {
      const va = sortValue(a, key);
      const vb = sortValue(b, key);
      const cmp = typeof va === "string" && typeof vb === "string" ? va.localeCompare(vb, "uz") : (va as number) - (vb as number);
      return dir === "asc" ? cmp : -cmp;
    });
  }, [data.tenants, sort]);

  async function openDetail(id: string) {
    setLoadingDetail(true);
    setDetail(null);
    setViewDoc(null);
    setProofOpen(false);
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
      </div>

      {/* Debit / Kredit / Nazoratdagi umumiy summa — platforma bo'ylab real balans */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ArrowLineDown weight="fill" className="size-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wide">Debit</span>
          </div>
          <p className="tabular mt-1.5 font-display text-2xl font-extrabold tracking-tight">{t.balance.debit}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Mijozlar sizga qarzdor</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ArrowLineUp weight="fill" className="size-4 text-warning" />
            <span className="text-xs font-semibold uppercase tracking-wide">Kredit</span>
          </div>
          <p className="tabular mt-1.5 font-display text-2xl font-extrabold tracking-tight">{t.balance.kredit}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Siz boshqalarga qarzdorsiz</p>
        </div>
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary-soft to-primary-soft/40 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-primary">
            <Scales weight="fill" className="size-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Nazoratdagi umumiy summa</span>
          </div>
          <p className="tabular mt-1.5 font-display text-2xl font-extrabold tracking-tight text-primary">{t.balance.monitored}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">AI real vaqtda kuzatib turgan jami mablag&apos;</p>
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
                {SORT_COLUMNS.map((col) => {
                  const active = sort?.key === col.key;
                  const CaretIcon = active ? (sort!.dir === "asc" ? CaretUp : CaretDown) : CaretUpDown;
                  return (
                    <th key={col.key} className={`px-4 py-2.5 font-medium first:px-5 ${col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : "text-left"}`}>
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className={`inline-flex items-center gap-1 transition-colors hover:text-foreground ${active ? "text-foreground" : ""} ${col.align === "center" ? "justify-center" : col.align === "right" ? "justify-end" : ""}`}
                      >
                        {col.label}
                        <CaretIcon weight={active ? "bold" : "regular"} className={`size-3 ${active ? "" : "opacity-40"}`} />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedTenants.map((tn) => (
                <tr
                  key={tn.id}
                  onClick={() => openDetail(tn.id)}
                  className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-primary-soft/40"
                  title="Batafsil ko'rish"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5 font-medium">
                      {tn.name}
                      {tn.isPlatform && <span className="rounded bg-primary-soft px-1.5 py-0.5 text-[10px] font-semibold text-primary">platforma</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">STIR: {tn.tin} · {tn.type} · {fmt(tn.createdAt)}</p>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
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
                  <td className="tabular px-4 py-3 text-center font-medium text-primary">{tn.documents}</td>
                  <td className="tabular px-4 py-3 text-center">{tn.reminders}</td>
                  <td className="tabular px-4 py-3 text-center">{tn.pendingApprovals > 0 ? <span className="text-danger">{tn.pendingApprovals}</span> : "0"}</td>
                  <td className="px-4 py-3">
                    {tn.ofertaAccepted ? (
                      <span className="inline-flex items-center gap-1 text-xs text-success"><ShieldCheck weight="fill" className="size-3.5" /> imzolangan</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
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

      {/* Drill-down: mijoz to'liq kesimi — oferta isboti, sud bosqichlari, AI faoliyati, hujjatlar */}
      {(loadingDetail || detail) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setDetail(null); setLoadingDetail(false); }}>
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div>
                <h3 className="font-display text-base font-semibold">{detail ? detail.tenant.name : "Yuklanmoqda…"}</h3>
                {detail && (
                  <p className="text-xs text-muted-foreground">
                    {detail.plan ?? "tarif yo'q"} · {detail.limit != null ? `${detail.limit} limit` : "∞"} ·{" "}
                    <span className={`rounded px-1 py-0.5 font-medium ${SUB_CLASS[detail.subscription.status]}`}>{SUB_LABEL[detail.subscription.status]}</span>
                  </p>
                )}
              </div>
              <button onClick={() => setDetail(null)} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
            </div>
            {loadingDetail ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><CircleNotch className="size-5 animate-spin" /> Yuklanmoqda…</div>
            ) : detail ? (
              <div className="scroll-clean min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                {/* Undiruv/sud bosqichlari */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Undiruv bosqichlari ({detail.cases.total} ta ish)</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {STAGE_ORDER.map((k) => {
                      const meta = STAGE_META[k]!;
                      const Ic = meta.icon;
                      return (
                        <div key={k} className="rounded-lg border border-border bg-background p-2.5">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Ic weight="fill" className={`size-3.5 ${meta.tone}`} />
                            <span className="truncate text-[10px] uppercase tracking-wide">{meta.label}</span>
                          </div>
                          <p className="tabular mt-1 font-display text-lg font-semibold">{detail.cases.byStage[k] ?? 0}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Oferta + ISBOT */}
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ommaviy oferta</p>
                  {detail.oferta.accepted ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm text-success">
                          <ShieldCheck weight="fill" className="size-4" /> Imzolangan
                          <span className="text-muted-foreground">· {detail.oferta.signer} · {fmt(detail.oferta.acceptedAt)} · {authMethodLabel(detail.oferta.method ?? undefined)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button onClick={() => setProofOpen((v) => !v)} disabled={!detail.oferta.proof} className="text-xs font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline">
                            {proofOpen ? "isbotni yopish" : "isbotni ko'rish"} →
                          </button>
                          <a href="/oferta" target="_blank" rel="noreferrer" className="text-xs font-medium text-muted-foreground hover:underline">shartlar matni →</a>
                        </div>
                      </div>
                      {proofOpen && (
                        <div className="mt-3 space-y-1.5 rounded-lg border border-border bg-background p-3 font-mono text-[11px] leading-relaxed">
                          {detail.oferta.proof ? (
                            <>
                              <p><span className="text-muted-foreground">kirish usuli:</span> {detail.oferta.proof.authMethod ?? "—"}</p>
                              <p><span className="text-muted-foreground">E-IMZO (ERI) bilan:</span> {detail.oferta.proof.eri ? "ha" : "yo'q"}</p>
                              <p><span className="text-muted-foreground">yuridik shaxs ERIsi:</span> {detail.oferta.proof.legalEri ? "ha" : "yo'q"}</p>
                              <p><span className="text-muted-foreground">One-ID tasdiqlagan:</span> {detail.oferta.proof.verified ? "ha" : "yo'q"}</p>
                              <p><span className="text-muted-foreground">STIR:</span> {detail.oferta.proof.legalTin ?? "—"}</p>
                              <p><span className="text-muted-foreground">sessiya ID:</span> {detail.oferta.proof.sessId ?? "—"}</p>
                              <p><span className="text-muted-foreground">audit yozuv vaqti:</span> {fmt(detail.oferta.proof.at)}</p>
                              <p className="pt-1 text-muted-foreground">Manba: o'zgartirib bo'lmaydigan audit zanjiri (auth.oneid_login) — /audit bo'limida tekshiriladi.</p>
                            </>
                          ) : (
                            <p className="text-muted-foreground">Bu tenant uchun audit yozuvi topilmadi (eski/qo'lda yaratilgan hisob bo'lishi mumkin).</p>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Hali imzolanmagan</p>
                  )}
                </div>

                {/* AI faoliyati */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">So&apos;nggi AI faoliyati</p>
                  {detail.activity.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">Hali faoliyat yo&apos;q</p>
                  ) : (
                    <div className="space-y-1">
                      {detail.activity.map((a) => {
                        const Ic = ACTOR_ICON[a.actorType] ?? SealCheck;
                        return (
                          <div key={a.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs hover:bg-muted/40">
                            <Ic weight="fill" className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 flex-1 truncate">{a.action}</span>
                            <span className="shrink-0 text-muted-foreground">{fmt(a.createdAt)}</span>
                          </div>
                        );
                      })}
                    </div>
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
              <div className="prose prose-sm mx-auto max-w-none text-black [&_h2]:text-center" dangerouslySetInnerHTML={{ __html: sanitizeHtml(viewDoc.body || "<p>Matn yo'q</p>") }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
