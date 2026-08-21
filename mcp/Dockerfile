FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN --mount=type=secret,id=npm_token \
    echo "@storymeedev:registry=https://npm.pkg.github.com" > ~/.npmrc && \
    echo "//npm.pkg.github.com/:_authToken=$(cat /run/secrets/npm_token)" >> ~/.npmrc && \
    npm install && rm -f ~/.npmrc
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY package*.json ./
RUN --mount=type=secret,id=npm_token \
    echo "@storymeedev:registry=https://npm.pkg.github.com" > ~/.npmrc && \
    echo "//npm.pkg.github.com/:_authToken=$(cat /run/secrets/npm_token)" >> ~/.npmrc && \
    npm install --omit=dev && rm -f ~/.npmrc
COPY --from=builder /app/build ./build
CMD ["node", "build/index.js"]
