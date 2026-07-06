FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app
COPY 0-Shared-Libs ./0-Shared-Libs
RUN cd 0-Shared-Libs/prisma-client && npm install && npx prisma generate
RUN cd 0-Shared-Libs/api-client && npm install
COPY 2-MCP-Core/core-admin-api ./2-MCP-Core/core-admin-api
WORKDIR /app/2-MCP-Core/core-admin-api
RUN npm install -g typescript
RUN npm install
RUN npm run build
EXPOSE 4503
CMD ["node", "dist/index.js"]
