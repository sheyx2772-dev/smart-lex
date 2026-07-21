#!/usr/bin/env bash
# SmartLex — VPS'да bir-buyruqли deploy (API + One-ID integratsiyasi).
# Ishlatish (VPS'да, repo papkasida):
#   1) apps/api/.env ni to'ldiring (infra/.env.vps-api.example dan) — ONEID_* va DB
#   2) bash infra/deploy-vps.sh
set -euo pipefail

REPO_DIR="${REPO_DIR:-$(pwd)}"
BRANCH="${BRANCH:-fix/i18n-crashes-and-agent}"
API_DOMAIN="${API_DOMAIN:-api.lexai.com.uz}"

cd "$REPO_DIR"

echo "▶ 1/5 Kod yangilanmoqda ($BRANCH)"
git fetch origin
git checkout "$BRANCH"
git pull --ff-only

echo "▶ 2/5 Bog'liqliklar o'rnatilmoqda"
corepack pnpm install --frozen-lockfile

echo "▶ 3/5 Migratsiya (One-ID ustunlar + SECURITY DEFINER funksiyalar)"
if [ ! -f apps/api/.env ]; then
  echo "✗ apps/api/.env yo'q. Avval: cp infra/.env.vps-api.example apps/api/.env  va to'ldiring."
  exit 1
fi
set -a; . apps/api/.env; set +a
corepack pnpm --filter @lex/db migrate

echo "▶ 4/5 nginx ($API_DOMAIN)"
sudo cp infra/nginx-api-lexai.conf "/etc/nginx/sites-available/$API_DOMAIN"
sudo ln -sf "/etc/nginx/sites-available/$API_DOMAIN" "/etc/nginx/sites-enabled/$API_DOMAIN"
sudo nginx -t
sudo systemctl reload nginx

echo "▶ 5/5 API qayta ishga tushirilmoqda"
if command -v pm2 >/dev/null 2>&1 && pm2 describe lex-api >/dev/null 2>&1; then
  pm2 restart lex-api --update-env
elif command -v pm2 >/dev/null 2>&1; then
  ( cd apps/api && pm2 start "corepack pnpm --filter @lex/api start" --name lex-api )
  pm2 save
elif systemctl list-unit-files 2>/dev/null | grep -q '^lex-api'; then
  sudo systemctl restart lex-api
else
  echo "⚠ API jarayoni topilmadi. Qo'lда ishga tushiring:"
  echo "    corepack pnpm --filter @lex/api start    (pm2/systemd bilan doimiy qiling)"
fi

echo ""
echo "✓ Deploy tugadi."
echo "  TLS (bir marta):   sudo certbot --nginx -d $API_DOMAIN"
echo "  Tekshirish:        curl -s https://$API_DOMAIN/health   → {\"status\":\"ok\",\"service\":\"lex-api\"}"
