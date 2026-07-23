# SmartLex Desktop

autopilot.uz uslubidagi **lokal desktop dastur** — SmartLex'dan da'vo ma'lumotini
oladi va davlat sayti (cabinet.sud.uz) formasini **brauzerni avtomatik boshqarib**
to'ldiradi. E-IMZO imzosini foydalanuvchi o'zi bosadi.

To'liq reja/arxitektura: [`docs/desktop-app-plan.md`](../../docs/desktop-app-plan.md).

## Ishga tushirish (dev)
```
cd apps/desktop
pnpm install            # electron + playwright + electron-builder (postinstall: chromium)
pnpm run start          # dasturni ochadi
```

## Oqim
1. SmartLex hisobi bilan kiring (email/parol — `admin@lexai.com.uz`).
2. Sudga tayyor da'volar ro'yxati chiqadi.
3. «Sudga to'ldirish» → brauzer ochiladi → cabinet.sud.uz.
4. Birinchi marta **E-IMZO bilan kiring** (sessiya `court-profile` da saqlanadi).
5. Forma yorliq bo'yicha to'ldiriladi → tekshiring → **E-IMZO bilan imzolang**.

## O'rnatgich yasash (.dmg / .exe)
```
pnpm run dist           # release/ ichida .dmg (mac) yoki nsis .exe (win)
```
> Windows `.exe` ni Windows'da (yoki CI'da) yasash tavsiya etiladi. Kod imzolash
> (signing) alohida sertifikat talab qiladi.

## Konfiguratsiya
- `SMARTLEX_API` — API manzili (default `https://api.lexai.com.uz`).

## Holat
Bu — **poydevor (skelet)**: login + ma'lumot + bitta sahifa (yorliq bo'yicha)
to'ldirish. To'liq mahsulot uchun keyingi bosqichlar (ko'p bosqichli sihirgar,
aniq yorliq xaritasi, boshqa saytlar, auto-update) — `docs/desktop-app-plan.md`.
