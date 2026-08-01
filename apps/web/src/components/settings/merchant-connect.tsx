"use client";

import { CheckCircle, CircleNotch, CreditCard } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { type MerchantData, saveMerchant } from "@/app/(app)/settings/merchant-actions";

export function MerchantConnect({ initial, webUrl }: { initial: MerchantData | null; webUrl: string }) {
  const router = useRouter();
  const [saving, start] = useTransition();
  const [click, setClick] = useState({ serviceId: initial?.click.serviceId ?? "", merchantId: initial?.click.merchantId ?? "", secretKey: "" });
  const [payme, setPayme] = useState({ merchantId: initial?.payme.merchantId ?? "", secretKey: "" });

  function save(which: "click" | "payme") {
    start(async () => {
      await saveMerchant(which === "click" ? { click } : { payme });
      if (which === "click") setClick((s) => ({ ...s, secretKey: "" }));
      else setPayme((s) => ({ ...s, secretKey: "" }));
      router.refresh();
    });
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center gap-2.5">
        <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <CreditCard weight="fill" className="size-5" />
        </span>
        <div>
          <h2 className="font-display text-base font-bold">Qarzdorlardan karta orqali to'lov qabul qilish</h2>
          <p className="text-xs text-muted-foreground">O'z Click/Payme merchantingizni ulang — qarzdorlar to'g'ridan-to'g'ri sizga to'laydi.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {/* Click */}
        <div className="rounded-2xl border border-border p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-semibold" style={{ color: "#0065FF" }}>Click merchant</span>
            {initial?.click.connected && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                <CheckCircle weight="fill" className="size-3.5" /> ulangan
              </span>
            )}
          </div>
          <div className="space-y-2">
            <Field label="Service ID" value={click.serviceId} onChange={(v) => setClick((s) => ({ ...s, serviceId: v }))} />
            <Field label="Merchant ID" value={click.merchantId} onChange={(v) => setClick((s) => ({ ...s, merchantId: v }))} />
            <Field label="Secret key" value={click.secretKey} onChange={(v) => setClick((s) => ({ ...s, secretKey: v }))} placeholder={initial?.click.secretKey || "•••• sir"} secret />
          </div>
          <button onClick={() => save("click")} disabled={saving} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {saving ? <CircleNotch className="size-4 animate-spin" /> : null} Saqlash
          </button>
        </div>

        {/* Payme */}
        <div className="rounded-2xl border border-border p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-semibold" style={{ color: "#00C0C9" }}>Payme merchant</span>
            {initial?.payme.connected && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                <CheckCircle weight="fill" className="size-3.5" /> ulangan
              </span>
            )}
          </div>
          <div className="space-y-2">
            <Field label="Merchant ID (Kassa ID)" value={payme.merchantId} onChange={(v) => setPayme((s) => ({ ...s, merchantId: v }))} />
            <Field label="Kassa kaliti (secret)" value={payme.secretKey} onChange={(v) => setPayme((s) => ({ ...s, secretKey: v }))} placeholder={initial?.payme.secretKey || "•••• sir"} secret />
          </div>
          <button onClick={() => save("payme")} disabled={saving} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {saving ? <CircleNotch className="size-4 animate-spin" /> : null} Saqlash
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] leading-relaxed text-muted-foreground">
        <b className="text-amber-600">Muhim:</b> merchant kabinetingizda (my.click.uz / Payme biznes) webhook (callback) manzilini quyidagiga o'rnating:
        <div className="mt-1 space-y-0.5 font-mono text-[10px]">
          <div>Click: {webUrl}/click/prepare · {webUrl}/click/complete</div>
          <div>Payme: {webUrl}/payme/callback</div>
        </div>
        Ulangandan so'ng jonli to'lovni avval kichik summada sinab ko'ring.
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, secret }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; secret?: boolean }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <input
        type={secret ? "password" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-0.5 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary/50"
      />
    </label>
  );
}
