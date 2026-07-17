/**
 * Davlat sayti (cabinet.sud.uz / hybrid.pochta.uz / xarid.uzex.uz) sahifasida
 * ishlaydi. Suzuvchi panel chiqaradi va SmartLex'dan kelgan ma'lumotni formaga
 * heuristik (maydon nomi/label/placeholder bo'yicha) to'ldiradi.
 * E-IMZO imzoni foydalanuvchi o'zi bosadi — kengaytma imzolamaydi.
 */
(() => {
  if (window.__lexPanelMounted) return;
  window.__lexPanelMounted = true;

  const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

  const panel = document.createElement("div");
  panel.className = "lexext-panel";
  panel.innerHTML = `
    <div class="lexext-head">
      <span class="lexext-logo">◆</span> SmartLex.AI
      <button class="lexext-x" title="Yopish">×</button>
    </div>
    <div class="lexext-body">Yuklanmoqda…</div>
    <button class="lexext-fill" disabled>Formani to'ldirish</button>
    <div class="lexext-note"></div>`;
  document.documentElement.appendChild(panel);

  const body = panel.querySelector(".lexext-body");
  const btn = panel.querySelector(".lexext-fill");
  const note = panel.querySelector(".lexext-note");
  panel.querySelector(".lexext-x").onclick = () => panel.remove();

  chrome.runtime.sendMessage({ type: "lex:get" }, (r) => {
    const claim = r && r.claim;
    if (!claim) {
      body.innerHTML = "SmartLex'da ma'lumot yo'q.<br>Platformada <b>«Kengaytmaga yuborish»</b>ni bosing.";
      return;
    }
    body.innerHTML = `<b>${esc(claim.debtor)}</b><br>STIR: ${esc(claim.tin)}<br>Summa: ${esc(claim.amount)}`;
    btn.disabled = false;
    btn.onclick = () => {
      const n = fillForm(claim);
      note.textContent = n > 0 ? `${n} ta maydon to'ldirildi. E-IMZO'ni o'zingiz tasdiqlang.` : "Mos maydon topilmadi — qo'lda kiriting.";
    };
  });

  const FIELD_MAP = [
    { keys: ["stir", "инн", "tin", "inn"], get: (c) => c.tin },
    { keys: ["nomi", "название", "наименование", "name", "tashkilot", "компания", "org", "debtor", "javobgar", "ответчик"], get: (c) => c.debtor },
    { keys: ["summa", "сумма", "amount", "narx", "цена", "qiymat", "стоимость"], get: (c) => c.amountNumber || c.amount },
    { keys: ["shartnoma", "договор", "contract"], get: (c) => c.contractNumber },
    { keys: ["faktura", "счет", "счёт", "invoice"], get: (c) => c.invoiceNumber },
    { keys: ["sud", "суд", "court"], get: (c) => c.court },
  ];

  function fillForm(claim) {
    let count = 0;
    const fields = Array.from(document.querySelectorAll("input, textarea"));
    for (const f of fields) {
      const type = (f.getAttribute("type") || "text").toLowerCase();
      if (["hidden", "password", "file", "checkbox", "radio", "submit", "button"].includes(type)) continue;
      if (f.disabled || f.readOnly || f.value) continue;
      const hay = `${f.name} ${f.id} ${f.placeholder || ""} ${labelText(f)}`.toLowerCase();
      for (const m of FIELD_MAP) {
        const val = m.get(claim);
        if (val && m.keys.some((k) => hay.includes(k))) {
          setValue(f, val);
          count++;
          break;
        }
      }
    }
    return count;
  }

  function labelText(el) {
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (l) return l.textContent || "";
    }
    const wrap = el.closest("label");
    return wrap ? wrap.textContent || "" : "";
  }

  // React/Vue kabi controlled input'lar uchun native setter + input/change hodisasi.
  function setValue(el, value) {
    const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, String(value));
    else el.value = String(value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.style.outline = "2px solid #22c55e";
    el.style.transition = "outline .3s ease";
    setTimeout(() => (el.style.outline = ""), 2500);
  }
})();
