# Multi-stage build: compile everything in builder, serve minimal in runtime
FROM node:22-alpine AS builder

WORKDIR /app

# 1. Copy workspace config first (for pnpm to resolve properly)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY artifacts/speed-date/package.json artifacts/speed-date/

# 2. Configure npm retry behavior aggressively
RUN npm config set fetch-timeout=60000 && \
    npm config set fetch-retries=10 && \
    npm config set fetch-retry-mintimeout=10000 && \
    npm config set fetch-retry-maxtimeout=60000

# 3. Install pnpm globally (caches in image layer)
RUN npm install -g pnpm@11.15.1 --no-audit --no-fund

# 4. Install dependencies with retry + offline fallback
RUN pnpm install --frozen-lockfile --prefer-offline || \
    (sleep 5 && pnpm install --frozen-lockfile --prefer-offline) || \
    (sleep 10 && pnpm install --frozen-lockfile)

# 5. Copy source code and config
COPY artifacts/speed-date/src artifacts/speed-date/src
COPY artifacts/speed-date/vite.config.ts artifacts/speed-date/tsconfig.json artifacts/speed-date/index.html artifacts/speed-date/components.json artifacts/speed-date/.npmrc artifacts/speed-date/

# 6. Build the app
RUN pnpm --filter @workspace/speed-date run build

# Runtime stage: lean production image
FROM node:22-alpine

WORKDIR /app

# Copy production server
COPY package.json production_server.js ./

# Copy built artifacts from builder
COPY --from=builder /app/artifacts/speed-date/dist/public ./artifacts/speed-date/dist/public

# Install only production dependencies
RUN npm install express@^4.21.2 --production --no-audit --no-fund && \
    npm cache clean --force

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "production_server.js"]

