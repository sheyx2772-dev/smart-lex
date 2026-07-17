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
