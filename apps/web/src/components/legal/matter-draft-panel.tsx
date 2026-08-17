"use client";

import { CheckCircle, ClipboardText, FileDoc, FilePdf, PaperPlaneTilt, Sparkle } from "@phosphor-icons/react";
import { useState } from "react";
import { submitMatterDraft } from "@/app/(app)/legal/matters/[id]/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function inlineMd(s: string): string {
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

/** AI generatsiya qilgan MARKDOWN'ni (#, ##, -, |...|) eksport uchun toza HTML'ga aylantiradi. */
function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let i = 0;
  let listOpen = false;
  const closeList = () => {
    if (listOpen) {
      out.push("</ul>");
      listOpen = false;
    }
  };
  while (i < lines.length) {
    const line = (lines[i] ?? "").trimEnd();
    if (/^\|.*\|$/.test(line.trim())) {
      closeList();
      const rows: string[][] = [];
      while (i < lines.length && /^\|.*\|$/.test((lines[i] ?? "").trim())) {
        const cells = lines[i]!.trim().slice(1, -1).split("|").map((c) => c.trim());
        if (!cells.every((c) => /^:?-+:?$/.test(c))) rows.push(cells);
        i++;
      }
      out.push("<table style='border-collapse:collapse;width:100%'>");
      rows.forEach((r, idx) => {
        out.push(`<tr>${r.map((c) => `<t${idx === 0 ? "h" : "d"} style="border:1px solid #999;padding:4px 8px">${inlineMd(c)}</t${idx === 0 ? "h" : "d"}>`).join("")}</tr>`);
      });
      out.push("</table>");
      continue;
    }
    if (/^##\s+/.test(line)) {
      closeList();
      out.push(`<h3>${inlineMd(line.replace(/^##\s+/, ""))}</h3>`);
    } else if (/^#\s+/.test(line)) {
      closeList();
      out.push(`<h2 style="text-align:center">${inlineMd(line.replace(/^#\s+/, ""))}</h2>`);
    } else if (/^[-*]\s+/.test(line)) {
      if (!listOpen) {
        out.push("<ul>");
        listOpen = true;
      }
      out.push(`<li>${inlineMd(line.replace(/^[-*]\s+/, ""))}</li>`);
    } else if (!line.trim()) {
      closeList();
      out.push("<p></p>");
    } else {
      closeList();
      out.push(`<p>${inlineMd(line)}</p>`);
    }
    i++;
  }
  closeList();
  return out.join("");
}

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

  function docName() {
    return (matter.title || "hujjat").replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 60);
  }
  function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  function exportWord() {
    const name = docName();
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${escapeHtml(name)}</title></head><body style="font-family:'Times New Roman',serif;font-size:14px">${markdownToHtml(draft)}</body></html>`;
    saveBlob(new Blob(["﻿", html], { type: "application/msword" }), `${name}.doc`);
  }
  function exportPdf() {
    const name = docName();
    const win = window.open("", "_blank", "width=820,height=1040");
    if (!win) return;
    win.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(name)}</title><style>@page{margin:2cm}body{font-family:'Times New Roman',Georgia,serif;font-size:14px;line-height:1.65;color:#111;max-width:720px;margin:0 auto;padding:1cm}h2{font-size:18px}h3{font-size:15px}p{margin:.5em 0}</style></head><body>${markdownToHtml(draft)}</body></html>`,
    );
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 350);
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
              <Button variant="outline" size="sm" onClick={exportWord} disabled={!draft.trim()}>
                <FileDoc /> Word
              </Button>
              <Button variant="outline" size="sm" onClick={exportPdf} disabled={!draft.trim()}>
                <FilePdf /> PDF
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
