# SmartLex.AI — brauzer kengaytmasi (prototip)

Ikki xil integratsiya bor:

- **cabinet.sud.uz (E-SUD)** — REAL API integratsiyasi (`@lex/integrations`
  `court` moduli). Kengaytma bu yerda formani TO'LDIRMAYDI — faqat One ID
  login'dan keyin `sessionStorage['X-AUTH-TOKEN']`ni o'qib backendga
  yetkazadi (`capture-token.js`); qolgan hamma narsa (entity, javobgar,
  hujjat, hisob-faktura, save-suit) serverda bajariladi.
- **Gibrid pochta (`hybrid.pochta.uz`) va xarid (`xarid.uzex.uz`)** — hali
  eski usul: DOM-to'ldirish (`fill.js`/`profiles.js`), chunki bu saytlar
  uchun hali real API integratsiyasi yo'q.

## Nega kengaytma?

Oddiy veb-sahifa (SmartLex) boshqa domendagi (sud.uz, pochta.uz) ochilgan
sahifa ma'lumotini o'qiy/to'ldira olmaydi — brauzer xavfsizligi (same-origin)
buni taqiqlaydi. Brauzer kengaytmasi esa `host_permissions` orqali shu
saytga ruxsat oladi.

## Ishlash oqimi — cabinet.sud.uz (E-SUD API)

1. Foydalanuvchi «Cabinet.sud.uz'ga ulanish»ni bosadi — sayt **alohida
   haqiqiy oynada** ochiladi (iframe EMAS — kengaytma content-script'i
   faqat top-level sahifada ishlaydi).
2. Foydalanuvchi One ID bilan kiradi (E-IMZO/parol — o'zi tasdiqlaydi).
3. `check-token` sahifasiga qaytganda `capture-token.js` tokenni o'qib
   `background.js`ga yuboradi; SmartLex sahifasi (`relay.js`) so'rab oladi
   va backendga (`POST /api/court/token`) jo'natadi.
4. Backend endi shu token bilan cabinet.sud.uz API'sini to'g'ridan-to'g'ri
   chaqiradi — hujjat yuklash, hisob-faktura, va (foydalanuvchi tasdig'idan
   keyin) yakuniy topshirish.

## Ishlash oqimi — Gibrid pochta / xarid (eski, DOM-to'ldirish)

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
