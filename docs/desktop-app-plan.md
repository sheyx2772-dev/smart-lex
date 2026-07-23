# SmartLex Desktop — reja & arxitektura (autopilot.uz uslubi)

Maqsad: kompyuterga o'rnatiladigan, lokal ishlaydigan dastur — SmartLex'dan
da'vo/undiruv ma'lumotini oladi va davlat saytlari (cabinet.sud.uz/E-SUD,
hybrid.pochta.uz, xarid.uzex.uz) formalarini **brauzerni avtomatik boshqarib**
to'ldiradi. E-IMZO imzosini foydalanuvchi o'zi bosadi. Foydalanuvchining o'z
IP'sidan ishlaydi (bloklanmaydi).

## Nega desktop (extension emas)
- **Brauzerni to'liq boshqarish** (sahifalarga o'tish, kutish, ko'p bosqichli
  sihirgar) — extension bunga cheklangan; Playwright to'liq qila oladi.
- **E-IMZO** local CAPIWS xizmati bilan ishlaydi (wss://127.0.0.1:64443) — desktop
  ilova boshqargan Chromium unga kira oladi.
- **Bir marta o'rnatib**, bir klik bilan ishga tushirish (autopilot.uz kabi).

## Texnologiya
| Qatlam | Vosita |
|---|---|
| Ilova qobig'i | **Electron** (Win `.exe` + Mac `.dmg`) |
| Brauzer avtomatlashtirish | **Playwright** (persistent Chromium profil) |
| UI | HTML/JS renderer (yoki keyin React) |
| SmartLex bilan aloqa | `https://api.lexai.com.uz` (login → JWT → ma'lumot) |
| Paketlash | **electron-builder** |

## Arxitektura
```
┌─────────────────────────── SmartLex Desktop (Electron) ───────────────────────────┐
│                                                                                    │
│  Renderer (UI)                 Main process                  Automation (Playwright)│
│  ┌───────────────┐   IPC   ┌──────────────────┐   drive   ┌──────────────────────┐ │
│  │ Login         │◄───────►│ api.lexai.com.uz │           │ Persistent Chromium  │ │
│  │ Da'volar ro'y-│         │  (JWT, ma'lumot) │──────────►│  profil (E-IMZO      │ │
│  │ xati          │         │                  │           │  sessiyasi saqlanadi)│ │
│  │ "Sudga to'ldir"│        │ fillCourt(claim) │           │  cabinet.sud.uz form │ │
│  └───────────────┘         └──────────────────┘           │  yorliq bo'yicha     │ │
│                                                            │  to'ldiriladi        │ │
│                                              Foydalanuvchi ◄── E-IMZO'ni o'zi bosadi│ │
└────────────────────────────────────────────────────────────────────────────────────┘
```

## Oqim (foydalanuvchi)
1. Dasturni ochadi → SmartLex hisobi bilan **login** (email/parol).
2. **Da'volar/undiruvlar ro'yxati** ko'rinadi (api.lexai.com.uz'dan).
3. Bittasini tanlab **"Sudga to'ldirish"** bosadi.
4. Dastur ichki brauzerni ochadi → cabinet.sud.uz → (birinchi marta E-IMZO bilan
   kirish — sessiya profilga saqlanadi) → formani **avtomatik to'ldiradi**.
5. Foydalanuvchi tekshiradi, **E-IMZO bilan imzolab** topshiradi.

## Yo'l xaritasi (bosqichlar)
1. **Skelet** (shu commit) — Electron + Playwright + login + ma'lumot + bitta
   sahifa to'ldirish namunasi.
2. **Ko'p bosqichli sihirgar** — cabinet.sud.uz'ning har qadamini (Sud, Tomonlar,
   Summa, Hujjat) ketma-ket to'ldirish + navigatsiya.
3. **Yorliq xaritasi** — har maydonni aniq yorliq bo'yicha (jonli sinab) bog'lash.
4. **Boshqa saytlar** — hybrid.pochta.uz, xarid.uzex.uz profillari.
5. **Paketlash + tarqatish** — `.exe`/`.dmg`, kod imzolash, saytda "Yuklab olish".
6. **Yangilanish** — auto-update (electron-updater).

## Muhim: bu jiddiy loyiha
autopilot.uz 3.x — yillar mehnati. Bu skelet — **poydevor**; to'liq mahsulot uchun
har davlat sayti formasi jonli sinab, bosqichma-bosqich quriladi.

## Qurish/ishga tushirish
```
cd apps/desktop
pnpm install          # electron, playwright, electron-builder
pnpm run start        # dasturni lokal ishga tushirish
pnpm run dist         # o'rnatgich (.dmg/.exe) yasash
```
