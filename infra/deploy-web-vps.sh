#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════════════
# SmartLex WEB (Next.js) — VPS'da build + ishga tushirish (app.lexai.com.uz).
# root bilan, repo ildizidan:  cd ~/smart-lex && bash infra/deploy-web-vps.sh
# API allaqachon ishlab turgan bo'lsin (bootstrap-vps.sh bajarilgan).
# ═══════════════════════════════════════════════════════════════════════════

ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
log(){ echo ""; echo "▶ $*"; }

log "1/5 Swap 4GB (Next.js build og'ir)"
CUR=$(free -m | awk '/Swap:/{print $2}')
if [ "${CUR:-0}" -lt 3900 ]; then
  swapoff /swapfile 2>/dev/null || true
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "  swap = 4GB"
else echo "  swap yetarli (${CUR}MB)"; fi

log "2/5 API redirectlarini app.lexai.com.uz ga yo'naltirish"
API_ENV="$ROOT/apps/api/.env"
if [ -f "$API_ENV" ]; then
  sed -i 's|^WEB_URL=.*|WEB_URL=https://app.lexai.com.uz|' "$API_ENV"
  sed -i 's|^ONEID_POST_LOGIN_REDIRECT=.*|ONEID_POST_LOGIN_REDIRECT=https://app.lexai.com.uz|' "$API_ENV"
  pm2 restart lex-api >/dev/null 2>&1 || true
  echo "  API .env yangilandi + restart"
fi

log "3/5 apps/web/.env"
cat > "$ROOT/apps/web/.env" <<ENV
NODE_ENV=production
API_URL=https://api.lexai.com.uz
ONEID_PUBLIC_API_URL=https://api.lexai.com.uz
ENV
echo "  yozildi"

log "4/5 Web build (next build) — 5-15 daqiqa, sabr qiling"
corepack pnpm install --no-frozen-lockfile
export NODE_OPTIONS="--max-old-space-size=1536"
corepack pnpm --filter @lex/web build

log "5/5 pm2 (lex-web, :3000)"
chmod +x "$ROOT/infra/run-web.sh"
pm2 delete lex-web >/dev/null 2>&1 || true
pm2 start "$ROOT/infra/run-web.sh" --name lex-web
pm2 save

echo ""
echo "════════════════════════════════════════════════"
echo "✓ Web tayyor."
sleep 3
curl -s -o /dev/null -w "  local web (:3000): HTTP %{http_code}\n" http://127.0.0.1:3000/login || true
echo ""
echo "  KEYINGI:"
echo "  1) DNS:   app.lexai.com.uz → 185.191.141.146  (ahost.uz)"
echo "  2) nginx: cp infra/nginx-app-lexai.conf /etc/nginx/sites-available/app.lexai.com.uz"
echo "            ln -sf /etc/nginx/sites-available/app.lexai.com.uz /etc/nginx/sites-enabled/"
echo "            nginx -t && systemctl reload nginx"
echo "  3) HTTPS: certbot --nginx -d app.lexai.com.uz --agree-tos --register-unsafely-without-email --redirect --non-interactive"
echo "════════════════════════════════════════════════"
