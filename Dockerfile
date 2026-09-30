FROM node:22-alpine

WORKDIR /app

# Copy zero-dependency server files and prebuilt public bundle
COPY package.json index.js production_server.js server.js ./
COPY artifacts/speed-date/dist/public ./artifacts/speed-date/dist/public

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "production_server.js"]
