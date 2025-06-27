#!/bin/bash

# test-mcp-bridge.sh - Script to test MCP bridge functionality

set -e

echo "🔧 Setting up MCP Bridge test environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

print_status "Docker is running"

# Check if docker mcp command is available
if ! docker mcp --help > /dev/null 2>&1; then
    print_warning "Docker MCP extension not found. Installing..."
    
    # Try to install Docker MCP extension if not available
    if ! docker extension install docker/mcp-toolkit:latest 2>/dev/null; then
        print_error "Failed to install Docker MCP extension. Manual installation required:"
        echo "1. Open Docker Desktop"
        echo "2. Go to Extensions"
        echo "3. Search for 'MCP Toolkit'"
        echo "4. Install it"
        echo ""
        echo "Alternatively, the bridge will still work with basic Docker commands"
    fi
else
    print_status "Docker MCP extension is available"
fi

# Create mcp-bridge directory if it doesn't exist
if [ ! -d "mcp-bridge" ]; then
    mkdir -p mcp-bridge
    print_status "Created mcp-bridge directory"
fi

# Copy your mcp-http-bridge.js if it exists
if [ -f "mcp-http-bridge.js" ]; then
    cp mcp-http-bridge.js mcp-bridge/
    print_status "Copied mcp-http-bridge.js to mcp-bridge directory"
elif [ ! -f "mcp-bridge/mcp-http-bridge.js" ]; then
    print_error "mcp-http-bridge.js not found. Please ensure it's in the current directory or mcp-bridge/ directory"
    exit 1
fi

# Test the bridge locally first
echo ""
echo "🧪 Testing MCP bridge locally..."

cd mcp-bridge

# Install dependencies
if [ ! -d "node_modules" ]; then
    npm install
    print_status "Installed bridge dependencies"
fi

# Test Docker availability
docker --version > /dev/null 2>&1 && print_status "Docker CLI is available" || print_error "Docker CLI not available"

# Start the bridge in background for testing
echo "Starting MCP bridge for testing..."
node mcp-http-bridge.js &
BRIDGE_PID=$!

# Wait for bridge to start
sleep 3

# Test health endpoint
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    print_status "MCP bridge health check passed"
else
    print_error "MCP bridge health check failed"
fi

# Test a simple Docker command via bridge
echo "Testing Docker command via bridge..."
if curl -X POST http://localhost:3001/tools/docker \
    -H "Content-Type: application/json" \
    -d '{"args": ["--version"]}' > /dev/null 2>&1; then
    print_status "Docker command test passed"
else
    print_warning "Docker command test failed (may be normal if no MCP extension)"
fi

# Stop the test bridge
kill $BRIDGE_PID 2>/dev/null || true

cd ..

echo ""
echo "🚀 Setup complete! Next steps:"
echo "1. Run: docker-compose up -d"
echo "2. Visit: http://localhost:3000"
echo "3. Check MCP servers in the UI and add Docker MCP gateway"
echo ""
echo "🔍 Troubleshooting:"
echo "- Bridge logs: docker-compose logs mcp-bridge"
echo "- Test bridge: curl http://localhost:3001/health"
echo "- Test Docker MCP: docker mcp tools list (if extension installed)"