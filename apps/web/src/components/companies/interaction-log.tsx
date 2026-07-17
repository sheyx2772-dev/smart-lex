"use client";

import { ChatCircleDots, CircleNotch, DeviceMobile, EnvelopeSimple, MapPin, PaperPlaneTilt, Phone, Plus, type Icon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { logInteraction } from "@/app/(app)/companies/[id]/actions";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface Interaction {
  id: string;
  kind: string;
  outcome: string;
  note: string;
  at: string | null;
}

const KINDS: { key: string; labelKey: string; icon: Icon }[] = [
  { key: "call", labelKey: "kCall", icon: Phone },
  { key: "visit", labelKey: "kVisit", icon: MapPin },
  { key: "sms", labelKey: "kSms", icon: DeviceMobile },
  { key: "telegram", labelKey: "kTelegram", icon: PaperPlaneTilt },
  { key: "email", labelKey: "kEmail", icon: EnvelopeSimple },
];
const OUTCOMES = [
  { key: "promised", labelKey: "oPromised", tone: "text-success" },
  { key: "partial", labelKey: "oPartial", tone: "text-primary" },
  { key: "no_answer", labelKey: "oNoAnswer", tone: "text-muted-foreground" },
  { key: "refused", labelKey: "oRefused", tone: "text-danger" },
  { key: "other", labelKey: "oOther", tone: "text-muted-foreground" },
];

export function InteractionLog({ contractorId, initial }: { contractorId: string; initial: Interaction[] }) {
  const t = useTranslations("interactions");
  const router = useRouter();
  const [items, setItems] = useState<Interaction[]>(initial);
  const [kind, setKind] = useState("call");
  const [outcome, setOutcome] = useState("promised");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const kindIcon = (k: string) => KINDS.find((x) => x.key === k)?.icon ?? Phone;
  const kindLabel = (k: string) => t((KINDS.find((x) => x.key === k)?.labelKey ?? "kCall") as never);
  const outcomeMeta = (o: string) => OUTCOMES.find((x) => x.key === o);
  const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50";

  async function add() {
    if (busy) return;
    setBusy(true);
    const res = await logInteraction(contractorId, { kind, outcome, note: note.trim() });
    setBusy(false);
    if (res.success) {
      setItems((prev) => [{ id: `tmp-${Date.now()}`, kind, outcome, note: note.trim(), at: new Date().toISOString() }, ...prev]);
      setNote("");
      router.refresh();
    }
  }

  return (
    <Card className="p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <ChatCircleDots weight="fill" className="size-4 text-primary" /> {t("title")}
      </h2>

      {/* Yangi yozuv */}
      <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{t("kind")}</span>
            <select value={kind} onChange={(e) => setKind(e.target.value)} className={field}>
              {KINDS.map((k) => (
                <option key={k.key} value={k.key}>
                  {t(k.labelKey as never)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{t("outcome")}</span>
            <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className={field}>
              {OUTCOMES.map((o) => (
                <option key={o.key} value={o.key}>
                  {t(o.labelKey as never)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("notePh")} rows={2} className={cn(field, "resize-y")} />
        <div className="flex justify-end">
          <button
            onClick={add}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy ? <CircleNotch className="size-4 animate-spin" /> : <Plus weight="bold" className="size-4" />}
            {busy ? t("adding") : t("add")}
          </button>
        </div>
      </div>

      {/* Jurnal */}
      {items.length === 0 ? (
        <p className="mt-4 py-4 text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {items.map((it) => {
            const Ic = kindIcon(it.kind);
            const om = outcomeMeta(it.outcome);
            return (
              <li key={it.id} className="flex gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                  <Ic weight="fill" className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-sm font-medium">{kindLabel(it.kind)}</span>
                    {om && <span className={cn("text-xs font-medium", om.tone)}>· {t(om.labelKey as never)}</span>}
                    <span className="ml-auto text-[11px] text-muted-foreground">{it.at ? new Date(it.at).toLocaleString() : ""}</span>
                  </div>
                  {it.note && <p className="mt-0.5 text-sm text-muted-foreground">{it.note}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
