FROM node:24-alpine

# Install pnpm globally to cache it in the image layer
RUN npm install -g pnpm@12.6.0

WORKDIR /app

# Copy package files first
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY artifacts/speed-date/package.json ./artifacts/speed-date/

# Install dependencies with retry logic
RUN pnpm install --frozen-lockfile --prefer-offline || pnpm install --frozen-lockfile --no-frozen-lockfile

# Copy source code
COPY . .

# Build the SPA
RUN pnpm --filter @workspace/speed-date run build

# Expose port
EXPOSE 8080

# Start server
CMD ["pnpm", "--filter", "@workspace/speed-date", "start"]

