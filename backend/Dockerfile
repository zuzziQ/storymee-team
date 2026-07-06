# Stage 1: Build
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
RUN npm install -g typescript
WORKDIR /app

# Copy shared libraries and generate prisma
COPY 0-Shared-Libs ./0-Shared-Libs
RUN cd 0-Shared-Libs/prisma-client && npm install && npx prisma generate

# Copy and build target service
COPY 2-MCP-Core/core-team-api ./2-MCP-Core/core-team-api
WORKDIR /app/2-MCP-Core/core-team-api
RUN npm install
RUN npm run build

# Stage 2: Production
FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production

# Copy built files and dependencies
COPY --from=builder /app/0-Shared-Libs ./0-Shared-Libs
COPY --from=builder /app/2-MCP-Core/core-team-api/node_modules ./2-MCP-Core/core-team-api/node_modules
COPY --from=builder /app/2-MCP-Core/core-team-api/dist ./2-MCP-Core/core-team-api/dist
COPY --from=builder /app/2-MCP-Core/core-team-api/package.json ./2-MCP-Core/core-team-api/

WORKDIR /app/2-MCP-Core/core-team-api
EXPOSE 4503
CMD ["node", "dist/index.js"]
