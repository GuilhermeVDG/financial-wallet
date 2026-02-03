FROM node:20-alpine AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

FROM node:20-alpine AS build

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

RUN npm run build

FROM node:20-alpine AS production

RUN apk add --no-cache dumb-init

ENV NODE_ENV=production

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=build --chown=appuser:appgroup /app/dist ./dist
COPY --from=build --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=build --chown=appuser:appgroup /app/package.json ./

USER appuser

EXPOSE 3000

CMD ["dumb-init", "node", "dist/main"]
