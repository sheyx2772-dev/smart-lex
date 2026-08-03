"use client";

import { CheckCircle, CircleNotch, Gavel, PlugsConnected, Warning } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { connectCourtToken, getCourtEntities, getCourtTokenStatus, prepareCourtFiling, submitCourtFiling, type SudEntity } from "@/app/(app)/court/actions";
import { openSitePopup } from "@/lib/open-window";

type Stage = "connect" | "connecting" | "entities" | "prepare" | "ready" | "confirm" | "filing" | "done";

/**
 * cabinet.sud.uz REAL API orqali topshirish — Playwright/DOM-to'ldirish EMAS.
 * Foydalanuvchi faqat bitta jonli qadam bajaradi: One ID bilan cabinet.sud.uz'da
 * kirish (alohida haqiqiy oynada — iframe EMAS, chunki kengaytma content-script'i
 * faqat top-level sahifada ishlaydi). Undan keyingi hamma narsa (entity, javobgar,
 * PDF, hisob-faktura, save-suit) serverda, bizning backend orqali bajariladi.
 */
export function SudFilingFlow({ id, defendantTin }: { id: string; defendantTin: string | null }) {
  const t = useTranslations("court.sudFiling");
  const [stage, setStage] = useState<Stage>("connect");
  const [error, setError] = useState<string | null>(null);
  const [entities, setEntities] = useState<SudEntity[]>([]);
  const [entityId, setEntityId] = useState<string>("");
  const [summary, setSummary] = useState<{ defendantName: string; defendantTin: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);

  useEffect(() => {
    getCourtTokenStatus().then((s) => {
      if (s.connected) loadEntities();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function askExtensionForToken(): Promise<string | null> {
    return new Promise((resolve) => {
      function onMsg(e: MessageEvent) {
        const d = e.data as { __smartlex_court_token?: boolean; token?: string | null };
        if (e.source !== window || !d || d.__smartlex_court_token !== true) return;
        window.removeEventListener("message", onMsg);
        resolve(d.token ?? null);
      }
      window.addEventListener("message", onMsg);
      window.postMessage({ __smartlex_get_court_token: true }, "*");
      setTimeout(() => {
        window.removeEventListener("message", onMsg);
        resolve(null);
      }, 2000);
    });
  }

  async function connect() {
    setError(null);
    setStage("connecting");
    openSitePopup("https://cabinet.sud.uz/sign-in", "sud");

    const deadline = Date.now() + 3 * 60_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2500));
      const token = await askExtensionForToken();
      if (token) {
        const res = await connectCourtToken(token);
        if (res.success) {
          await loadEntities();
          return;
        }
      }
    }
    setError(t("extMissing"));
    setStage("connect");
  }

  async function loadEntities() {
    const res = await getCourtEntities(id);
    if (!res.available || !res.entities) {
      setError(res.reason === "not_connected" ? t("notConnected") : `${t("sudError")}: ${res.detail ?? res.reason ?? ""}`);
      setStage("connect");
      return;
    }
    setEntities(res.entities);
    setEntityId(res.entities[0]?.entity_id ?? "");
    setStage("entities");
  }

  async function prepare() {
    if (!entityId) return;
    setError(null);
    setStage("prepare");
    const res = await prepareCourtFiling(id, entityId);
    if (!res.available || !res.summary) {
      setError(
        res.reason === "not_approved"
          ? t("notApprovedFile")
          : res.reason === "soliq_not_configured"
            ? t("soliqNotConfigured")
            : `${t("sudError")}: ${res.detail ?? res.reason ?? ""}`,
      );
      setStage("entities");
      return;
    }
    setSummary(res.summary);
    setStage("ready");
  }

  async function submit() {
    setError(null);
    setStage("filing");
    const res = await submitCourtFiling(id);
    if (!res.available || !res.caseId) {
      setError(`${t("sudError")}: ${res.detail ?? res.reason ?? ""}`);
      setStage("ready");
      return;
    }
    setCaseId(res.caseId);
    setStage("done");
  }

  return (
    <div className="mt-4 rounded-xl border border-border bg-muted/20 p-4">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Gavel weight="fill" className="size-4 text-primary" /> cabinet.sud.uz — E-SUD API
      </p>

      {error && (
        <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">
          <Warning weight="fill" className="size-3.5 shrink-0" /> {error}
        </div>
      )}

      {(stage === "connect" || stage === "connecting") && (
        <button
          onClick={connect}
          disabled={stage === "connecting"}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {stage === "connecting" ? <CircleNotch className="size-4 animate-spin" /> : <PlugsConnected weight="fill" className="size-4" />}
          {stage === "connecting" ? t("connecting") : t("connect")}
        </button>
      )}

      {stage === "entities" && (
        <div className="space-y-2.5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-success">
            <CheckCircle weight="fill" className="size-4" /> {t("connected")}
          </p>
          {entities.length > 1 && (
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{t("chooseEntity")}</label>
              <select
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                {entities.map((e) => (
                  <option key={e.entity_id} value={e.entity_id}>
                    {e.name} {e.tin ? `(${e.tin})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={prepare}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Gavel weight="fill" className="size-4" /> {t("prepare")}
          </button>
        </div>
      )}

      {stage === "prepare" && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CircleNotch className="size-4 animate-spin" /> {t("preparing")}
        </p>
      )}

      {(stage === "ready" || stage === "filing") && summary && (
        <div className="space-y-3">
          <div className="rounded-lg border border-success/30 bg-success-soft p-3 text-sm">
            <p className="mb-1.5 font-semibold text-success">{t("summaryTitle")}</p>
            <p>
              {t("summaryDefendant")}: {summary.defendantName} ({summary.defendantTin || defendantTin})
            </p>
          </div>
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5" />
            {t("fileConfirm")}
          </label>
          <button
            onClick={submit}
            disabled={!confirmed || stage === "filing"}
            className="inline-flex items-center gap-1.5 rounded-lg bg-danger px-3.5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {stage === "filing" ? <CircleNotch className="size-4 animate-spin" /> : <Gavel weight="fill" className="size-4" />}
            {stage === "filing" ? t("filing") : t("fileNow")}
          </button>
        </div>
      )}

      {stage === "done" && caseId && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-success">
          <CheckCircle weight="fill" className="size-4" /> {t("filedCase")}: {caseId}
        </p>
      )}
    </div>
  );
}
