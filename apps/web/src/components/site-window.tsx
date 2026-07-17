"use client";

import { ArrowClockwise, ArrowSquareOut, GlobeSimple, Warning, X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { OPEN_SITE_EVENT, type OpenSiteDetail, openSitePopup } from "@/lib/open-window";

/**
 * Tashqi sayt integratsiyasini ilova ichida, ekran o'rtasida "oyna" ko'rinishida
 * ochadi. `openSiteWindow(url, name)` chaqirilganda paydo bo'ladi. Davlat
 * saytlari oyna ichida bloklansa — "Alohida oynada" tugmasi orqali haqiqiy
 * brauzer oynasi ochiladi (E-IMZO bilan kirish uchun).
 */
export function SiteWindowHost() {
  const [site, setSite] = useState<OpenSiteDetail | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    function onOpen(e: Event) {
      const detail = (e as CustomEvent<OpenSiteDetail>).detail;
      if (detail?.url) {
        setSite(detail);
        setReloadKey((k) => k + 1);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSite(null);
    }
    window.addEventListener(OPEN_SITE_EVENT, onOpen as EventListener);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_SITE_EVENT, onOpen as EventListener);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (!site) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [site]);

  if (!site) return null;

  let host = site.url;
  try {
    host = new URL(site.url).host;
  } catch {
    /* xom url */
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-3 backdrop-blur-sm sm:p-6" onClick={() => setSite(null)}>
      <div
        className="flex h-[min(88vh,900px)] w-[min(1240px,96vw)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Oyna sarlavhasi (brauzer chrome) */}
        <div className="flex items-center gap-2.5 border-b border-border bg-muted/40 px-3 py-2.5">
          <div className="hidden gap-1.5 sm:flex">
            <span className="size-3 rounded-full bg-red-400" />
            <span className="size-3 rounded-full bg-amber-400" />
            <span className="size-3 rounded-full bg-emerald-400" />
          </div>
          <div className="mx-1 flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
            <GlobeSimple className="size-3.5 shrink-0" />
            <span className="truncate">{site.url}</span>
          </div>
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            title="Yangilash"
            className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowClockwise className="size-4" />
          </button>
          <button
            onClick={() => openSitePopup(site.url, host)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary"
          >
            <ArrowSquareOut className="size-3.5" /> <span className="hidden sm:inline">Alohida oynada</span>
          </button>
          <button
            onClick={() => setSite(null)}
            title="Yopish"
            className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Ogohlantirish — davlat saytlari oyna ichida bloklanishi mumkin */}
        <div className="flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-center text-[11px] text-amber-700">
          <Warning weight="fill" className="size-3.5 shrink-0" />
          <span>
            Sayt oyna ichida ochilmasa, E-IMZO bilan kirish uchun{" "}
            <button onClick={() => openSitePopup(site.url, host)} className="font-semibold underline underline-offset-2 hover:text-amber-900">
              alohida oynada oching
            </button>
            .
          </span>
        </div>

        {/* Saytning o'zi */}
        <iframe
          key={reloadKey}
          src={site.url}
          title={site.title}
          className="min-h-0 flex-1 bg-white"
          referrerPolicy="no-referrer-when-downgrade"
          allow="clipboard-read; clipboard-write"
        />
      </div>
    </div>
  );
}
