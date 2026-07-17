# SmartLex.AI — brauzer kengaytmasi (prototip)

Davlat saytlari (E-SUD `cabinet.sud.uz`, Gibrid pochta `hybrid.pochta.uz`,
xarid `xarid.uzex.uz`) formalariga SmartLex.AI da'vo/ariza ma'lumotini
**avtomatik to'ldiradi**. E-IMZO imzoni foydalanuvchi o'zi bosadi — kengaytma
imzolamaydi va parol so'ramaydi.

## Nega kengaytma?

Oddiy veb-sahifa (SmartLex) boshqa domendagi (sud.uz) ochilgan sahifa
ma'lumotini o'qiy/to'ldira olmaydi — brauzer xavfsizligi (same-origin) buni
taqiqlaydi. Brauzer kengaytmasi esa `host_permissions` orqali shu saytga
ruxsat oladi va formani to'ldira oladi. autopilot.uz kabi tizimlar ham shu
tamoyilda ishlaydi.

## Ishlash oqimi

1. SmartLex.AI (Sud/Ijro) → **«Kengaytmaga yuborish»** — da'vo ma'lumoti
   kengaytmaga saqlanadi (`relay.js` → `background.js` → `storage`).
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
