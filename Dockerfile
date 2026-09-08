FROM node:20-alpine

WORKDIR /app

# Install the exact pnpm version pinned in package.json via corepack
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

# Copy all repository files
COPY . .

# Install dependencies without frozen lockfile
RUN pnpm install --no-frozen-lockfile

# Build frontend and backend bundles
RUN pnpm --dir artifacts/speed-date build
RUN cd artifacts/api-server && node build.mjs

EXPOSE 8080

CMD ["node", "artifacts/api-server/dist/index.mjs"]
