FROM node:20-slim

WORKDIR /app

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

# Copy all repository files
COPY . .

# Install dependencies without frozen lockfile
RUN pnpm install --no-frozen-lockfile

# Build frontend bundle
RUN pnpm --dir artifacts/speed-date build

# Build backend bundle & copy frontend assets
RUN cd artifacts/api-server && node build.mjs

EXPOSE 8080

CMD ["node", "artifacts/api-server/dist/index.mjs"]
