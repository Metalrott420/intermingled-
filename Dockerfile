FROM node:24-alpine

WORKDIR /app

# Install pnpm globally first (cached layer)
RUN npm install -g pnpm@11.28.0

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy workspace package
COPY artifacts/speed-date ./artifacts/speed-date

# Install dependencies with prefer-offline to use cache
RUN pnpm install --frozen-lockfile --prefer-offline

# Build
RUN pnpm --filter @workspace/speed-date build

# Runtime stage
FROM node:24-alpine

WORKDIR /app

RUN npm install -g pnpm@11.28.0

COPY --from=0 /app ./

EXPOSE 5173

CMD ["pnpm", "--filter", "@workspace/speed-date", "dev"]

