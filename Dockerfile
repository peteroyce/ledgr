FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine AS runtime
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=base /app/node_modules ./node_modules
COPY --chown=appuser:appgroup src/ ./src/
USER appuser
EXPOSE 3000
CMD ["node", "src/index.js"]
