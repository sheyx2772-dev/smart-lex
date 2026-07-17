"use client";

import { ArrowSquareOut, CheckCircle, CircleNotch, DownloadSimple, PuzzlePiece, ShieldCheck } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { openSiteWindow } from "@/lib/open-window";
import { cn } from "@/lib/utils";

export interface ImportField {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
}

/** Da'vo ma'lumotini brauzer kengaytmasiga uzatadi (o'rnatilgan bo'lsa). */
function postToExtension(payload: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  window.postMessage({ __smartlex: true, type: "claim", payload }, "*");
}

/**
 * Jonli integratsiya oqimi (Sud → cabinet.sud.uz, Ijro → hybrid.pochta.uz):
 *  1) sayt ekran o'rtasida oynada ochiladi;
 *  2) foydalanuvchi u yerda E-IMZO bilan kiradi va tasdiqlaydi;
 *  3) ilova ma'lumotlarni avtomatik to'ldiradi (onImport).
 * `onImport` — rasmiy partner API ulanganda real ma'lumot qaytaradi; aks holda
 * tizimdagi ish asosida to'ldiriladi.
 */
export function EimzoImportFlow({
  url,
  siteName,
  disabled,
  onImport,
  extensionPayload,
}: {
  url: string;
  siteName: string;
  disabled?: boolean;
  onImport: () => Promise<ImportField[]>;
  extensionPayload?: Record<string, unknown>;
}) {
  const t = useTranslations("integration");
  const [opened, setOpened] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState<ImportField[] | null>(null);
  const [extReady, setExtReady] = useState(false);
  const [extSent, setExtSent] = useState(false);

  // Brauzer kengaytmasi o'rnatilganini aniqlaymiz.
  useEffect(() => {
    if (!extensionPayload) return;
    function onMsg(e: MessageEvent) {
      if (e.source === window && (e.data as { __smartlex_ext?: boolean })?.__smartlex_ext) setExtReady(true);
    }
    window.addEventListener("message", onMsg);
    window.postMessage({ __smartlex_ping: true }, "*");
    return () => window.removeEventListener("message", onMsg);
  }, [extensionPayload]);

  function sendToExt() {
    if (!extensionPayload) return;
    postToExtension(extensionPayload);
    setExtSent(true);
    setTimeout(() => setExtSent(false), 2500);
  }

  function open() {
    if (extensionPayload) postToExtension(extensionPayload);
    openSiteWindow(url, siteName);
    setOpened(true);
  }
  async function runImport() {
    setLoading(true);
    try {
      setFields(await onImport());
    } finally {
      setLoading(false);
    }
  }

  const primary =
    "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40";
  const outline =
    "inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-40";

  return (
    <div className="mt-4 rounded-xl border border-border bg-muted/20 p-4">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <ShieldCheck weight="fill" className="size-4 text-primary" /> {t("title")}
      </p>

      <ol className="space-y-3">
        <Step n={1} active={!opened} done={opened} title={t("step1")} desc={t("step1desc")}>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={open} disabled={disabled} className={primary}>
              <ArrowSquareOut weight="fill" className="size-3.5" /> {opened ? t("reopen") : t("openSite")}
            </button>
            {extensionPayload && (
              <button onClick={sendToExt} className={outline}>
                {extSent ? <CheckCircle weight="fill" className="size-3.5 text-success" /> : <PuzzlePiece weight="fill" className="size-3.5" />}
                {extSent ? t("extSent") : t("sendToExt")}
              </button>
            )}
          </div>
          {extensionPayload && (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
              {extReady && <span className="size-1.5 rounded-full bg-success" />}
              {t("extHint")}
            </p>
          )}
        </Step>

        <Step n={2} active={opened && !confirmed} done={confirmed} title={t("step2")} desc={t("step2desc")}>
          {confirmed ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
              <CheckCircle weight="fill" className="size-4" /> {t("confirmed")}
            </span>
          ) : (
            <button onClick={() => setConfirmed(true)} disabled={!opened} className={outline}>
              <CheckCircle className="size-3.5" /> {t("confirm")}
            </button>
          )}
        </Step>

        <Step n={3} active={confirmed && !fields} done={!!fields} title={t("step3")}>
          {confirmed && !fields && (
            <button onClick={runImport} disabled={loading} className={primary}>
              {loading ? <CircleNotch className="size-3.5 animate-spin" /> : <DownloadSimple weight="fill" className="size-3.5" />}
              {loading ? t("importing") : t("step3")}
            </button>
          )}
        </Step>
      </ol>

      {fields && (
        <div className="mt-3 rounded-lg border border-success/30 bg-success-soft p-3">
          <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-success">
            <CheckCircle weight="fill" className="size-4" /> {t("imported")}
          </p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            {fields.map((f, i) => (
              <div key={i}>
                <dt className="text-[11px] text-muted-foreground">{f.label}</dt>
                <dd className={cn("mt-0.5 text-sm font-semibold", f.tone === "warning" && "text-warning", f.tone === "success" && "text-success")}>{f.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 border-t border-success/20 pt-2 text-[11px] text-muted-foreground">{t("note")}</p>
        </div>
      )}
    </div>
  );
}

function Step({
  n,
  active,
  done,
  title,
  desc,
  children,
}: {
  n: number;
  active: boolean;
  done: boolean;
  title: string;
  desc?: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-full border text-[11px] font-bold transition-colors",
          done ? "border-success bg-success text-white" : active ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground",
        )}
      >
        {done ? <CheckCircle weight="fill" className="size-4" /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium", !active && !done && "text-muted-foreground")}>{title}</p>
        {desc && <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>}
        {children && <div className="mt-2">{children}</div>}
      </div>
    </li>
  );
}
