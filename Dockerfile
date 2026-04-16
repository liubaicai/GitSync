# Build stage
FROM node:18-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine

RUN apk add --no-cache git openssh-client netcat-openbsd

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm install -g pm2

COPY --from=build /app/dist ./dist

RUN mkdir -p /app/data /app/tmp

VOLUME ["/app/data"]

ENV PORT=3001
EXPOSE 3001

USER node

CMD ["pm2-runtime", "dist/server/index.js"]
