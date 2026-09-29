FROM node:24-alpine AS builder

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy speed-date artifact
COPY artifacts/speed-date ./artifacts/speed-date/

# Install pnpm and dependencies
RUN npm install -g pnpm@12.6.0 && \
    pnpm install --frozen-lockfile --prefer-offline

# Build the app
RUN pnpm --filter @workspace/speed-date run build

# Production runtime
FROM node:24-alpine

WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/artifacts/speed-date/dist/public ./artifacts/speed-date/dist/public

# Copy server
COPY production_server.js ./

# Install only production express
RUN npm install --production express@4.22.3 && npm cache clean --force

EXPOSE 8080

CMD ["node", "production_server.js"]

