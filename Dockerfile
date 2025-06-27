FROM node:22-slim AS build-react-app
WORKDIR /app
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

FROM node:22-slim AS sample-server
WORKDIR /usr/local/app
ENV NODE_ENV=production
COPY sample-mcp-server/package*.json ./
RUN npm install
COPY sample-mcp-server/src ./src


# Stage 2: Set up the backend server
FROM node:22-slim AS backend
WORKDIR /usr/local/app
ENV NODE_ENV=production
COPY api/package*.json ./
RUN npm install && npm cache clean --force
COPY api/ ./

# Copy the built React app to the public directory of the backend
COPY --from=build-react-app /app/dist /usr/local/app/public

COPY --from=sample-server /usr/local/app /usr/local/sample-mcp-server
COPY --from=docker --link /usr/local/bin/docker /usr/local/bin/docker

# Expose port 3003 for the visual chatbot
EXPOSE 3003
CMD ["node", "src/index.mjs"]