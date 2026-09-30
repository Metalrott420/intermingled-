# Multi-stage: build frontend, then serve
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm and deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY artifacts/speed-date/package.json artifacts/speed-date/

RUN npm install -g pnpm@11.15.1 --no-audit --no-fund && \
    npm config set fetch-timeout=60000 && \
    npm config set fetch-retries=10 && \
    npm config set fetch-retry-mintimeout=10000 && \
    npm config set fetch-retry-maxtimeout=60000

RUN pnpm install --frozen-lockfile --prefer-offline || \
    (sleep 5 && pnpm install --frozen-lockfile --prefer-offline) || \
    (sleep 10 && pnpm install --frozen-lockfile)

# Build frontend
COPY artifacts/speed-date/src artifacts/speed-date/src
COPY artifacts/speed-date/vite.config.ts artifacts/speed-date/tsconfig.json \
     artifacts/speed-date/index.html artifacts/speed-date/components.json \
     artifacts/speed-date/.npmrc artifacts/speed-date/

RUN pnpm --filter @workspace/speed-date run build

# Runtime
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package.json production_server.js ./
COPY --from=builder /app/artifacts/speed-date/dist/public ./artifacts/speed-date/dist/public

RUN npm install express@^4.21.2 --production --no-audit --no-fund && \
    npm cache clean --force

CMD ["node", "production_server.js"]

