// httpMcpServer.mjs - HTTP-based MCP server for visual chatbot
import { Tool } from "./tool.mjs";

export class HttpMcpServer {
  constructor(name, baseUrl) {
    this.name = name;
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.tools = [];
  }

  async bootstrap() {
    try {
      // Health check to verify bridge is accessible
      const healthResponse = await fetch(`${this.baseUrl}/health`);
      if (!healthResponse.ok) {
        throw new Error(`Bridge health check failed: ${healthResponse.status}`);
      }
      
      const healthData = await healthResponse.json();
      console.log(`Connected to MCP HTTP Bridge: ${healthData.status}`);
      
      // For Docker MCP, we'll manually define the available tools
      // since we can't dynamically discover them via HTTP bridge
      await this.#initializeDockerMcpTools();
      
    } catch (error) {
      console.error(`Error connecting to HTTP MCP bridge at ${this.baseUrl}:`, error);
      throw error;
    }
  }

  async #initializeDockerMcpTools() {
    // Define Docker MCP tools based on the toolkit
    const dockerTools = [
      {
        name: "docker",
        description: "Execute Docker CLI commands",
        inputSchema: {
          type: "object",
          properties: {
            args: {
              type: "array",
              items: { type: "string" },
              description: "Arguments to pass to the Docker command"
            }
          },
          required: ["args"]
        }
      },
      {
        name: "kubectl_get",
        description: "Get or list Kubernetes resources",
        inputSchema: {
          type: "object",
          properties: {
            resourceType: {
              type: "string",
              description: "Type of resource to get (e.g., pods, deployments, services)"
            },
            name: {
              type: "string", 
              description: "Name of the resource (optional)"
            },
            namespace: {
              type: "string",
              default: "default",
              description: "Namespace of the resource"
            }
          },
          required: ["resourceType", "name", "namespace"]
        }
      },
      {
        name: "kubectl_describe",
        description: "Describe Kubernetes resources",
        inputSchema: {
          type: "object",
          properties: {
            resourceType: {
              type: "string",
              description: "Type of resource to describe"
            },
            name: {
              type: "string",
              description: "Name of the resource to describe"
            },
            namespace: {
              type: "string",
              default: "default"
            }
          },
          required: ["resourceType", "name"]
        }
      },
      {
        name: "get_file_contents",
        description: "Get contents of a file from GitHub repository",
        inputSchema: {
          type: "object",
          properties: {
            owner: { type: "string", description: "Repository owner" },
            repo: { type: "string", description: "Repository name" },
            path: { type: "string", description: "Path to file/directory" },
            branch: { type: "string", description: "Branch to get contents from" }
          },
          required: ["owner", "repo", "path"]
        }
      },
      {
        name: "create_or_update_file",
        description: "Create or update a file in GitHub repository",
        inputSchema: {
          type: "object",
          properties: {
            owner: { type: "string", description: "Repository owner" },
            repo: { type: "string", description: "Repository name" },
            path: { type: "string", description: "Path where to create/update the file" },
            content: { type: "string", description: "Content of the file" },
            message: { type: "string", description: "Commit message" },
            branch: { type: "string", description: "Branch to create/update the file in" }
          },
          required: ["owner", "repo", "path", "content", "message", "branch"]
        }
      },
      {
        name: "list_pull_requests",
        description: "List pull requests in a GitHub repository",
        inputSchema: {
          type: "object",
          properties: {
            owner: { type: "string", description: "Repository owner" },
            repo: { type: "string", description: "Repository name" },
            state: { 
              type: "string", 
              enum: ["open", "closed", "all"],
              description: "Filter by state" 
            }
          },
          required: ["owner", "repo"]
        }
      }
    ];

    // Convert to Tool objects
    this.tools = dockerTools.map(tool => new Tool(
      `${this.name}__${tool.name}`,
      tool.description,
      tool.inputSchema,
      "http-mcp",
      async (args) => {
        return await this.#callHttpMcpTool(tool.name, args);
      }
    ));
  }

  async #callHttpMcpTool(toolName, params) {
    try {
      console.log(`Calling HTTP MCP tool: ${toolName}`, params);
      
      const response = await fetch(`${this.baseUrl}/tools/${toolName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        // Return the data, preferring parsed JSON but falling back to stdout
        return typeof result.data === 'object' ? 
          JSON.stringify(result.data, null, 2) : 
          result.data || result.stdout;
      } else {
        throw new Error(result.error || 'Unknown error from MCP bridge');
      }
      
    } catch (error) {
      console.error(`Error calling HTTP MCP tool ${toolName}:`, error);
      return `Error: ${error.message}`;
    }
  }

  getTools() {
    return this.tools;
  }

  async shutdown() {
    // HTTP connections don't need explicit cleanup
    console.log(`HTTP MCP Server ${this.name} shutdown`);
  }

  toJSON() {
    return {
      name: this.name,
      type: "http-mcp",
      baseUrl: this.baseUrl,
      tools: this.tools.map(tool => ({ 
        name: tool.name, 
        description: tool.description 
      })),
    };
  }
}