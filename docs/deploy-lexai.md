# One-ID'ni ishga tushirish — mavjud tuzilma (Vercel + VPS)

Bu **haqiqiy hozirgi arxitekturага** mos yagona qo'llanma (rebuild emas, integratsiya).

## Arxitektura

```
Brauzer
  │
  ├─► www.lexai.com.uz            → VERCEL           (web / Next.js frontend)
  │        │  "One-ID orqali kirish" → /api/oneid (Vercel) 
  │        ▼
  └─► api.lexai.com.uz            → VPS 185.191.141.146 (nginx → API :3001)
           │  /auth/oneid → sso.egov.uz → /auth/oneid/callback
           ▼  LEX_TOKEN cookie (domain=.lexai.com.uz) → www.lexai.com.uz o'qiydi
```

- **Web** — Vercel'да (o'zgarmaydi, faqat env + qayta deploy).
- **API** — VPS'да, nginx orqasида (`api.lexai.com.uz` qo'shiladi).
- **One-ID** — lexai.com.uz uchun ro'yxатдан o'tган; VPS IP (185.191.141.146) whitelist'да.
- **Cookie** — `.lexai.com.uz` — VPS (api) o'rnatadi, Vercel (www) o'qiydi (bitta domen). Kod tayyor.

---

## A. DNS (1 yozuv)

`api.lexai.com.uz` → **A** → `185.191.141.146`.
(www.lexai.com.uz Vercel'да qoladi — tegmang.)

## B. VPS — API'ni yangilash

> Men serverга kira olmayman (parol taqiqi). Quyidagilarни o'zingiz bajaring;
> chiqqan natijани menга tashlang — tuzataman.

```bash
ssh <foydalanuvchi>@185.191.141.146

# 1) Kodни yangilash (mavjud API papkasида)
cd /path/to/smart-lex        # hozirgi API shu yerда bo'lsa
git fetch origin && git checkout fix/i18n-crashes-and-agent && git pull
corepack pnpm install --frozen-lockfile

# 2) Env — One-ID qiymatlarини qo'shing
cp infra/.env.vps-api.example apps/api/.env    # yoki mavjud .env'ingizga ONEID_* larni qo'shing
nano apps/api/.env    # DATABASE_URL, JWT_SECRET, ONEID_CLIENT_SECRET, ONEID_SCOPE ...

# 3) Migratsiya (One-ID ustunlar + SECURITY DEFINER funksiyalar)
corepack pnpm --filter @lex/db migrate

# 4) API'ni qayta ishga tushirish — QANDAY ishlatayotgan bo'lsangiz shундай:
#    pm2:      pm2 restart lex-api   (yoki: pm2 start "pnpm --filter @lex/api start" --name lex-api)
#    systemd:  sudo systemctl restart lex-api
#    docker:   docker compose restart api
```

Tekshirish: `curl -s http://127.0.0.1:3001/health` → `{"status":"ok","service":"lex-api"}`
(agar hali `"environment":"production"` chiqsa — eski jarayon qayta ishga tushmagan.)

## C. nginx — api.lexai.com.uz

```bash
sudo cp infra/nginx-api-lexai.conf /etc/nginx/sites-available/api.lexai.com.uz
sudo ln -s /etc/nginx/sites-available/api.lexai.com.uz /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
# HTTPS (Let's Encrypt):
sudo certbot --nginx -d api.lexai.com.uz
```

Tekshirish: `curl -s https://api.lexai.com.uz/health` → `{"status":"ok","service":"lex-api"}`

## D. Vercel — web env

Vercel loyiha → **Settings → Environment Variables** (Production):

| Kalit | Qiymat |
|---|---|
| `API_URL` | `https://api.lexai.com.uz` |
| `ONEID_PUBLIC_API_URL` | `https://api.lexai.com.uz` |

So'ng repo'даги `fix/i18n-crashes-and-agent` (yoki merge qilinган `main`) Vercel'га
deploy bo'lsin (**Redeploy**). Shунда login oynasида **"One-ID orqali kirish"** chiqadi.

> Vercel qaysi branch'дан deploy qilishига e'tibor bering — One-ID kodи shu branch'да
> bo'lishi kerak. Kerak bo'lsa `fix/i18n-crashes-and-agent`ni `main`ga merge qiling.

## E. Tashkilot (tenant) — One-ID mos kelishi uchun

One-ID kompaniyа **STIR**и `tenants.tin` bilan mos bo'lishi kerak:

```bash
# VPS'да, mavjud DB'да:
psql "$DATABASE_MIGRATION_URL" -c \
 "insert into tenants (type,name,tin,default_locale) values ('company','MC LEGAL','SIZNING_STIR','uz')
  on conflict do nothing;"
```

Foydalanuvchi: `ONEID_AUTO_PROVISION=true` qo'ysangiz — birinchi kirishда avtomatik
`viewer` yaratiladi, keyin `update users set role='owner' where oneid_pin='<JShShIR>';`.

## F. Sinash

`https://www.lexai.com.uz` → **Kirish** → **One-ID orqali kirish** → sso.egov.uz →
E-IMZO/Mobile-ID → qaytib **kiradi**. ✅

## Nosozliklar

| Belgi | Sabab |
|---|---|
| One-ID "invalid redirect" | `ONEID_REDIRECT_URI` uzinfokom ro'yxати bilan aynан teng emas |
| `/health` hali eski javob | API jarayoni qayta ishga tushmagan (B-4) |
| cookie kirmayapti (kirgach chiqib ketadi) | `COOKIE_DOMAIN=.lexai.com.uz` emas, yoki web api boshqa domenда |
| `tenant_not_registered` | `tenants.tin` One-ID STIR bilan mos emas (E) |
| CORS/aralash | Web server-side chaqiradi (apiServer) — CORS kam ta'sir qiladi; kerak bo'lsa `WEB_URL` to'g'ri bo'lsin |
