FROM node:22-slim

WORKDIR /app

# Install build dependencies for native C++ modules
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

# Copy repository (including force-committed dist bundles)
COPY . .

# Install dependencies for Linux environment
RUN pnpm install --no-frozen-lockfile

# Rebuild native addons for Linux x64 GLIBC
RUN pnpm rebuild better-sqlite3

EXPOSE 8080

CMD ["node", "start.mjs"]
