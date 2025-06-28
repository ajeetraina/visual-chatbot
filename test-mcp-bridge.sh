#!/bin/bash

set -e

echo "🚀 Testing Visual Chatbot with MCP Bridge Setup"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
echo -e "${YELLOW}Checking Docker status...${NC}"
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker is running${NC}"

# Check if Docker MCP Toolkit is available
echo -e "${YELLOW}Checking Docker MCP Toolkit...${NC}"
if command -v docker mcp >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Docker MCP Toolkit is available${NC}"
    docker mcp --version 2>/dev/null || echo "MCP version check failed"
else
    echo -e "${YELLOW}⚠️  Docker MCP Toolkit not found. Install from Docker Desktop extensions.${NC}"
fi

# Stop any existing containers
echo -e "${YELLOW}Stopping existing containers...${NC}"
docker-compose down --remove-orphans 2>/dev/null || true

# Build and start the services
echo -e "${YELLOW}Building and starting services...${NC}"
docker-compose up --build -d

# Wait for services to be healthy
echo -e "${YELLOW}Waiting for services to be healthy...${NC}"
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if docker-compose ps | grep -q "healthy"; then
        echo -e "${GREEN}✅ Services are healthy${NC}"
        break
    fi
    echo "Waiting for services... (attempt $((attempt + 1))/$max_attempts)"
    sleep 5
    attempt=$((attempt + 1))
done

if [ $attempt -eq $max_attempts ]; then
    echo -e "${RED}❌ Services failed to become healthy${NC}"
    echo "Service status:"
    docker-compose ps
    echo "Logs:"
    docker-compose logs
    exit 1
fi

# Test MCP Bridge
echo -e "${YELLOW}Testing MCP Bridge (http://localhost:3001)...${NC}"
if curl -f http://localhost:3001/health >/dev/null 2>&1; then
    echo -e "${GREEN}✅ MCP Bridge is responding${NC}"
else
    echo -e "${RED}❌ MCP Bridge is not responding${NC}"
    echo "Bridge logs:"
    docker-compose logs mcp-bridge
fi

# Test Visual Chatbot
echo -e "${YELLOW}Testing Visual Chatbot (http://localhost:3003)...${NC}"
if curl -f http://localhost:3003/health >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Visual Chatbot is responding${NC}"
else
    echo -e "${RED}❌ Visual Chatbot is not responding${NC}"
    echo "Chatbot logs:"
    docker-compose logs visual-chatbot
fi

# Show service status
echo -e "${YELLOW}Service Status:${NC}"
docker-compose ps

# Show useful URLs
echo -e "${GREEN}"
echo "================================================"
echo "🎉 Setup Complete!"
echo "================================================"
echo "Visual Chatbot: http://localhost:3003"
echo "MCP Bridge API: http://localhost:3001"
echo "MCP Bridge Health: http://localhost:3001/health"
echo ""
echo "To view logs:"
echo "  docker-compose logs visual-chatbot"
echo "  docker-compose logs mcp-bridge"
echo ""
echo "To stop services:"
echo "  docker-compose down"
echo "================================================"
echo -e "${NC}"

# Test Docker commands through bridge (if available)
echo -e "${YELLOW}Testing Docker commands through bridge...${NC}"
if curl -s http://localhost:3001/health >/dev/null 2>&1; then
    echo "Testing Docker ps command..."
    curl -s -X POST http://localhost:3001/docker/ps 2>/dev/null | head -5 || echo "Docker command test failed"
fi

echo -e "${GREEN}✅ Test completed!${NC}"