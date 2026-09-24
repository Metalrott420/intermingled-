FROM node:20

WORKDIR /app

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

# Copy repository (excluding node_modules via .dockerignore)
COPY . .

# Install dependencies for Linux environment
RUN pnpm install --no-frozen-lockfile

# Build backend bundle (requires PORT and BASE_PATH for vite config)
ENV PORT=8080 BASE_PATH=/
RUN cd artifacts/api-server && node build.mjs

EXPOSE 8080

CMD ["node", "start.mjs"]

