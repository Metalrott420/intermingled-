FROM node:22-alpine

WORKDIR /app

# Copy production server and prebuilt public bundle
COPY package.json production_server.js ./
COPY artifacts/speed-date/dist/public ./artifacts/speed-date/dist/public

# Install lightweight Express dependency
RUN npm install express@^4.21.2 --production --no-audit --no-fund

ENV PORT=24906
ENV NODE_ENV=production

EXPOSE 24906

CMD ["node", "production_server.js"]
