/**
 * Service worker — content-scriptlar o'rtasidagi ko'prik.
 * SmartLex sahifasi (relay.js) da'vo ma'lumotini yuboradi → shu yerda saqlanadi;
 * davlat sayti (fill.js) uni o'qib formani to'ldiradi.
 */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "lex:store") {
    chrome.storage.local.set({ claim: msg.payload, storedAt: Date.now() }, () => {
      // Badge — ma'lumot tayyorligini bildiradi
      chrome.action.setBadgeText({ text: "1" });
      chrome.action.setBadgeBackgroundColor({ color: "#4f46e5" });
      sendResponse({ ok: true });
    });
    return true;
  }
  if (msg && msg.type === "lex:get") {
    chrome.storage.local.get(["claim", "storedAt"], (r) => sendResponse(r));
    return true;
  }
  if (msg && msg.type === "lex:clear") {
    chrome.storage.local.remove(["claim", "storedAt"], () => {
      chrome.action.setBadgeText({ text: "" });
      sendResponse({ ok: true });
    });
    return true;
  }
  // cabinet.sud.uz'dan olingan X-AUTH-TOKEN — capture-token.js yozadi,
  // relay.js (SmartLex sahifasida) o'qib backendga yuboradi.
  if (msg && msg.type === "lex:court-token:set") {
    chrome.storage.local.set({ courtToken: msg.token, courtTokenAt: msg.capturedAt }, () => {
      chrome.action.setBadgeText({ text: "✓" });
      chrome.action.setBadgeBackgroundColor({ color: "#16a34a" });
      sendResponse({ ok: true });
    });
    return true;
  }
  if (msg && msg.type === "lex:court-token:get") {
    chrome.storage.local.get(["courtToken", "courtTokenAt"], (r) => sendResponse(r));
    return true;
  }
  if (msg && msg.type === "lex:court-token:clear") {
    chrome.storage.local.remove(["courtToken", "courtTokenAt"], () => sendResponse({ ok: true }));
    return true;
  }
  return false;
});
