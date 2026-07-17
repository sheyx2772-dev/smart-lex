/**
 * Tashqi saytni (sud.uz, didox.uz, pochta...) EKRAN O'RTASIDA alohida oynada
 * ochadi — boshqa tabga o'tmasdan. Foydalanuvchi u yerda E-IMZO bilan kiradi.
 */
export function openSiteWindow(url: string, name: string): Window | null {
  if (typeof window === "undefined") return null;
  const sw = window.screen.availWidth;
  const sh = window.screen.availHeight;
  const w = Math.min(1200, Math.max(720, sw - 120));
  const h = Math.min(860, Math.max(560, sh - 120));
  const left = Math.max(0, Math.round((sw - w) / 2));
  const top = Math.max(0, Math.round((sh - h) / 2));
  return window.open(url, name, `popup=yes,width=${w},height=${h},left=${left},top=${top}`);
}
