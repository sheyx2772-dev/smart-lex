// Renderer — preload orqali `window.smartlex` funksiyalarini chaqiradi.
const $ = (id) => document.getElementById(id);
let token = null;

function esc(s) {
  return String(s ?? "—").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

$("loginBtn").addEventListener("click", async () => {
  const email = $("email").value.trim();
  const password = $("password").value;
  $("loginMsg").textContent = "Kirilmoqda…";
  try {
    const r = await window.smartlex.login(email, password);
    if (!r || !r.success) {
      $("loginMsg").innerHTML = `<span class="err">${esc(r?.message || "Kirish xatosi")}</span>`;
      return;
    }
    token = r.data.token;
    $("loginMsg").innerHTML = `<span class="ok">Kirdingiz: ${esc(r.data.user?.fullName || email)}</span>`;
    $("loginCard").classList.add("hidden");
    $("claimsCard").classList.remove("hidden");
    loadClaims();
  } catch (e) {
    $("loginMsg").innerHTML = `<span class="err">Xato: ${esc(e.message)}</span>`;
  }
});

$("refreshBtn").addEventListener("click", loadClaims);

// Test da'vo — SmartLex'da ma'lumot bo'lmasa ham cabinet.sud.uz'ni sinash uchun.
$("testBtn").addEventListener("click", async (e) => {
  const b = e.currentTarget;
  b.disabled = true;
  b.textContent = "Brauzer ochilmoqda…";
  const claim = {
    debtor: "GLOBAL SNAB MCHJ",
    tin: "309245186",
    amount: "5 112 500,00 UZS",
    amountNumber: "5112500",
    court: "Toshkent shahar iqtisodiy sudi",
    contractNumber: "SH-2026-001",
    principal: "5000000",
    penalty: "112500",
  };
  const r = await window.smartlex.fillCourt(claim);
  b.disabled = false;
  b.textContent = r.ok
    ? "✓ Brauzer ochildi — panel orqali to'ldiring"
    : "🧪 Test da'vo bilan sinash (cabinet.sud.uz)";
  if (!r.ok) alert("Xato: " + r.error);
});

async function loadClaims() {
  const list = $("claimsList");
  list.innerHTML = '<p class="muted">Yuklanmoqda…</p>';
  try {
    const r = await window.smartlex.claims(token);
    const items = (r && r.data && (r.data.items || r.data)) || [];
    if (!items.length) {
      list.innerHTML = '<p class="muted">Sudga tayyor da\'vo topilmadi.</p>';
      return;
    }
    list.innerHTML = items
      .map((it, i) => {
        const name = it.contractorName || it.debtor || it.name || "—";
        const tin = it.contractorTin || it.tin || "";
        const amount = it.total || it.amount || "";
        return `<div class="row">
          <div><b>${esc(name)}</b><br><span class="muted">STIR: ${esc(tin)} · ${esc(amount)}</span></div>
          <button data-i="${i}">Sudga to'ldirish</button>
        </div>`;
      })
      .join("");
    list.querySelectorAll("button[data-i]").forEach((b) => {
      b.addEventListener("click", () => fill(items[+b.dataset.i], b));
    });
  } catch (e) {
    list.innerHTML = `<p class="err">Xato: ${esc(e.message)}</p>`;
  }
}

async function fill(item, btn) {
  btn.disabled = true;
  btn.textContent = "Brauzer ochilmoqda…";
  const claim = {
    debtor: item.contractorName || item.debtor,
    tin: item.contractorTin || item.tin,
    amount: item.total || item.amount,
    amountNumber: item.totalNumber || (item.total ? String(item.total).replace(/\D/g, "") : ""),
    court: item.court,
    contractNumber: item.contractNumber,
    body: item.body,
  };
  const r = await window.smartlex.fillCourt(claim);
  if (r.ok) {
    btn.textContent = "✓ Brauzer ochildi";
    btn.classList.add("ghost");
    // Ko'p bosqichli sihirgar: har qadamda o'ng-pastdagi SmartLex panelidan
    // «Shu bosqichni to'ldirish» bosiladi. Ro'yxat/sana va E-IMZO — foydalanuvchi.
  } else {
    btn.textContent = "Xato — qayta urinish";
    btn.disabled = false;
    alert("Xato: " + r.error);
  }
}
