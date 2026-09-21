FROM node:20-slim

WORKDIR /app

# Install build dependencies for native C++ modules
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

# Copy repository (excluding node_modules via .dockerignore)
COPY . .

# Install dependencies for Linux environment
RUN pnpm install --no-frozen-lockfile

# Build backend bundle
RUN cd artifacts/api-server && node build.mjs

EXPOSE 8080

CMD ["node", "artifacts/api-server/dist/index.mjs"]
