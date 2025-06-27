// Enhanced mcpServerStore.mjs with HTTP MCP support
import { McpServer } from "./mcpServer.mjs";
import { HttpMcpServer } from "./httpMcpServer.mjs";

export class McpServerStore {
  constructor() {
    this.servers = {};
  }

  async addServer(name, config) {
    try {
      let server;
      
      if (config.type === 'http') {
        // HTTP-based MCP server (like Docker MCP bridge)
        server = new HttpMcpServer(name, config.baseUrl);
      } else {
        // Traditional stdio-based MCP server
        server = new McpServer(name, config.command, config.args);
      }
      
      await server.bootstrap();
      this.servers[name] = server;
      
      console.log(`Added MCP server: ${name} (${config.type || 'stdio'})`);
      return server;
    } catch (error) {
      console.error(`Failed to add MCP server ${name}:`, error);
      throw error;
    }
  }

  async addDockerMcpGateway(type = 'extension') {
    const name = `docker-mcp-${type}`;
    
    // Check if bridge is running on host
    const bridgeUrl = type === 'extension' ? 
      'http://host.docker.internal:3001' : 
      'http://localhost:3001';
    
    try {
      // Test connectivity
      const response = await fetch(`${bridgeUrl}/health`, {
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      if (!response.ok) {
        throw new Error(`Bridge not responding: ${response.status}`);
      }
      
      await this.addServer(name, {
        type: 'http',
        baseUrl: bridgeUrl
      });
      
      return this.servers[name];
    } catch (error) {
      console.error(`Failed to connect to Docker MCP bridge at ${bridgeUrl}:`, error);
      throw new Error(`Docker MCP bridge not available. Please ensure:\n1. MCP bridge is running on port 3001\n2. Docker is accessible from the bridge\n\nError: ${error.message}`);
    }
  }

  getServer(name) {
    return this.servers[name];
  }

  getAllServers() {
    return Object.values(this.servers);
  }

  getAllTools() {
    return Object.values(this.servers).flatMap(server => server.getTools());
  }

  async removeServer(name) {
    if (this.servers[name]) {
      await this.servers[name].shutdown();
      delete this.servers[name];
      console.log(`Removed MCP server: ${name}`);
    }
  }

  async shutdown() {
    const shutdownPromises = Object.values(this.servers).map(server => 
      server.shutdown().catch(error => 
        console.error(`Error shutting down server:`, error)
      )
    );
    
    await Promise.all(shutdownPromises);
    this.servers = {};
  }

  toJSON() {
    return {
      servers: Object.fromEntries(
        Object.entries(this.servers).map(([name, server]) => [name, server.toJSON()])
      )
    };
  }
}