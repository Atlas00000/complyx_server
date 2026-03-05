# Build stage
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@8.15.0 --activate
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

COPY prisma ./prisma
RUN pnpm exec prisma generate

COPY . .
RUN pnpm build

# Production stage
FROM node:20-alpine AS runner

ENV NODE_ENV=production

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

USER appuser
EXPOSE 3001
ENV PORT=3001

# Run migrations then start server (for Railway etc.)
CMD ["sh", "-c", "node node_modules/.bin/prisma migrate deploy && exec node dist/server.js"]
