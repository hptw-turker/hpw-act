# HPW Act API — kaynaktan çok aşamalı derleme. Context: depo kökü. BU ORTAMDA DOCKER YOK: temiz checkout derleme testi YAPILMADI (F99-05).
FROM node:22-alpine AS build
WORKDIR /src
COPY tsconfig.base.json ./
COPY packages/domain-core/package.json packages/domain-core/package-lock.json packages/domain-core/tsconfig.json ./packages/domain-core/
COPY packages/domain-core/src ./packages/domain-core/src
RUN cd packages/domain-core && npm ci --no-audit --no-fund && npx tsc -p tsconfig.json
COPY apps/api/package.json apps/api/package-lock.json apps/api/tsconfig.json ./apps/api/
COPY apps/api/src ./apps/api/src
RUN cd apps/api && npm ci --no-audit --no-fund && npx tsc -p tsconfig.json && npm prune --omit=dev
COPY apps/web/package.json apps/web/package-lock.json apps/web/vite.config.ts apps/web/tsconfig.json apps/web/app.html apps/web/index.html ./apps/web/
COPY apps/web/src ./apps/web/src
COPY apps/web/public ./apps/web/public
RUN cd apps/web && npm ci --no-audit --no-fund && VITE_APP_ONLY=1 npx vite build
FROM node:22-alpine
WORKDIR /app
COPY --from=build /src/apps/api/dist ./apps/api/dist
COPY --from=build /src/apps/api/package.json ./apps/api/package.json
COPY --from=build /src/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /src/packages/domain-core/package.json ./apps/api/node_modules/@hpw-act/domain-core/package.json
COPY --from=build /src/packages/domain-core/dist ./apps/api/node_modules/@hpw-act/domain-core/dist
COPY --from=build /src/apps/web/dist ./apps/web/dist
COPY db/migrations ./db/migrations
ENV NODE_ENV=production HOST=0.0.0.0 WEB_DIST=/app/apps/web/dist MIGRATIONS_DIR=/app/db/migrations
WORKDIR /app/apps/api
HEALTHCHECK --interval=15s --timeout=5s --retries=10 CMD wget -qO- "http://127.0.0.1:${PORT:-8787}/api/ready" | grep -q '"ready":true' || exit 1
CMD ["sh", "-c", "node dist/src/migrate.js && exec node dist/src/server.js"]
