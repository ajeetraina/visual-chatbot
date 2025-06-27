# Visual Chatbot

This project provides a simple chatbot webapp that is intended to help educate folks on how LLM-based interactions occur. This chatbot displays _all_ messages going back and forth from the LLM, including system messages and tool execution requests and responses.

Additional features include:

- **System prompt adjusting/rebasing** - see how a conversation would change if you changed the initial system prompt
- **Dynamic tool creation** - add custom tools in the middle of a conversation to give the LLM new abilities
- **MCP support** - add tools by starting MCP servers
- **Docker MCP integration** - connect to Docker and Kubernetes tools via HTTP bridge
- **AI-generated tools** - give the LLM the ability to create a tool, which it then can execute

## Quick start

### Option 1: Docker Compose (Recommended with MCP Bridge)

```console
# Clone the repository
git clone https://github.com/ajeetraina/visual-chatbot.git
cd visual-chatbot

# Test MCP bridge setup (optional)
chmod +x test-mcp-bridge.sh
./test-mcp-bridge.sh

# Start the complete stack
docker-compose up -d

# Access the application
open http://localhost:3003
```

This will start:
- **Visual Chatbot** on port 3003
- **MCP HTTP Bridge** on port 3001 with Docker socket access

### Option 2: Simple Docker Run

```console
docker run -dp 3003:3003 -v /var/run/docker.sock:/var/run/docker.sock mikesir87/visual-chatbot
```

**NOTE:** The Docker socket is mounted to allow the tool to launch containerized MCP servers

Once the container has started, you can open the app at http://localhost:3003/.

## Docker MCP Integration

### What is the MCP Bridge?

The **MCP HTTP Bridge** solves the problem of accessing Docker MCP tools from within containers. Traditional MCP servers use stdio transport, but Docker MCP requires Docker socket access which is complex to manage in containerized environments.

### Features

- ✅ **Docker CLI Tools** - Execute Docker commands
- ✅ **Kubernetes Tools** - kubectl get, describe, logs, etc.
- ✅ **GitHub Integration** - File operations, PR management
- ✅ **HTTP Interface** - Easy debugging and monitoring
- ✅ **Container Isolation** - Secure separation of concerns

### Architecture

```
┌─────────────────┐    HTTP    ┌─────────────────┐    Docker    ┌─────────────┐
│  Visual Chatbot │ ────────► │  MCP HTTP Bridge │ ──────────► │ Docker MCP  │
│   (Port 3003)   │            │   (Port 3001)    │             │   Tools     │
└─────────────────┘            └─────────────────┘             └─────────────┘
```

### Adding Docker MCP Gateway

1. **Via UI**: Click "+ Add Docker MCP Gateway" in the MCP servers section
2. **Automatic**: Bridge connects automatically if running via docker-compose
3. **Manual**: Add server with `http://mcp-bridge:3001` as base URL

### Available Tools

Once connected, you'll see Docker MCP tools like:
- `docker-mcp__docker` - Docker CLI commands
- `docker-mcp__kubectl_get` - Kubernetes resource queries
- `docker-mcp__get_file_contents` - GitHub file operations
- `docker-mcp__create_or_update_file` - GitHub file management
- `docker-mcp__list_pull_requests` - GitHub PR management

## Troubleshooting

### MCP Bridge Issues

```bash
# Check if bridge is healthy
curl http://localhost:3001/health

# Check if chatbot is healthy
curl http://localhost:3003/health

# View bridge logs
docker-compose logs mcp-bridge

# Test Docker access from bridge
docker-compose exec mcp-bridge docker --version

# Check if MCP extension is installed
docker mcp --help
```

### Common Solutions

1. **Bridge not connecting**: Ensure Docker is running and MCP bridge container has socket access
2. **No Docker tools**: Check if bridge is healthy and properly configured
3. **Permission errors**: Verify Docker socket permissions (`chmod 666 /var/run/docker.sock`)
4. **Port conflicts**: Make sure ports 3001 and 3003 are available

### LLM configuration

The application obviously needs to have an LLM to operate against. 

#### OpenAI (default)

1. Obtain an OpenAI API key. The only required permission is the chat completions endpoint.
2. In the LLM configuration modal (which will launch at startup), enter the API key.

#### Ollama

In the LLM configuration modal, enter the following details:

1. **Endpoint:** http://host.docker.internal:11434/v1/chat/completions
   - This uses the `host.docker.internal` name since the app is running inside a container and needs to access Ollama running on the host
2. **Model:** - whatever model you want to use (such as `llama3.2`)
3. **API Key:** - enter anything... it won't be used but is currently a required field.

## Development

### Project Structure

```
visual-chatbot/
├── api/                    # Backend API
│   ├── src/
│   │   ├── httpMcpServer.mjs    # HTTP MCP server implementation
│   │   ├── mcpServerStore.mjs   # Enhanced MCP server store
│   │   └── ...
├── client/                 # Frontend React app
├── mcp-bridge/            # MCP HTTP bridge
│   ├── mcp-http-bridge.js      # Bridge implementation
│   └── package.json
├── docker-compose.yml     # Complete stack setup
├── Dockerfile.mcp-bridge  # Bridge container setup
└── test-mcp-bridge.sh    # Setup and test script
```

### Building from Source

```bash
# Install dependencies
cd api && npm install
cd ../client && npm install
cd ../mcp-bridge && npm install

# Build and start
docker-compose up --build
```

### Running on Different Ports

The application is configured to run on **port 3003** by default. To change the port:

1. **Via Environment Variable**:
   ```bash
   PORT=8080 docker-compose up
   ```

2. **Via docker-compose.yml**:
   ```yaml
   environment:
     - PORT=8080
   ports:
     - "8080:8080"
   ```

## Contributions

This project is mostly a for-fun training aid, so is likely fairly close to being "done." But, feel free to open an issue if you'd like and start a discussion.

Special thanks to the Docker MCP bridge implementation that enables seamless integration with Docker and Kubernetes tools!