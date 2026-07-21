# SmartLex — VPS'ga deploy (One-ID bilan)

Server: **VPS 185.191.141.146** (Eskiz VDS). Bu IP One-ID whitelist'ида —
shuning uchun IP whitelist'ни o'zgartirish shart emas. Barcha buyruqlar **serverда**
(SSH orqali) bajariladi. Domen `infra/.env`даги `APP_DOMAIN`/`API_DOMAIN` bilan
belgilanadi (kod o'zgartirilmaydi).

> ## ⚠️ One-ID va domen — eng muhim shart
> One-ID `redirect_uri` **uzinfokomда ro'yxatдан o'tган domen bilan AYNAN teng**
> bo'lishi shart. Agar domenni o'zgartirгan bo'lsangiz (mas. `tijoraat.uz` →
> `lexai.com.uz`), One-ID **avtomatik ishlamaydi** — avval **uzinfokomга murojaat
> qilib**, `redirect_uri`ни yangi domenга (`https://api.<yangi-domen>/auth/oneid/callback`)
> **qayta ro'yxatдан o'tkazish** kerak. IP (`185.191.141.146`) o'sha bo'lsa,
> IP whitelist'ни o'zgartirish shart emas. Ro'yxat yangilanmaguncha One-ID
> `invalid redirect` beradi.

---

## 0. Xavfsizlik (birinchi)

1. VMmanager'да **VPS parolini almashtiring** (chatда ko'ringan parol endi ishonchsiz).
2. Iloji bo'lsa **SSH kalit** (key) yoqing, parol bilan kirishни o'chiring.
3. `uzinfokom`дан **One-ID Client Secret'ni yangilang** (u ham ochiq kanalда yurgan).

## 1. DNS (Eskiz panelида yoki NS orqali)

Domeningiz A-yozuvlari `185.191.141.146`ga qarasin (misol `lexai.com.uz`):

| Nom | Turi | Qiymat |
|---|---|---|
| `lexai.com.uz` (APP_DOMAIN) | A | 185.191.141.146 |
| `api.lexai.com.uz` (API_DOMAIN) | A | 185.191.141.146 |
| `www.lexai.com.uz` | A | 185.191.141.146 |

> `api.<domen>` — One-ID `redirect_uri` shu yerда (uzinfokomда ro'yxatдан o'tган bo'lsin). HTTPS'ni Caddy avtomatik oladi.

## 2. Serverга kirish + Docker o'rnatish

```bash
ssh vps09043@185.191.141.146        # (yoki root)
# Docker + compose plugin (Ubuntu/Debian):
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER        # keyin qayta login
docker --version && docker compose version
```

## 3. Portlarni ochish (firewall)

```bash
sudo ufw allow 22 && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
```

## 4. Kodni olish

```bash
git clone -b fix/i18n-crashes-and-agent git@github.com:zoir-dev/smart-lex.git
cd smart-lex
```

## 5. Maxfiy sozlamalar (`infra/.env`)

```bash
cp infra/.env.prod.example infra/.env
nano infra/.env
```

To'ldiring (kuchli tasodifiy qiymatlar):
- `POSTGRES_PASSWORD`, `APP_DB_PASSWORD`, `JWT_SECRET` (≥32 belgi), `S3_ACCESS_KEY`, `S3_SECRET_KEY`
- `ONEID_CLIENT_ID=tijoraat_uz`
- `ONEID_CLIENT_SECRET=<uzinfokomдан YANGILANGAN secret>`
- `ONEID_SCOPE=<administrator bergan scope>`

> `infra/.env` git'ga tushmaydi. Bu fayl serverда qoladi.

## 6. Ko'tarish (build + start)

```bash
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env up -d --build
```

Birinchi build ~3–6 daqiqa. `migrate` xizmati sxema + RLS + One-ID funksiyalarини
o'rnatib, tugaydi; `api`/`web`/`worker`/`caddy` ishlab qoladi.

Tekshirish:
```bash
docker compose -f infra/docker-compose.prod.yml ps
docker compose -f infra/docker-compose.prod.yml logs -f api        # "✓ Lex API"
curl -s https://api.tijoraat.uz/health                              # {"status":"ok"}
```

## 7. Tashkilot (tenant) yaratish — One-ID mos kelishi uchun

One-ID kirishда tashkilot **STIR** bo'yicha topiladi (`tenants.tin` =
`legal_info.tin`). Kompaniyangizni bazaга qo'shing:

```bash
docker compose -f infra/docker-compose.prod.yml exec postgres \
  psql -U lex -d lex -c \
  "insert into tenants (type, name, tin, default_locale)
   values ('company', 'MC LEGAL', '123456789', 'uz');"   -- STIR'ни o'zingiznikiga almashtiring
```

Endi ikki variant:

- **A) Avtomatik (oson):** `infra/.env`да `ONEID_AUTO_PROVISION=true` qo'ying →
  `docker compose ... up -d` bilan `api`ni qayta ishga tushiring. Birinchi One-ID
  kirishда foydalanuvchi avtomatik yaratiladi (`viewer` rol). Keyin uni `owner`ga
  ko'taring:
  ```bash
  docker compose ... exec postgres psql -U lex -d lex -c \
    "update users set role='owner' where oneid_pin='<sizning JShShIR>';"
  ```
- **B) Oldindan:** foydalanuvchini qo'lда qo'shing (PIN = JShShIR):
  ```bash
  docker compose ... exec postgres psql -U lex -d lex -c \
   "insert into users (tenant_id, email, full_name, role, oneid_pin)
    select id, 'admin@tijoraat.uz', 'Direktor', 'owner', '<JShShIR>' from tenants where tin='123456789';"
  ```

## 8. One-ID'ni sinash

`https://tijoraat.uz` → **Kirish** → **One-ID orqali kirish** → sso.egov.uz →
E-IMZO/Mobile-ID → qaytib **kiradi**. Endi IP (185.191.141.146) whitelist'ida
va redirect HTTPS `api.tijoraat.uz` — hammasi joyида.

## 9. Yangilash (keyingi deploylar)

```bash
cd smart-lex && git pull
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env up -d --build
```

## Nosozliklar

| Belgi | Sabab / yechim |
|---|---|
| One-ID "invalid redirect" | `ONEID_REDIRECT_URI` One-ID ro'yxatidаgi bilan aynан teng emas |
| `tenant_not_registered` | `tenants.tin` One-ID `legal_info.tin` bilan mos emas (7-qadam) |
| HTTPS chiqmadi | DNS hali 185.191.141.146'ga qaramaydi yoki 80/443 yopiq (Caddy LE ololmaydi) |
| One-ID timeout | So'rov whitelist IP'дан ketmayapti (serverning tashqi IP'si 185.191.141.146 ekaniga ishonch hosil qiling) |
| cookie kirmayapti | `COOKIE_DOMAIN=.tijoraat.uz` va web/api bir domenда bo'lsin |
