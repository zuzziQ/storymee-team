FROM node:20-alpine
WORKDIR /app
COPY 0-Shared-Libs ./0-Shared-Libs
RUN cd 0-Shared-Libs/api-client && npm install && npm run build
COPY 2-MCP-Core/storymeeteam-mcp ./2-MCP-Core/storymeeteam-mcp
WORKDIR /app/2-MCP-Core/storymeeteam-mcp
RUN npm install
RUN npm run build
CMD ["node", "build/index.js"]
