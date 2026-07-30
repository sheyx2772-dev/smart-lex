/** Popup — saqlangan da'vo ma'lumotini ko'rsatadi va tozalash imkonini beradi. */
const content = document.getElementById("content");
const esc = (s) => String(s ?? "—").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

function render(claim) {
  if (!claim) {
    content.innerHTML =
      '<p class="empty">Ma\'lumot yo\'q.</p><ol>' +
      "<li>SmartLex.AI'da Sud/Ijro bo'limini oching</li>" +
      "<li>«Kengaytmaga yuborish»ni bosing</li>" +
      "<li>Davlat saytiga o'ting — panel formani to'ldiradi</li></ol>";
    return;
  }
  const rows = [
    ["Javobgar", claim.debtor],
    ["STIR", claim.tin],
    ["Summa", claim.amount],
    ["Shartnoma", claim.contractNumber],
    ["Sud", claim.court],
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => `<div class="row"><span class="muted">${k}</span><b>${esc(v)}</b></div>`)
    .join("");
  content.innerHTML = `${rows}<p class="muted" style="margin-top:8px">Davlat saytida panel orqali to'ldiring. E-IMZO'ni o'zingiz tasdiqlaysiz.</p>`;
}

chrome.runtime.sendMessage({ type: "lex:get" }, (r) => render(r && r.claim));

document.getElementById("clear").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "lex:clear" }, () => render(null));
});

// Sinash uchun namuna ma'lumot — SmartLex'dan yubormasdan formani sinash.
document.getElementById("testdata").addEventListener("click", () => {
  const sample = {
    debtor: "GLOBAL SNAB MCHJ",
    tin: "305111222",
    amount: "5 112 500,00 UZS",
    amountNumber: "5112500",
    court: "Toshkent shahar iqtisodiy sudi",
    contractNumber: "SH-2026-001",
    body: "Namuna da'vo arizasi matni.",
  };
  chrome.runtime.sendMessage({ type: "lex:store", payload: sample }, () => render(sample));
});

// "Avtomatik to'ldirish" sozlamasi
const auto = document.getElementById("autofill");
chrome.storage.local.get("autofill", (r) => {
  auto.checked = !!r.autofill;
});
auto.addEventListener("change", () => chrome.storage.local.set({ autofill: auto.checked }));
