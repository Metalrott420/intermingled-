FROM node:22-alpine

WORKDIR /app

# Copy zero-dependency server and prebuilt public bundle
COPY index.js ./
COPY artifacts/speed-date/dist/public ./artifacts/speed-date/dist/public

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "index.js"]
