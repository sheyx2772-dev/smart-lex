#!/usr/bin/env bash
# SmartLex API — pm2 uchun ishga tushiruvchi (apps/api/.env ni yuklaydi).
cd "$(dirname "$0")/.."
set -a; [ -f apps/api/.env ] && . apps/api/.env; set +a
exec corepack pnpm --filter @lex/api start
