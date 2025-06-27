// Integration patch for HTTP MCP support in existing visual-chatbot
// Add this to your existing index.mjs imports
import { HttpMcpServer } from './httpMcpServer.mjs';

// Add these new API endpoints to your existing route handlers:

// Add Docker MCP Gateway endpoint (add this after existing /api/mcp-servers routes)
app.post('/api/mcp-servers/docker-gateway', async (req, res) => {
  try {
    const { type = 'extension' } = req.body;
    
    // Determine bridge URL based on type
    const bridgeUrl = type === 'extension' ? 
      'http://host.docker.internal:3001' : 
      'http://localhost:3001';
    
    // Test connectivity first
    const testResponse = await fetch(`${bridgeUrl}/health`, {
      signal: AbortSignal.timeout(5000)
    });
    
    if (!testResponse.ok) {
      throw new Error(`Bridge not responding: ${testResponse.status}`);
    }
    
    // Create HTTP MCP server
    const name = `docker-mcp-${type}`;
    const httpServer = new HttpMcpServer(name, bridgeUrl);
    await httpServer.bootstrap();
    
    // Add to store using the existing pattern
    mcpServerStore.addMcpServer(httpServer);
    
    res.json({ 
      status: 'ok', 
      message: 'Docker MCP Gateway connected successfully',
      server: httpServer.toJSON()
    });
    
  } catch (error) {
    console.error('Failed to add Docker MCP gateway:', error);
    res.status(500).json({ 
      status: 'error', 
      message: `Docker MCP bridge not available. Please ensure:\n1. MCP bridge is running on port 3001\n2. Docker is accessible from the bridge\n\nError: ${error.message}`
    });
  }
});

// Enhanced MCP server creation to support HTTP type (update existing route)
const originalMcpServerRoute = app.post("/api/mcp-servers", async (req, res) => {
  // Handle HTTP MCP servers
  if (req.body.type === 'http') {
    if (!req.body.name || !req.body.baseUrl) {
      res.status(400).json({ status: 'error', message: 'Missing required fields for HTTP MCP server' });
      return;
    }

    try {
      const httpServer = new HttpMcpServer(req.body.name, req.body.baseUrl);
      await httpServer.bootstrap();
      mcpServerStore.addMcpServer(httpServer);
      res.json({ status: 'ok', type: 'http' });
    } catch (e) {
      res.status(500).json({ status: 'error', message: "Unable to start HTTP MCP server: " + e.message });
      return;
    }
  }
  
  // Keep existing stdio MCP server logic
  else {
    if (!req.body.name || !req.body.command || !req.body.args) {
      res.status(400).json({ status: 'error', message: 'Missing required fields' });
      return;
    }

    try {
      const server = new McpServer(req.body.name, req.body.command, req.body.args);
      await server.bootstrap();
      mcpServerStore.addMcpServer(server);
      res.json({ status: 'ok', type: 'stdio' });
    } catch (e) {
      res.status(500).json({ status: 'error', message: "Unable to start MCP server. Validate the startup command. " + e.message });
      return;
    }
  }
});

// Update the MCP server store initialization in your startup function
// Add this initialization code after your existing setup:

async function initializeDockerMcpBridge() {
  try {
    // Try to connect to Docker MCP bridge
    const bridgeUrl = process.env.MCP_BRIDGE_URL || 'http://mcp-bridge:3001';
    
    const testResponse = await fetch(`${bridgeUrl}/health`, {
      signal: AbortSignal.timeout(5000)
    });
    
    if (testResponse.ok) {
      const httpServer = new HttpMcpServer('docker-mcp-auto', bridgeUrl);
      await httpServer.bootstrap();
      mcpServerStore.addMcpServer(httpServer);
      console.log('✅ Docker MCP bridge connected automatically');
    }
  } catch (error) {
    console.log('⚠️  Docker MCP bridge not available at startup - can be added manually via UI');
  }
}

// Call this in your server startup (add after existing initialization):
// initializeDockerMcpBridge();

// Add health endpoint if not already present
app.get('/health', (req, res) => {
  res.json({ 
    status: 'Visual Chatbot Ready',
    mcpServers: mcpServerStore.getMcpServers().length,
    tools: toolStore.getTools().length
  });
});