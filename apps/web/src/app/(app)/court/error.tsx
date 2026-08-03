"use client";

import { ArrowClockwise, Warning } from "@phosphor-icons/react";
import { useEffect } from "react";

/**
 * Sud bo'limi uchun xato chegarasi (error boundary). Client-side exception
 * yuz berganda butun sahifa "Application error" bilan yiqilib qolmasin —
 * tushunarli xabar + qayta urinish, hamda ASOSIY sabab ekranда ko'rinsin.
 */
export default function CourtError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[court:error]", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center justify-center gap-4 py-24 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-danger-soft text-danger">
        <Warning weight="fill" className="size-7" />
      </span>
      <div>
        <h2 className="font-display text-lg font-semibold">Sud bo'limini yuklashda xatolik</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sahifani qayta yuklab ko'ring. Muammo davom etsa, quyidagi texnik ma'lumotni bizga yuboring.
        </p>
      </div>
      <button
        onClick={reset}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        <ArrowClockwise className="size-4" /> Qayta urinish
      </button>
      <pre className="mt-2 max-h-40 w-full overflow-auto rounded-lg border border-border bg-muted px-3 py-2 text-left text-[11px] text-muted-foreground">
        {error?.message || "Noma'lum xato"}
        {error?.digest ? `\n\ndigest: ${error.digest}` : ""}
      </pre>
    </div>
  );
}
