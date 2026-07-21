#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════════════
# SmartLex — yangi Ubuntu VPS uchun to'liq bootstrap (API + worker + baza).
# root bilan, repo ildizidan ishga tushiring:
#     cd ~/smart-lex && bash infra/bootstrap-vps.sh
# Node 22 + PostgreSQL 16 + Redis o'rnatadi, bazani yaratadi, apps/api/.env
# yozadi, bog'liqliklarni o'rnatadi, migratsiya qiladi, pm2 bilan ishga tushiradi.
# Tugagach: apps/api/.env ga One-ID sirini qo'ying, so'ng `pm2 restart lex-api`.
# ═══════════════════════════════════════════════════════════════════════════

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export DEBIAN_FRONTEND=noninteractive
log(){ echo ""; echo "▶ $*"; }

log "0/7 Swap (2GB kichik — install OOM bo'lmasligi uchun)"
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "  2GB swap yoqildi"
else echo "  swap allaqachon bor"; fi

log "1/7 Tizim paketlari (Node 22, Redis, git)"
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs git build-essential redis-server openssl
corepack enable
systemctl enable --now redis-server

log "2/7 PostgreSQL 16"
if ! { command -v psql >/dev/null && psql --version | grep -q ' 16'; }; then
  . /etc/os-release
  install -d /usr/share/postgresql-common/pgdg
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main" > /etc/apt/sources.list.d/pgdg.list
  apt-get update
  apt-get install -y postgresql-16
fi
systemctl enable --now postgresql

log "3/7 Baza va parollar"
CRED="$ROOT/infra/.db-creds"
if [ -f "$CRED" ]; then . "$CRED"; else
  PG_SUPER_PW="$(openssl rand -hex 16)"
  APP_DB_PW="$(openssl rand -hex 16)"
  JWT_SECRET="$(openssl rand -hex 32)"
  printf 'PG_SUPER_PW=%s\nAPP_DB_PW=%s\nJWT_SECRET=%s\n' "$PG_SUPER_PW" "$APP_DB_PW" "$JWT_SECRET" > "$CRED"
  chmod 600 "$CRED"
fi
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER USER postgres PASSWORD '${PG_SUPER_PW}';"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='lex'" | grep -q 1 || sudo -u postgres createdb lex

log "4/7 apps/api/.env"
ENV="$ROOT/apps/api/.env"
if [ ! -f "$ENV" ]; then
  cat > "$ENV" <<ENVEOF
NODE_ENV=production
API_PORT=3001
DATABASE_URL=postgresql://lex_app:${APP_DB_PW}@localhost:5432/lex
DATABASE_MIGRATION_URL=postgresql://postgres:${PG_SUPER_PW}@localhost:5432/lex
APP_DB_PASSWORD=${APP_DB_PW}
REDIS_URL=redis://localhost:6379
JWT_SECRET=${JWT_SECRET}
WEB_URL=https://www.lexai.com.uz
S3_ENDPOINT=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=lex-documents
USE_MOCKS=true
ONEID_BASE_URL=https://sso.egov.uz/sso/oauth/Authorization.do
ONEID_CLIENT_ID=tijoraat_uz
ONEID_CLIENT_SECRET=PUT_ONEID_SECRET_HERE
ONEID_SCOPE=PUT_ONEID_SCOPE_HERE
ONEID_REDIRECT_URI=https://api.lexai.com.uz/auth/oneid/callback
ONEID_POST_LOGIN_REDIRECT=https://www.lexai.com.uz
COOKIE_DOMAIN=.lexai.com.uz
ONEID_AUTO_PROVISION=false
ENVEOF
  echo "  yozildi: $ENV"
else echo "  mavjud — tegilmadi: $ENV"; fi

log "5/7 Bog'liqliklar (pnpm install) — bir necha daqiqa"
corepack pnpm install --frozen-lockfile

log "6/7 Migratsiya (sxema + RLS + One-ID funksiyalari)"
set -a; . "$ENV"; set +a
corepack pnpm --filter @lex/db migrate

log "7/7 Servislar (pm2: api + worker)"
chmod +x "$ROOT/infra/run-api.sh" "$ROOT/infra/run-worker.sh"
npm install -g pm2 >/dev/null 2>&1 || true
pm2 delete lex-api lex-worker >/dev/null 2>&1 || true
pm2 start "$ROOT/infra/run-api.sh"    --name lex-api
pm2 start "$ROOT/infra/run-worker.sh" --name lex-worker
pm2 save
env PATH="$PATH" pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

echo ""
echo "════════════════════════════════════════════════"
echo "✓ Bootstrap tugadi."
sleep 3
echo "  API /health:"
curl -s http://127.0.0.1:3001/health || echo "  (hali ko'tarilmoqda — 'pm2 logs lex-api')"
echo ""
echo ""
echo "  KEYINGI QADAMLAR:"
echo "  1) One-ID sirini kiriting:   nano $ENV"
echo "        ONEID_CLIENT_SECRET va ONEID_SCOPE  (uzinfokomдан)"
echo "     so'ng qayta yuklang:       pm2 restart lex-api"
echo "  2) nginx + HTTPS:            docs/deploy-lexai.md (C-bo'lim)"
echo "════════════════════════════════════════════════"
