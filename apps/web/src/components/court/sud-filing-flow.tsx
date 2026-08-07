"use client";

import { ArrowSquareOut, CheckCircle, CircleNotch, Gavel, Info, PlugsConnected, SignIn, Warning } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { connectCourtToken, getCourtEntities, getCourtTokenStatus, prepareCourtFiling, submitCourtFiling, type SudEntity } from "@/app/(app)/court/actions";

type Stage = "checking" | "connect" | "entities" | "prepare" | "ready" | "confirm" | "filing" | "done";

const TOKEN_HASH_KEY = "sudtoken=";

/**
 * Bookmarklet kodi — cabinet.sud.uz'da bosilganda sessionStorage'dan tokenni o'qib,
 * bizning domenimizga # (fragment) orqali qaytaradi (serverga hech qachon
 * yuborilmaydi/log'lanmaydi).
 *
 * `location.origin === bizning domen` tekshiruvi — haqiqiy "xatchoʻplangan
 * yoki yo'q" holatini brauzer JS'ga ochiq qilmaydi (shu sababli bunday API
 * umuman yo'q), lekin agar skript hali ham BIZNING sahifamizda ishlab
 * turgan bo'lsa, bu deyarli har doim "hali xatchoʻqqa qo'shilmagan, havola
 * to'g'ridan-to'g'ri bosilgan" degani — chunki to'g'ri oqimda foydalanuvchi
 * avval cabinet.sud.uz'ga o'tishi kerak edi.
 */
function bookmarkletHref(origin: string): string {
  const notBookmarked =
    "Avval markur tugmani «Закладки» paneliga qo'shing, so'ng One ID bilan Cabinet.sud.uz ga kiring va ochilgan oynada qaytadan shu tugmani bosing";
  const notLoggedIn = "Avval One ID bilan Cabinet.sud.uz ga kiring va ochilgan oynada qaytadan shu tugmani bosing";
  const js =
    `(function(){` +
    `if(location.origin===${JSON.stringify(origin)}){alert(${JSON.stringify(notBookmarked)});return;}` +
    `var t=sessionStorage.getItem(${JSON.stringify("X-AUTH-TOKEN")});` +
    `if(!t){alert(${JSON.stringify(notLoggedIn)});return;}` +
    `location.href=${JSON.stringify(origin)}+${JSON.stringify(`/court#${TOKEN_HASH_KEY}`)}+encodeURIComponent(t);` +
    `})();`;
  return `javascript:${js}`;
}

/**
 * Backend'dan kelgan xom xatoni (HTTP status/HTML/JSON aralashmasi — cabinet.sud.uz'ning
 * o'z javobi) oddiy foydalanuvchiga tushunarli xabarga aylantiradi. Texnik tafsilot
 * konsolga yoziladi (debugging uchun), ekranга chiqmaydi.
 */
function friendlyCourtError(t: ReturnType<typeof useTranslations>, detail?: string, reason?: string): string {
  if (detail) console.error("[SudFilingFlow] cabinet.sud.uz error detail:", detail);
  const status = detail?.match(/HTTP (\d{3})/)?.[1];
  if (status === "502" || status === "503" || status === "504") return t("sudErrorGateway");
  if (status === "401") return t("sudErrorAuth");
  if (reason === "not_connected") return t("notConnected");
  return t("sudErrorRetry");
}

/**
 * cabinet.sud.uz REAL API orqali topshirish — Playwright/DOM-to'ldirish EMAS.
 * Token — bookmarklet orqali olinadi (kengaytmasiz, kengaytmasiz VA serverда
 * boshqariladigan brauzersiz — shu ikkalasi ham E-IMZO'ga (mahalliy 127.0.0.1
 * demoni) yeta olmasligi sababli rad etildi). Foydalanuvchi cabinet.sud.uz'da
 * O'ZINING haqiqiy brauzerida, O'ZI xohlagan usul bilan (parol/Mobile-ID/ERI)
 * kiradi — E-IMZO shu sababli to'liq ishlaydi. Bookmarklet faqat sessionStorage'dan
 * o'qib, tokenni URL FRAGMENT orqali (# — serverga yuborilmaydi/log'lanmaydi)
 * bizning saytimizga qaytaradi. Undan keyingi hamma narsa (entity, javobgar,
 * PDF, hisob-faktura, save-suit) serverda bajariladi.
 */
export function SudFilingFlow({ id, defendantTin }: { id: string; defendantTin: string | null }) {
  const t = useTranslations("court.sudFiling");
  const [stage, setStage] = useState<Stage>("checking");
  const [error, setError] = useState<string | null>(null);
  const [entities, setEntities] = useState<SudEntity[]>([]);
  const [entityId, setEntityId] = useState<string>("");
  const [summary, setSummary] = useState<{ defendantName: string; defendantTin: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  const bookmarkletRef = useRef<HTMLAnchorElement>(null);

  // React JSX `href` React'ning javascript: URL xavfsizlik filtridan o'tolmaydi
  // ("React has blocked a javascript: URL as a security precaution") — shuning
  // uchun DOM'ga to'g'ridan-to'g'ri (ref orqali) qo'yiladi.
  useEffect(() => {
    if (bookmarkletRef.current) bookmarkletRef.current.setAttribute("href", bookmarkletHref(window.location.origin));
  }, [stage]);

  // Bookmarklet cabinet.sud.uz'dan qaytganda #sudtoken=... bilan shu sahifaga tushadi.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith(`#${TOKEN_HASH_KEY}`)) {
      const token = decodeURIComponent(hash.slice(1 + TOKEN_HASH_KEY.length));
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      connectCourtToken(token).then((res) => {
        if (res.success) void loadEntities();
        else {
          setError(t("sudErrorRetry"));
          setStage("connect");
        }
      });
      return;
    }
    getCourtTokenStatus().then((s) => {
      if (s.connected) void loadEntities();
      else setStage("connect");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadEntities() {
    const res = await getCourtEntities(id);
    if (!res.available || !res.entities) {
      setError(friendlyCourtError(t, res.detail, res.reason));
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
            : friendlyCourtError(t, res.detail, res.reason),
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
      setError(friendlyCourtError(t, res.detail, res.reason));
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

      {stage === "checking" && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CircleNotch className="size-4 animate-spin" /> {t("checkingConnection")}
        </p>
      )}

      {stage === "connect" && (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold">{t("connectTitle")}</p>
            <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info weight="fill" className="mt-0.5 size-3.5 shrink-0 text-primary" />
              {t("connectOnce")}
            </p>
          </div>

          <div className="space-y-2">
            {/* 1-qadam */}
            <div className="rounded-lg border border-primary/25 bg-primary/[0.04] p-3">
              <p className="mb-2 text-xs font-medium text-foreground">{t("bookmarkletDrag")}</p>
              <a
                ref={bookmarkletRef}
                draggable
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary shadow-sm"
              >
                <PlugsConnected weight="fill" className="size-4" /> {t("bookmarkletName")}
              </a>
            </div>

            {/* 2-qadam */}
            <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                <SignIn weight="fill" className="size-4" />
              </span>
              <div className="min-w-0 flex-1 text-xs">
                <p className="font-medium text-foreground">{t("step2Title")}</p>
                <a
                  href="https://cabinet.sud.uz/sign-in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 inline-flex items-center gap-1 text-primary underline underline-offset-2"
                >
                  {t("openSudSite")} <ArrowSquareOut className="size-3" />
                </a>
              </div>
            </div>

            {/* 3-qadam */}
            <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                <PlugsConnected weight="fill" className="size-4" />
              </span>
              <p className="text-xs font-medium text-foreground">{t("step3Title")}</p>
            </div>
          </div>
        </div>
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
