# Server Dockerfile - Node.js/Express Application
FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install build dependencies
RUN apk add --no-cache libc6-compat

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma Client
RUN pnpm db:generate

# Build the application
RUN pnpm build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install runtime dependencies including OpenSSL for Prisma
RUN apk add --no-cache libc6-compat openssl

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built application
COPY --from=base /app/dist ./dist
COPY --from=base /app/prisma ./prisma

# Install Prisma CLI temporarily to generate client, then remove it
RUN pnpm add -D prisma && pnpm db:generate && pnpm remove prisma

# Set permissions
RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3001

ENV PORT=3001
ENV NODE_ENV=production

# Health check script
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/server.js"]
