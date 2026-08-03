/**
 * cabinet.sud.uz/check-token sahifasida ishlaydi. Bu — One ID (id.egov.uz)
 * autorizatsiyasidan keyingi OAuth-uslub callback: cabinet.sud.uz'ning o'z SPA'si
 * shu sahifada `POST /api/validate-code` chaqiradi va natijani
 * `sessionStorage['X-AUTH-TOKEN']`ga yozadi (sud-uz-economic-suit skill orqali
 * tasdiqlangan, 2026-08-03). Bu skript o'sha token paydo bo'lishini kutib,
 * uni kengaytmaga (background.js) yuboradi — SmartLex backend keyinchalik shu
 * token bilan cabinet.sud.uz API'sini to'g'ridan-to'g'ri chaqiradi (endi
 * formani DOM orqali "to'ldirish" shart emas).
 */
(() => {
  const KEY = "X-AUTH-TOKEN";
  let tries = 0;
  const MAX_TRIES = 50; // ~15s (300ms oralig'ida)

  function trySend() {
    const token = sessionStorage.getItem(KEY);
    if (token) {
      chrome.runtime.sendMessage({ type: "lex:court-token:set", token, capturedAt: Date.now() });
      return;
    }
    if (++tries < MAX_TRIES) setTimeout(trySend, 300);
  }
  trySend();
})();
