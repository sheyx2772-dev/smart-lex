# SmartLex — monorepo (web + api + worker) bitta image. Buyruq compose'да farqlanadi.
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable \
 && apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ── Bog'liqliklar (devDeps ham kerak: tsx, next, typescript) ──
FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
# Web'ni oldindan build qilamiz (next build). API/worker tsx bilan ishlaydi.
RUN pnpm --filter @lex/web build
ENV NODE_ENV=production
EXPOSE 3000 3001
# Root emas — node:22-slim'dagi tayyor "node" foydalanuvchisi bilan ishga tushiriladi
# (konteyner buzilsa ham host darajasida root huquqi berilmasin).
RUN chown -R node:node /app
USER node
# Standart buyruq compose'да har xizmat uchun almashtiriladi.
CMD ["pnpm", "--filter", "@lex/api", "start"]
