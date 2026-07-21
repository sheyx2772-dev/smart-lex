# One-ID (SSO) integratsiyasi — sso.egov.uz

SmartLex/tijoraat.uz'ni "Raqamli hukumat" Yagona identifikatsiya tizimiga (One-ID)
ulash. Texnologik yo'riqnoma (MC LEGAL ↔ Operator) asosida, OAuth2.

## Oqim (4 qadam)

1. `GET /auth/oneid` → imzolangan `state` bilan `sso.egov.uz`ga yo'naltirish
   (`response_type=one_code`).
2. One-ID `redirect_uri`ga `?code=...&state=...` qaytaradi.
3. `GET /auth/oneid/callback`:
   - `state` tekshiriladi (CSRF, 10 daqiqa amal qiladi);
   - `code` → `access_token` (`grant_type=one_authorization_code`);
   - `access_token` → foydalanuvchi ma'lumotlari (`grant_type=one_access_token_identify`);
   - `legal_info.tin` (yoki `pkcs_legal_tin`) bo'yicha **tenant** topiladi;
   - `pin` (JShShIR) bo'yicha **user** topiladi / email bilan bog'lanadi / (yoqilgan bo'lsa) yaratiladi;
   - ilova JWT'si (`LEX_TOKEN`) httpOnly cookie'ga yoziladi;
   - foydalanuvchi web bosh sahifasiga qaytariladi.
4. `identify`дан keyin One-ID `access_token` best-effort logout qilinadi.

## Muhim shartlar (yo'riqnomadan)

- **`redirect_uri` "localhost" bo'lolmaydi** — ro'yxatdan o'tgan qiymatga TENG bo'lishi shart:
  `https://api.tijoraat.uz/auth/oneid/callback`.
- So'rovlar faqat **whitelist IP** (`185.191.141.146`) dan ketishi kerak.
- ⇒ **Lokalда test qilib bo'lmaydi.** Faqat prod serverда (whitelisted IP) ishlaydi.
- Bir daqiqada 300 tadan ortiq so'rov yubormaslik.

## Konfiguratsiya (server `.env`, gitignore)

| Kalit | Tavsif |
|---|---|
| `ONEID_BASE_URL` | `https://sso.egov.uz/sso/oauth/Authorization.do` |
| `ONEID_CLIENT_ID` | uzinfokom bergan Client ID |
| `ONEID_CLIENT_SECRET` | uzinfokom bergan Client Secret (**maxfiy**) |
| `ONEID_REDIRECT_URI` | `https://api.tijoraat.uz/auth/oneid/callback` |
| `ONEID_SCOPE` | Administrator bergan scope |
| `ONEID_POST_LOGIN_REDIRECT` | Kirishдан keyingi web manzil (mas. `https://tijoraat.uz`) |
| `COOKIE_DOMAIN` | `.tijoraat.uz` — cookie web+api subdomenlarда ishlashi uchun |
| `ONEID_AUTO_PROVISION` | `false` (xavfsiz default) yoki `true` |
| `ONEID_PUBLIC_API_URL` | Brauzer uchun API manzili (web `/api/oneid` shu yerga yo'naltiradi) |

> **Xavfsizlik:** Client Secret chatда/kodда saqlanmasin. Faqat server `.env`.
> Agar u ochiq kanalда yuborilgan bo'lsa — ishga tushirishдан oldin uzinfokomдан
> **yangi secret** so'rab, almashtiring.

## Foydalanuvchini bog'lash (tenant + user)

- **Tenant** — `tenants.tin` = One-ID `legal_info.tin`. Tashkilot oldindan tizimda
  bo'lishi kerak; topilmasa `tenant_not_registered` xatosi.
- **User** — tashkilot ichida `users.oneid_pin` = One-ID `pin`. Topilmasa:
  - `users.email` = One-ID `user_id` bo'yicha mavjud (parolli) hisob PIN bilan
    bog'lanadi (`auth_link_oneid_by_email`);
  - aks holda `ONEID_AUTO_PROVISION=true` bo'lsa yangi `viewer` yaratiladi
    (parolsiz), bo'lmasa `user_not_found`.
- One-ID foydalanuvchilarida parol yo'q: `users.password_hash` endi **nullable**.

## Migratsiya

`0003_oneid_sso.sql` — `users.password_hash` nullable + `oneid_pin`/`oneid_sub`
ustunlari + unikal indeks. SECURITY DEFINER funksiyalar (`auth_find_tenant_by_tin`,
`auth_find_user_by_oneid`, `auth_link_oneid_by_email`, `auth_create_oneid_user`)
`migrate` ishga tushganда avtomatik o'rnatiladi (`rls.ts`).

Ishga tushirish: `pnpm --filter @lex/db migrate`.

## Fayllar

- `apps/api/src/lib/oneid.ts` — One-ID mijozi (authorize/exchange/identify/logout, state).
- `apps/api/src/routes/oneid.ts` — `/auth/oneid` + `/auth/oneid/callback`.
- `apps/api/src/lib/env.ts` — `env.oneid.*`.
- `packages/db/src/rls.ts` — SECURITY DEFINER funksiyalar.
- `packages/db/src/client.ts` — `findTenantByTin`, `findUserByOneId`, `linkOneIdByEmail`, `createOneIdUser`.
- `apps/web/src/app/api/oneid/route.ts` — brauzerni API'ga yo'naltiruvchi.
- `apps/web/src/app/login/page.tsx` — "One-ID orqali kirish" tugmasi + xato xabarlari.
