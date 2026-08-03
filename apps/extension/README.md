# SmartLex.AI — brauzer kengaytmasi (prototip)

**cabinet.sud.uz (E-SUD) endi bu kengaytmani ISHLATMAYDI.** Real API
integratsiyasi (`@lex/integrations` `court` moduli) uchun token endi
bookmarklet orqali olinadi — qarang `apps/web/src/components/court/sud-filing-flow.tsx`.
Sabab: E-IMZO mahalliy `127.0.0.1` demoniga faqat foydalanuvchining O'Z
haqiqiy brauzerida (kengaytma HAM, serverда boshqariladigan brauzer HAM
EMAS — ikkalasi ham sinovdan o'tib, E-IMZO'ga yeta olmagani aniqlandi)
yeta oladi; bookmarklet buni to'liq hal qiladi va o'rnatish kengaytmadan
ancha yengil (faqat bitta havolani xatchoʻplar paneliga tortish).

Bu kengaytma endi faqat quyidagilar uchun ishlatiladi:

- **Gibrid pochta (`hybrid.pochta.uz`) va xarid (`xarid.uzex.uz`)** — DOM-
  to'ldirish (`fill.js`/`profiles.js`), chunki bu saytlar uchun hali real
  API integratsiyasi yo'q.

## Nega kengaytma?

Oddiy veb-sahifa (SmartLex) boshqa domendagi (pochta.uz, uzex.uz) ochilgan
sahifa ma'lumotini o'qiy/to'ldira olmaydi — brauzer xavfsizligi (same-origin)
buni taqiqlaydi. Brauzer kengaytmasi esa `host_permissions` orqali shu
saytga ruxsat oladi.

## Ishlash oqimi — Gibrid pochta / xarid (DOM-to'ldirish)

1. SmartLex.AI → **«Kengaytmaga yuborish»** — da'vo ma'lumoti kengaytmaga
   saqlanadi (`relay.js` → `background.js` → `storage`).
2. Foydalanuvchi davlat saytini ochadi → o'ng pastda **panel** chiqadi
   (`fill.js`).
3. **«Formani to'ldirish»** — maydonlar (STIR, nomi, summa, shartnoma…) nom/
   label/placeholder bo'yicha topib to'ldiriladi.
4. Foydalanuvchi **E-IMZO bilan tasdiqlaydi** va yuboradi.

## O'rnatish (dev)

1. Chrome → `chrome://extensions` → **Developer mode** yoqing.
2. **Load unpacked** → `apps/extension` papkasini tanlang.
3. SmartLex.AI ochilganda kengaytma «bor» signalini oladi; Sud/Ijro'da
   «Kengaytmaga yuborish» tugmasi ishlaydi.

## Web ↔ kengaytma shartnomasi (postMessage)

Sahifa (SmartLex) yuboradi:

```js
window.postMessage({
  __smartlex: true,
  type: "claim",
  payload: {
    debtor, tin, amount, amountNumber,
    contractNumber, invoiceNumber, court, body,
  },
}, "*");
```

Kengaytma javoblari: `{ __smartlex_ack: true }` (qabul qilindi),
`{ __smartlex_ext: true, version }` (kengaytma o'rnatilgan). Sahifa
`{ __smartlex_ping: true }` yuborib mavjudligini so'rashi mumkin.

## Keyingi qadamlar

- Har sayt uchun aniq maydon xaritasi (selector profillari).
- Ko'p qadamli formalar (wizard) va tanlash (select/autocomplete) qo'llab-quvvatlash.
- Xavfsizlik: faqat foydalanuvchi bosgandan keyin to'ldirish (hozir shunday).
