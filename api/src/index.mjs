import express from 'express';
import http from 'http';
import { Server as SocketIo } from 'socket.io';
import dotenv from 'dotenv';
import { Configuration } from './config.mjs';
import { MessageStore } from './messageStore.mjs';
import { ToolStore } from './toolStore.mjs';
import { Tool } from './tool.mjs';
import { LlmClient } from './llmClient.mjs';
import { McpServer } from './mcpServer.mjs';
import { McpServerStore } from './mcpServerStore.mjs';
import { BackendOptions } from './backendOptions.mjs';

const app = express();
const server = http.createServer(app);
const io = new SocketIo(server);
dotenv.config();

const config = new Configuration();
const messageStore = new MessageStore();
const toolStore = new ToolStore();
const mcpServerStore = new McpServerStore();
const llmClient = new LlmClient(
  config, 
  messageStore, 
  toolStore
);

app.use(express.json());
app.use(express.static('public'));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: 'Visual Chatbot Ready',
    mcpServers: mcpServerStore.getAllServers().length,
    tools: toolStore.getTools().length
  });
});

app.get("/api", (req, res) => {
  res.json({ status: 'ok' });
});

app.get("/api/config", (req, res) => {
  BackendOptions.getConfigurations()
    .then(config => res.json(config));
});

app.post("/api/config", (req, res) => {
  if (!req.body.systemPrompt || !req.body.model || !req.body.endpoint) {
    res.status(400).json({ status: 'error', message: 'Missing required fields' });
    return;
  }

  if (req.body.apiKey)
    config.setApiKey(req.body.apiKey);

  config.setModel(req.body.model);
  config.setEndpoint(req.body.endpoint);  
  config.setSystemPrompt(req.body.systemPrompt);

  console.log("Config updated", config.toJSON());
  
  res.json(config.toJSON());
});

app.post("/api/messages", async (req, res) => {
  let message = req.body.message;

  await llmClient.sendMessage(message);
  res.json({ status: 'ok' });
});

app.delete("/api/messages", (req, res) => {
  if (req.body.message) {
    messageStore.deleteMessage(req.body.message);
  } else {
    messageStore.clearMessages();
  }
  res.json({ status: 'ok' });
});

// Enhanced MCP server endpoints
app.get("/api/mcp-servers", (req, res) => {
  res.json(mcpServerStore.toJSON());
});

app.post("/api/mcp-servers", async (req, res) => {
  try {
    const { name, config } = req.body;
    
    if (!name || !config) {
      return res.status(400).json({
        success: false,
        error: 'Name and config are required'
      });
    }
    
    const server = await mcpServerStore.addServer(name, config);
    
    // Re-register tools
    toolStore.clearTools();
    const allTools = mcpServerStore.getAllTools();
    allTools.forEach(tool => toolStore.addTool(tool));
    
    // Emit events
    io.emit('mcpServerAdded', server.toJSON());
    io.emit('tools', toolStore.getToolsJSON());
    
    res.json({
      success: true,
      server: server.toJSON(),
      toolCount: server.getTools().length
    });
  } catch (error) {
    console.error('Error adding MCP server:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Add Docker MCP Gateway endpoint
app.post('/api/mcp-servers/docker-gateway', async (req, res) => {
  try {
    const { type = 'extension' } = req.body;
    
    const server = await mcpServerStore.addDockerMcpGateway(type);
    
    // Re-register tools
    toolStore.clearTools();
    const allTools = mcpServerStore.getAllTools();
    allTools.forEach(tool => toolStore.addTool(tool));
    
    // Emit events
    io.emit('mcpServerAdded', server.toJSON());
    io.emit('tools', toolStore.getToolsJSON());
    
    res.json({
      success: true,
      server: server.toJSON(),
      toolCount: server.getTools().length
    });
  } catch (error) {
    console.error('Error adding Docker MCP gateway:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.delete("/api/mcp-servers/:name", async (req, res) => {
  try {
    const { name } = req.params;
    await mcpServerStore.removeServer(name);
    
    // Re-register remaining tools
    toolStore.clearTools();
    const allTools = mcpServerStore.getAllTools();
    allTools.forEach(tool => toolStore.addTool(tool));
    
    // Emit events
    io.emit('mcpServerRemoved', { name });
    io.emit('tools', toolStore.getToolsJSON());
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing MCP server:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Legacy MCP server endpoint (for backwards compatibility)
app.post("/api/mcp-servers-legacy", async (req, res) => {
  if (!req.body.name || !req.body.command || !req.body.args) {
    res.status(400).json({ status: 'error', message: 'Missing required fields' });
    return;
  }

  try {
    const server = await mcpServerStore.addServer(req.body.name, {
      command: req.body.command,
      args: req.body.args
    });
    
    // Re-register tools
    toolStore.clearTools();
    const allTools = mcpServerStore.getAllTools();
    allTools.forEach(tool => toolStore.addTool(tool));
    
    io.emit('mcpServerAdded', server.toJSON());
    io.emit('tools', toolStore.getToolsJSON());
    
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: "Unable to start MCP server. Validate the startup command. " + e.message });
    return;
  }
});

app.post("/api/ai-tool-creation", async (req, res) => {
  const tool = new Tool(
    "tool-creator",
    "Use this tool to create a new tool when you need additional information",
    {
      type: "object",
      properties: {
        name: { 
          type: "string",
          description: "The name of the new tool to create. If this name already exists, the previous tool will be overwritten.",
        },
        description: { 
          type: "string",
          description: "A description of the new tool to create",
        },
        code: { 
         type: "string",
          description: "A JavaScript function body that will be executed when the tool is invoked. The code will be wrapped in an async function header that will provide the specified parameters as arguments. The code's return will be the output of the tool, so must provide a return.",
        },
        parameters: { 
          type: "object" ,
          description: "An object containing the parameters that the function will accept (per the tools API specification)",
        }
      },
      required: ["name", "description", "code", "parameters"],
    },
    "local",
    async (args) => {
      addLocalTool(args.name, args.description, args.code, args.parameters);
      return "Tool created";
    }
  );

  toolStore.addTool(tool);
  io.emit('toolAdded', tool.toJSON());
  res.json({ status: 'ok' });
});

app.delete("/api/ai-tool-creation", (req, res) => {
  toolStore.removeToolByName("tool-creator");
  io.emit('toolRemoved', { name: "tool-creator" });
  res.json({ status: 'ok' });
});

app.post("/api/tools", async (req, res) => {
  if (!req.body.name || !req.body.description || !req.body.code || !req.body.parameters) {
    res.status(400).json({ status: 'error', message: 'Missing required fields' });
    return;
  }

  addLocalTool(req.body.name, req.body.description, req.body.code, req.body.parameters);

  res.json({ status: 'ok' });
});

app.delete("/api/tools", async (req, res) => {
  if (!req.body.name) {
    res.status(400).json({ status: 'error', message: 'Missing required fields' });
    return;
  }

  toolStore.removeToolByName(req.body.name);
  io.emit('toolRemoved', { name: req.body.name });
  res.json({ status: 'ok' });
})

function addLocalTool(name, description, code, parameters) {
  const requestedParameters = Object.keys(parameters?.properties || {});
  const f = new Function( `return async function( ${requestedParameters.join(", ")} ) {
    ${code}
  }`);

  const onExecute = async function(incomingArgs) {
    try {
      return await f.call(null).apply(null, requestedParameters.map(p => incomingArgs[p]));
    } catch (e) {
      return JSON.stringify({
        success: false,
        errorMessage: e.message,
      });
    }
  };

  const tool = new Tool(
    name,
    description,
    parameters,
    "local",
    onExecute,
  );

  toolStore.addTool(tool);
  io.emit('toolAdded', tool.toJSON());
}

function addSystemPrompt() {
  messageStore.addMessage(
    { role: "system", content: config.systemPrompt }
  );
}

function setupEventListeners() {
  messageStore.onNewMessage(message => io.emit('newMessage', message));
  messageStore.onMessageDeleted(message => io.emit('messageDeleted', message));
  messageStore.onMessagesCleared(() => io.emit('messages', []));
  messageStore.onMessagesCleared(() => addSystemPrompt());
  toolStore.onToolAdded(tool => io.emit('toolAdded', tool.toJSON()));
  toolStore.onRemovedTool(tool => io.emit('toolRemoved', tool.toJSON()));
  
  io.on('connection', (client) => {
    client.emit('config', config.toJSON());
    client.emit('messages', messageStore.getMessages());
    client.emit('tools', toolStore.getToolsJSON());
    client.emit('mcpServers', mcpServerStore.toJSON());
  });
}

// Initialize MCP servers
async function initializeMcpServers() {
  try {
    // Add weather MCP server (traditional stdio)
    await mcpServerStore.addServer('weather', {
      command: 'node',
      args: ['../sample-mcp-server/src/index.js']
    });

    // Add database MCP server (traditional stdio) 
    await mcpServerStore.addServer('database', {
      command: 'docker',
      args: ['run', '--rm', '-i', 'mikesir87/mcp-sqlite-demo']
    });

    // Try to add Docker MCP gateway via HTTP bridge
    try {
      const bridgeUrl = process.env.MCP_BRIDGE_URL || 'http://mcp-bridge:3001';
      await mcpServerStore.addServer('docker-mcp', {
        type: 'http',
        baseUrl: bridgeUrl
      });
      console.log('✅ Docker MCP bridge connected successfully');
    } catch (error) {
      console.warn('⚠️  Docker MCP bridge not available:', error.message);
      console.log('   You can add it later via the UI when the bridge is running');
    }

    // Register all tools
    toolStore.clearTools();
    const allTools = mcpServerStore.getAllTools();
    allTools.forEach(tool => toolStore.addTool(tool));
    
    console.log(`Initialized ${allTools.length} tools from ${mcpServerStore.getAllServers().length} MCP servers`);
  } catch (error) {
    console.error('Error initializing MCP servers:', error);
  }
}

// Use PORT environment variable or default to 3003
const PORT = process.env.PORT || 3003;

server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  setupEventListeners();
  addSystemPrompt();
  await initializeMcpServers();
});

["SIGINT", "SIGTERM"].forEach(signal => {
  process.on(signal, async () => {
    await mcpServerStore.shutdown();
    server.close();
    process.exit();
  });
});