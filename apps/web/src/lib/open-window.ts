/**
 * Tashqi sayt integratsiyasi (sud.uz, didox.uz, pochta...).
 *
 * `openSiteWindow` — ilova ICHIDA, ekran O'RTASIDA "oyna" modalini ochadi
 * (SiteWindowHost tinglaydi). Bu in-app brauzerda ham, popup-bloklangan
 * brauzerlarda ham ishonchli ishlaydi.
 *
 * `openSitePopup` — haqiqiy alohida brauzer oynasi (E-IMZO bilan kirish uchun).
 */
export interface OpenSiteDetail {
  url: string;
  title: string;
}

export const OPEN_SITE_EVENT = "lex:open-site";

export function openSiteWindow(url: string, name: string): void {
  if (typeof window === "undefined") return;
  // Avval haqiqiy markaziy brauzer oynasi — sayt to'liq yuklanadi va u yerda
  // E-IMZO bilan kirish mumkin (didox/sud/pochta iframe'da bloklaydi).
  const win = openSitePopup(url, name);
  if (win) {
    win.focus?.();
    return;
  }
  // Popup bloklangan bo'lsa — ilova ichidagi oyna fallback sifatida ochiladi.
  window.dispatchEvent(new CustomEvent<OpenSiteDetail>(OPEN_SITE_EVENT, { detail: { url, title: name } }));
}

export function openSitePopup(url: string, name: string): Window | null {
  if (typeof window === "undefined") return null;
  const sw = window.screen.availWidth;
  const sh = window.screen.availHeight;
  const w = Math.min(1200, Math.max(720, sw - 120));
  const h = Math.min(860, Math.max(560, sh - 120));
  const left = Math.max(0, Math.round((sw - w) / 2));
  const top = Math.max(0, Math.round((sh - h) / 2));
  return window.open(url, name, `popup=yes,width=${w},height=${h},left=${left},top=${top}`);
}
