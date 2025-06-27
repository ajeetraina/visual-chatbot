# Docker MCP Integration Troubleshooting Guide

## Quick Fixes

### 1. Fix the Current Build Error

The error you encountered was due to a non-existent npm package. This has been fixed in the latest commits:

```bash
# Pull the latest changes
git pull origin main

# Rebuild with the fixed Dockerfile
docker-compose build mcp-bridge

# Start the stack
docker-compose up -d
```

### 2. Verify Everything is Working

```bash
# Check all services are running
docker-compose ps

# Test health endpoints
curl http://localhost:3001/health  # MCP bridge
curl http://localhost:3000/health  # Visual chatbot

# Check for Docker MCP tools in the UI
open http://localhost:3000
```

## Common Issues and Solutions

### Issue: "Package @ajeetraina/docker-mcp not found"

**Solution**: This package doesn't exist. Use the Docker CLI directly.

```dockerfile
# ❌ Wrong (causes error):
RUN npm install -g @ajeetraina/docker-mcp

# ✅ Correct (already fixed):
RUN apt-get update && apt-get install -y docker-ce-cli
```

### Issue: "Bridge health check failed"

**Symptoms**: MCP bridge container not responding
**Solution**:

```bash
# Check bridge container status
docker-compose ps mcp-bridge

# View bridge logs
docker-compose logs mcp-bridge

# Restart bridge if needed
docker-compose restart mcp-bridge
```

### Issue: "Docker socket permission denied"

**Symptoms**: Bridge can't execute Docker commands
**Solution**:

```bash
# Fix Docker socket permissions (Linux/Mac)
sudo chmod 666 /var/run/docker.sock

# Or add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Restart bridge after fixing permissions
docker-compose restart mcp-bridge
```

### Issue: "No Docker MCP tools visible in UI"

**Symptoms**: Visual chatbot doesn't show Docker tools
**Solution**:

1. **Check bridge connectivity**:
   ```bash
   # From visual-chatbot container
   docker-compose exec visual-chatbot curl http://mcp-bridge:3001/health
   ```

2. **Manually add Docker MCP gateway**:
   - Go to http://localhost:3000
   - Click "MCP servers" section
   - Click "+ Add Docker MCP Gateway"
   - Select "extension" type

3. **Check environment variable**:
   ```bash
   # Verify bridge URL is set
   docker-compose exec visual-chatbot env | grep MCP_BRIDGE_URL
   ```

### Issue: "Docker MCP extension not found"

**Symptoms**: `docker mcp` commands don't work
**Solution**:

```bash
# Option 1: Install Docker Desktop MCP extension
# 1. Open Docker Desktop
# 2. Go to Extensions
# 3. Search "MCP Toolkit"
# 4. Install it

# Option 2: The bridge works without the extension
# Basic Docker commands will still work via the bridge
```

## Debugging Commands

### Health Checks

```bash
# Check all service health
docker-compose ps
docker-compose logs --tail=20

# Test MCP bridge directly
curl -v http://localhost:3001/health

# Test Docker command via bridge
curl -X POST http://localhost:3001/tools/docker \
  -H "Content-Type: application/json" \
  -d '{"args": ["--version"]}'
```

### Container Debugging

```bash
# Get shell access to bridge
docker-compose exec mcp-bridge bash

# Test Docker from inside bridge container
docker-compose exec mcp-bridge docker --version
docker-compose exec mcp-bridge docker ps

# Check if MCP tools are available
docker-compose exec mcp-bridge docker mcp --help 2>/dev/null || echo "MCP extension not installed"
```

### Network Debugging

```bash
# Test network connectivity
docker-compose exec visual-chatbot ping mcp-bridge
docker-compose exec visual-chatbot curl http://mcp-bridge:3001/health

# Check network configuration
docker network ls
docker network inspect visual-chatbot-network
```

## Manual Testing

### Test Bridge Standalone

```bash
cd mcp-bridge
npm install
node mcp-http-bridge.js &

# Test endpoints
curl http://localhost:3001/health
curl -X POST http://localhost:3001/tools/docker \
  -H "Content-Type: application/json" \
  -d '{"args": ["--version"]}'

# Kill test server
pkill -f mcp-http-bridge.js
```

### Test Visual Chatbot Integration

```bash
# Start with docker-compose
docker-compose up -d

# Check if tools are loaded
curl http://localhost:3000/api/tools | jq '.[] | select(.name | contains("docker"))'

# Test in browser
open http://localhost:3000
# Look for Docker MCP tools in the "Tool graph" section
```

## Environment Setup

### Development Environment

```bash
# Create .env file for development
cat > .env << EOF
NODE_ENV=development
MCP_BRIDGE_URL=http://localhost:3001
DEBUG=1
EOF

# Start bridge in development mode
cd mcp-bridge
npm run dev &

# Start chatbot in development mode
cd api
npm run dev
```

### Production Environment

```bash
# Use docker-compose for production
docker-compose -f docker-compose.yml up -d

# Monitor logs
docker-compose logs -f
```

## Success Indicators

You know everything is working when:

✅ **Services are healthy**:
- `docker-compose ps` shows all services as "Up" and "healthy"
- Bridge responds to `curl http://localhost:3001/health`
- Chatbot responds to `curl http://localhost:3000/health`

✅ **Docker MCP tools are available**:
- Visit http://localhost:3000
- Click "Tool graph" - shows Docker MCP tools
- MCP servers section shows "docker-mcp" server

✅ **Tools work in chat**:
- Try asking: "Show me running Docker containers"
- Try asking: "List the files in the visual-chatbot repository"
- Tools execute successfully and return results

## Getting Help

If you're still having issues:

1. **Check the logs**: `docker-compose logs`
2. **Run the test script**: `./test-mcp-bridge.sh`
3. **Open an issue** on GitHub with:
   - Output of `docker-compose ps`
   - Output of `docker-compose logs`
   - Your operating system and Docker version
   - Steps to reproduce the issue

## Alternative Solutions

### Run Bridge on Host

If containers are problematic:

```bash
# Run bridge directly on host
cd mcp-bridge
npm install
node mcp-http-bridge.js &

# Update docker-compose.yml environment:
# MCP_BRIDGE_URL=http://host.docker.internal:3001

# Start only the chatbot container
docker-compose up visual-chatbot
```

### Use Different Bridge Port

If port 3001 is in use:

```bash
# Edit mcp-bridge/mcp-http-bridge.js
# Change: const port = 3001;
# To:     const port = 3002;

# Update docker-compose.yml ports
# Change: - "3001:3001"
# To:     - "3002:3002"

# Update environment variable
# MCP_BRIDGE_URL=http://mcp-bridge:3002
```