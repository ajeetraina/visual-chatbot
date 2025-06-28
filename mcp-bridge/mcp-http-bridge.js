const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { spawn, exec } = require('child_process');
const { promisify } = require('util');

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for cross-origin requests
app.use(cors({
  origin: ['http://localhost:3003', 'http://visual-chatbot:3003'],
  credentials: true
}));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

const execAsync = promisify(exec);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'mcp-http-bridge',
    version: '1.0.0'
  });
});

// MCP Server information endpoint
app.get('/mcp/servers', (req, res) => {
  res.json({
    servers: [
      {
        name: 'docker-mcp',
        description: 'Docker MCP Toolkit integration',
        tools: [
          'docker',
          'kubectl_get',
          'kubectl_describe',
          'kubectl_logs',
          'get_file_contents',
          'create_or_update_file',
          'list_pull_requests',
          'create_issue'
        ]
      }
    ]
  });
});

// Docker command proxy
app.post('/docker/:command', async (req, res) => {
  try {
    const { command } = req.params;
    const { args = [] } = req.body;
    
    console.log(`Executing docker ${command} with args:`, args);
    
    const dockerArgs = [command, ...args];
    const { stdout, stderr } = await execAsync(`docker ${dockerArgs.join(' ')}`);
    
    res.json({
      success: true,
      stdout: stdout,
      stderr: stderr,
      command: `docker ${dockerArgs.join(' ')}`
    });
  } catch (error) {
    console.error('Docker command error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      command: `docker ${req.params.command}`
    });
  }
});

// Kubectl command proxy
app.post('/kubectl/:action', async (req, res) => {
  try {
    const { action } = req.params;
    const { resource, name, namespace = 'default', flags = [] } = req.body;
    
    let kubectlCmd = `kubectl ${action}`;
    if (resource) kubectlCmd += ` ${resource}`;
    if (name) kubectlCmd += ` ${name}`;
    if (namespace && namespace !== 'default') kubectlCmd += ` -n ${namespace}`;
    if (flags.length > 0) kubectlCmd += ` ${flags.join(' ')}`;
    
    console.log(`Executing: ${kubectlCmd}`);
    
    const { stdout, stderr } = await execAsync(kubectlCmd);
    
    res.json({
      success: true,
      stdout: stdout,
      stderr: stderr,
      command: kubectlCmd
    });
  } catch (error) {
    console.error('Kubectl command error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      command: `kubectl ${req.params.action}`
    });
  }
});

// GitHub file operations proxy
app.post('/github/file/:operation', async (req, res) => {
  try {
    const { operation } = req.params;
    const { repository, path, content, message } = req.body;
    
    // This would integrate with GitHub API
    // For now, return a mock response
    res.json({
      success: true,
      operation: operation,
      repository: repository,
      path: path,
      message: `${operation} operation completed for ${path}`
    });
  } catch (error) {
    console.error('GitHub operation error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      operation: req.params.operation
    });
  }
});

// MCP tool execution endpoint
app.post('/mcp/execute', async (req, res) => {
  try {
    const { tool, parameters } = req.body;
    
    console.log(`Executing MCP tool: ${tool} with parameters:`, parameters);
    
    switch (tool) {
      case 'docker':
        return await handleDockerTool(req, res, parameters);
      case 'kubectl_get':
        return await handleKubectlGet(req, res, parameters);
      case 'kubectl_describe':
        return await handleKubectlDescribe(req, res, parameters);
      case 'kubectl_logs':
        return await handleKubectlLogs(req, res, parameters);
      default:
        res.status(400).json({
          success: false,
          error: `Unknown tool: ${tool}`
        });
    }
  } catch (error) {
    console.error('MCP execution error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Tool handlers
async function handleDockerTool(req, res, parameters) {
  const { args = [] } = parameters;
  try {
    const { stdout, stderr } = await execAsync(`docker ${args.join(' ')}`);
    res.json({
      success: true,
      result: stdout,
      stderr: stderr,
      tool: 'docker'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      tool: 'docker'
    });
  }
}

async function handleKubectlGet(req, res, parameters) {
  const { resourceType, name, namespace = 'default', output = 'json' } = parameters;
  try {
    let cmd = `kubectl get ${resourceType}`;
    if (name) cmd += ` ${name}`;
    cmd += ` -n ${namespace} -o ${output}`;
    
    const { stdout, stderr } = await execAsync(cmd);
    res.json({
      success: true,
      result: stdout,
      stderr: stderr,
      tool: 'kubectl_get'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      tool: 'kubectl_get'
    });
  }
}

async function handleKubectlDescribe(req, res, parameters) {
  const { resourceType, name, namespace = 'default' } = parameters;
  try {
    const cmd = `kubectl describe ${resourceType} ${name} -n ${namespace}`;
    const { stdout, stderr } = await execAsync(cmd);
    res.json({
      success: true,
      result: stdout,
      stderr: stderr,
      tool: 'kubectl_describe'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      tool: 'kubectl_describe'
    });
  }
}

async function handleKubectlLogs(req, res, parameters) {
  const { name, namespace = 'default', container, tail = 100 } = parameters;
  try {
    let cmd = `kubectl logs ${name} -n ${namespace} --tail=${tail}`;
    if (container) cmd += ` -c ${container}`;
    
    const { stdout, stderr } = await execAsync(cmd);
    res.json({
      success: true,
      result: stdout,
      stderr: stderr,
      tool: 'kubectl_logs'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      tool: 'kubectl_logs'
    });
  }
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: error.message
  });
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 MCP HTTP Bridge running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 MCP servers: http://localhost:${PORT}/mcp/servers`);
  console.log(`🐳 Docker commands: POST http://localhost:${PORT}/docker/:command`);
  console.log(`☸️  Kubectl commands: POST http://localhost:${PORT}/kubectl/:action`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 MCP Bridge shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📴 MCP Bridge shutting down gracefully');
  process.exit(0);
});