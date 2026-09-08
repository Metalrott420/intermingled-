FROM node:20-slim

WORKDIR /app

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

# Copy all repository files
COPY . .

# Install dependencies with frozen lockfile
RUN pnpm install --frozen-lockfile

# Build backend bundle
RUN cd artifacts/api-server && node build.mjs

EXPOSE 8080

CMD ["node", "artifacts/api-server/dist/index.mjs"]
