"use client";

/**
 * To'lov tizimlari brend belgilari — inline SVG (tashqi rasm/CDN shart emas).
 * Oq belgi + wordmark; brend rangli fon ustida ishlatiladi.
 */

export function ClickLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 40 40" className="size-7 shrink-0" aria-hidden>
        <rect width="40" height="40" rx="11" fill="#ffffff" fillOpacity="0.22" />
        <path
          d="M20.6 9.2c-6.3 0-11.4 5.1-11.4 11.4S14.3 32 20.6 32c3.3 0 6.25-1.4 8.32-3.62l-3.65-3.36A6.44 6.44 0 0 1 20.6 27a6.4 6.4 0 1 1 4.67-10.94l3.65-3.36A11.36 11.36 0 0 0 20.6 9.2Z"
          fill="#fff"
        />
      </svg>
      <span className="text-lg font-extrabold tracking-tight">Click</span>
    </span>
  );
}

export function PaymeLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 40 40" className="size-7 shrink-0" aria-hidden>
        <rect width="40" height="40" rx="11" fill="#ffffff" fillOpacity="0.22" />
        <path d="M13 9.6h9.5a7.6 7.6 0 0 1 0 15.2H18.1V31H13V9.6Zm5.1 5.1v5h4.3a2.5 2.5 0 0 0 0-5h-4.3Z" fill="#fff" />
      </svg>
      <span className="text-lg font-extrabold tracking-tight">Payme</span>
    </span>
  );
}

/** Kichik brend-kartochka — "qabul qilamiz" qatori uchun (ishonch banneri). */
export function CardScheme({ name }: { name: "UzCard" | "Humo" | "Visa" | "Mastercard" }) {
  const styles: Record<string, { bg: string; fg: string }> = {
    UzCard: { bg: "linear-gradient(135deg,#1e3a8a,#2563eb)", fg: "#fff" },
    Humo: { bg: "linear-gradient(135deg,#0e7490,#06b6d4)", fg: "#fff" },
    Visa: { bg: "#1a1f71", fg: "#fff" },
    Mastercard: { bg: "#f7f7f7", fg: "#1a1a1a" },
  };
  const s = styles[name];
  return (
    <span
      className="inline-flex h-8 items-center rounded-md px-2.5 text-xs font-bold shadow-sm"
      style={{ background: s.bg, color: s.fg }}
    >
      {name === "Mastercard" ? (
        <span className="inline-flex items-center gap-1">
          <span className="relative inline-flex">
            <span className="size-3.5 rounded-full" style={{ background: "#eb001b" }} />
            <span className="-ml-2 size-3.5 rounded-full" style={{ background: "#f79e1b", mixBlendMode: "multiply" }} />
          </span>
          <span className="ml-0.5">mastercard</span>
        </span>
      ) : name === "Visa" ? (
        <span className="italic tracking-tight">VISA</span>
      ) : (
        name
      )}
    </span>
  );
}
