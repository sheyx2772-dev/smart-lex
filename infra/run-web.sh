#!/usr/bin/env bash
# SmartLex web (Next.js) — pm2 uchun (apps/web/.env ni yuklaydi).
cd "$(dirname "$0")/.."
set -a; [ -f apps/web/.env ] && . apps/web/.env; set +a
exec corepack pnpm --filter @lex/web start
