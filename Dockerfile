FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Placeholder for build-time only: prisma.config.ts validates DATABASE_URL is
# set just to load the config, and the root layout queries the Run table
# during build-time static generation of /pokedex and /typen - so this throwaway
# DB needs the real schema (via migrate deploy), not just an empty file. The
# real DATABASE_URL/data are injected at container runtime via docker-compose.
ENV DATABASE_URL="file:./dev.db"
RUN npx prisma generate
RUN npx prisma migrate deploy
RUN npm run build

# Note: we intentionally do NOT use Next's `output: standalone` here. Its
# minimal node_modules is traced from static app imports only, so it would
# exclude the `prisma` CLI (needed below to run migrations on container
# start). Instead we do a plain production install + `next start`.
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
# The generated Prisma client (incl. the native query engine binary for this
# platform) lives outside node_modules; Next's build doesn't bundle it, so it
# must be copied explicitly or the client can't find its query engine.
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && mkdir -p /app/db \
  && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
