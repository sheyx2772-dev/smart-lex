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
    const run = () => {
      const n = fillForm(claim);
      note.textContent = n > 0 ? `${n} ta maydon to'ldirildi. E-IMZO'ni o'zingiz tasdiqlang.` : "Mos maydon topilmadi — qo'lda kiriting.";
    };
    btn.onclick = run;

    // "Avtomatik to'ldirish" yoqilgan bo'lsa — panel ochilishida darhol.
    chrome.storage.local.get("autofill", (s) => {
      if (s && s.autofill) run();
    });
  });

  // Umumiy heuristika — profil topilmaganда yoki qoldiq maydonlar uchun.
  const FIELD_MAP = [
    { keys: ["stir", "инн", "tin", "inn"], get: (c) => c.tin },
    { keys: ["nomi", "название", "наименование", "name", "tashkilot", "компания", "org", "debtor", "javobgar", "ответчик"], get: (c) => c.debtor },
    { keys: ["summa", "сумма", "amount", "narx", "цена", "qiymat", "стоимость"], get: (c) => c.amountNumber || c.amount },
    { keys: ["shartnoma", "договор", "contract"], get: (c) => c.contractNumber },
    { keys: ["faktura", "счет", "счёт", "invoice"], get: (c) => c.invoiceNumber },
    { keys: ["sud", "суд", "court"], get: (c) => c.court },
    { keys: ["manzil", "адрес", "address"], get: (c) => c.address },
  ];

  function pickProfile() {
    const host = location.hostname;
    const profiles = self.LEX_PROFILES || {};
    const key = Object.keys(profiles).find((k) => host === k || host.endsWith(`.${k}`) || host.endsWith(k));
    return key ? profiles[key] : null;
  }

  function fillForm(claim) {
    let count = 0;
    const used = new Set();

    // 1) Sayt profili — aniq selektorlar (ustuvor)
    const profile = pickProfile();
    if (profile) {
      for (const rule of profile) {
        const val = rule.get(claim);
        if (!val) continue;
        for (const sel of rule.selectors || []) {
          let el = null;
          try {
            el = document.querySelector(sel);
          } catch {
            el = null;
          }
          if (el && !used.has(el) && isFillable(el) && isEmpty(el)) {
            if (setAny(el, val)) {
              used.add(el);
              count++;
            }
            break;
          }
        }
      }
    }

    // 2) Umumiy heuristika — profil to'ldirmagan maydonlar
    for (const f of document.querySelectorAll("input, textarea, select")) {
      if (used.has(f) || !isFillable(f) || !isEmpty(f)) continue;
      const hay = `${f.name} ${f.id} ${f.getAttribute("formcontrolname") || ""} ${f.placeholder || ""} ${labelText(f)}`.toLowerCase();
      for (const m of FIELD_MAP) {
        const val = m.get(claim);
        if (val && m.keys.some((k) => hay.includes(k))) {
          if (setAny(f, val)) {
            used.add(f);
            count++;
          }
          break;
        }
      }
    }
    return count;
  }

  function isFillable(el) {
    if (el.tagName === "SELECT") return !el.disabled;
    const type = (el.getAttribute("type") || "text").toLowerCase();
    if (["hidden", "password", "file", "checkbox", "radio", "submit", "button", "image", "reset"].includes(type)) return false;
    return !el.disabled && !el.readOnly;
  }
  function isEmpty(el) {
    return el.tagName === "SELECT" ? !el.value || el.selectedIndex <= 0 : !el.value;
  }

  // Yorliq matnini bir necha manbadan yig'adi — Angular Material (mat-label),
  // aria-label/labelledby va oddiy <label> ni ham qamrab oladi.
  function labelText(el) {
    const parts = [];
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (l) parts.push(l.textContent || "");
    }
    const wrap = el.closest("label");
    if (wrap) parts.push(wrap.textContent || "");
    const aria = el.getAttribute("aria-label");
    if (aria) parts.push(aria);
    const alby = el.getAttribute("aria-labelledby");
    if (alby) for (const id of alby.split(/\s+/)) {
      const r = document.getElementById(id);
      if (r) parts.push(r.textContent || "");
    }
    // Angular Material: mat-form-field ichidagi mat-label.
    const mff = el.closest("mat-form-field, .mat-form-field, .mat-mdc-form-field");
    if (mff) {
      const ml = mff.querySelector("mat-label, .mat-form-field-label, .mat-mdc-floating-label");
      if (ml) parts.push(ml.textContent || "");
    }
    return parts.join(" ");
  }

  function setAny(el, value) {
    if (el.tagName === "SELECT") return setSelect(el, value);
    setValue(el, value);
    return true;
  }

  // Dropdown — variantni qiymat yoki matn bo'yicha topadi.
  function setSelect(el, value) {
    const v = String(value).toLowerCase().trim();
    const opt = Array.from(el.options).find((o) => o.value.toLowerCase() === v || (o.textContent || "").toLowerCase().includes(v));
    if (!opt) return false;
    el.value = opt.value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    flash(el);
    return true;
  }

  // React/Vue kabi controlled input'lar uchun native setter + input/change hodisasi.
  function setValue(el, value) {
    const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, String(value));
    else el.value = String(value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    flash(el);
  }

  function flash(el) {
    el.style.outline = "2px solid #22c55e";
    el.style.transition = "outline .3s ease";
    setTimeout(() => (el.style.outline = ""), 2500);
  }
})();
