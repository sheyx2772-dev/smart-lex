"use client";

import { CheckCircle, ClipboardText, PaperPlaneTilt, Sparkle } from "@phosphor-icons/react";
import { useState } from "react";
import { submitMatterDraft } from "@/app/(app)/legal/matters/[id]/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const DOC_TYPES = [
  { key: "contract", label: "Shartnoma", instruction: "Ushbu ish bo'yicha to'liq, professional shartnoma matnini tuz." },
  { key: "claim", label: "Da'vo arizasi", instruction: "Iqtisodiy sudga ushbu ish bo'yicha to'liq, professional da'vo arizasi matnini tuz." },
  { key: "demand", label: "Pretenziya", instruction: "Ushbu ish bo'yicha kontragentga yuboriladigan sudgacha pretenziya (talabnoma) xatini tuz." },
  { key: "opinion", label: "Huquqiy xulosa", instruction: "Ushbu ish bo'yicha huquqiy xulosa (risklar, tavsiyalar, huquqiy asos bilan) tayyorla." },
  { key: "free", label: "Erkin", instruction: "" },
] as const;

interface MatterContext {
  title: string;
  type: string;
  contractorName: string | null;
  contractorTin: string | null;
  description: string | null;
}

export function MatterDraftPanel({ matterId, matter }: { matterId: string; matter: MatterContext }) {
  const [docType, setDocType] = useState<(typeof DOC_TYPES)[number]["key"]>("contract");
  const [details, setDetails] = useState("");
  const [draft, setDraft] = useState("");
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  async function generate() {
    if (generating) return;
    setGenerating(true);
    setError(false);
    setSent(false);
    setDraft("");
    const tpl = DOC_TYPES.find((d) => d.key === docType)!;
    const context = [
      `Ish: ${matter.title} (turi: ${matter.type})`,
      matter.contractorName ? `Kontragent: ${matter.contractorName}${matter.contractorTin ? `, STIR: ${matter.contractorTin}` : ""}` : "",
      matter.description ? `Tavsif: ${matter.description}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const instruction = `${tpl.instruction || "Ushbu ish bo'yicha so'ralgan hujjatni tuz."}\n\nIsh konteksti:\n${context}${details.trim() ? `\n\nQo'shimcha tafsilotlar:\n${details.trim()}` : ""}`;

    try {
      const res = await fetch("/api/studio/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      });
      if (!res.ok || !res.body) throw new Error("stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setDraft(acc);
      }
      if (!acc.trim()) setError(true);
    } catch {
      setError(true);
    } finally {
      setGenerating(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function sendToApproval() {
    if (submitting || !draft.trim()) return;
    setSubmitting(true);
    const res = await submitMatterDraft(matterId, { body: draft, docType });
    setSubmitting(false);
    if (res.success) setSent(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hujjat tayyorlash</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3.5">
        <div className="flex flex-wrap gap-1.5">
          {DOC_TYPES.map((d) => (
            <button
              key={d.key}
              onClick={() => setDocType(d.key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                docType === d.key ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {d.label}
            </button>
          ))}
        </div>

        <Textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Qo'shimcha tafsilotlar (summa, muddat, shartlar va h.k.) — bo'sh qoldirsangiz AI faqat ish ma'lumotlaridan foydalanadi."
          rows={3}
        />

        <Button onClick={generate} disabled={generating} className="w-full sm:w-auto">
          <Sparkle weight="fill" /> {generating ? "Tuzilmoqda…" : "Generatsiya qilish"}
        </Button>

        {(draft || generating) && (
          <div className="space-y-2">
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={16} className="font-mono text-xs leading-relaxed" />
            {error && !draft && <p className="text-xs text-danger">AI xatosi yuz berdi. Qayta urinib ko'ring.</p>}
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={copy} disabled={!draft.trim()}>
                <ClipboardText /> {copied ? "Nusxalandi" : "Nusxalash"}
              </Button>
              <Button variant="secondary" size="sm" onClick={sendToApproval} disabled={!draft.trim() || generating || submitting || sent}>
                <PaperPlaneTilt /> {submitting ? "Yuborilmoqda…" : "Tasdiqqa yuborish"}
              </Button>
              {sent && (
                <Badge tone="success">
                  <CheckCircle weight="fill" className="size-3.5" /> Tasdiqlar bo'limiga yuborildi
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
