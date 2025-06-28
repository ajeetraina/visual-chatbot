# Stage 1: Build React app
FROM node:22-slim AS build-react-app
WORKDIR /app
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Set up the sample MCP server
FROM node:22-slim AS sample-server
WORKDIR /usr/local/app
ENV NODE_ENV=production
COPY sample-mcp-server/package*.json ./
RUN npm install
COPY sample-mcp-server/src ./src

# Stage 3: Main application with Docker CLI and health checks
FROM node:22-slim AS backend
WORKDIR /usr/local/app

# Install Docker CLI and curl for health checks
RUN apt-get update && apt-get install -y \
    docker.io \
    curl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3003

# Install API dependencies
COPY api/package*.json ./
RUN npm install && npm cache clean --force

# Copy API source
COPY api/ ./

# Copy the built React app to the public directory of the backend
COPY --from=build-react-app /app/dist /usr/local/app/public

# Copy sample MCP server
COPY --from=sample-server /usr/local/app /usr/local/sample-mcp-server

# Create startup script that handles port configuration
RUN cat > start.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting Visual Chatbot on port ${PORT:-3003}"
echo "🔧 MCP Bridge URL: ${MCP_BRIDGE_URL:-http://mcp-bridge:3001}"
echo "🐳 Docker Host: ${DOCKER_HOST:-unix:///var/run/docker.sock}"

# Start the API server
node src/index.mjs
EOF

RUN chmod +x start.sh

# Create health check script
RUN cat > healthcheck.sh << 'EOF'
#!/bin/bash
curl -f http://localhost:${PORT:-3003}/health || exit 1
EOF

RUN chmod +x healthcheck.sh

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD ./healthcheck.sh

# Expose port 3003 for the visual chatbot
EXPOSE 3003

CMD ["./start.sh"]