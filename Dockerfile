# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=npm_token \
    sh -eu -c 'printf "%s\n" \
      "@storymeedev:registry=https://npm.pkg.github.com" \
      "//npm.pkg.github.com/:_authToken=$(cat /run/secrets/npm_token)" \
      > /tmp/npmrc; npm ci --userconfig=/tmp/npmrc; rm -f /tmp/npmrc'
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./
EXPOSE 4503
CMD ["node", "dist/index.js"]
