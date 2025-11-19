# Agent Server

Python FastAPI server for running browser automation agents (Skyvern and Browser-Use) with background task execution and Convex integration.

## Features

- **Skyvern Agent**: AI-powered web automation using computer vision
- **Browser-Use Agent**: Multi-step browser automation with LLM reasoning
- **Notte Agent**: Cloud browser sessions powered by the Notte Python SDK
- **Background Execution**: Tasks run asynchronously, returning immediately with session info
- **Convex Integration**: Persistent storage and real-time updates
- **Live Browser URLs**: Watch agents work in real-time via live browser preview

## Setup

1. **Install Dependencies**

```bash
# Make sure you're using Python 3.12+
uv sync
```

2. **Configure Environment Variables**

Copy `.env.example` to `../.env.local` in the project root:

```bash
cp .env.example ../.env.local
```

Edit `../.env.local` with your API keys:

- `CONVEX_URL`: Your Convex deployment URL
- `ANCHOR_API_KEY`: Your Anchor Browser API key
- `NOTTE_API_KEY`: Your Notte API key (required to enable the Notte agent)
- `BROWSER_USE_API_KEY`: Your Browser-Use API key (optional)

3. **Run the Server**

```bash
# From the agents directory
python server.py

# Or with uvicorn directly
uvicorn server:app --reload --host 0.0.0.0 --port 8080
```

The server will start on `http://localhost:8080`

## API Endpoints

### Health Check

```bash
GET /
```

Returns server status and available agents.

### Run Notte Agent

```bash
POST /agent/notte
Content-Type: application/json

{
  "sessionId": "convex_session_id",
  "instruction": "Summarize today's top tech stories",
  "providerModel": "google/gemini-2.5-flash",
  "maxSteps": 20
}
```

**Response:**

```json
{
  "sessionId": "convex_session_id",
  "agentId": "agent_id_from_convex",
  "browserSessionId": "notte_session_id",
  "liveUrl": "https://viewer.notte.cc/session/..."
}
```

### Run Skyvern Agent

```bash
POST /agent/skyvern
Content-Type: application/json

{
  "sessionId": "convex_session_id",
  "instruction": "Find the top post on hackernews today",
  "providerModel": ""
}
```

**Response:**

```json
{
  "sessionId": "convex_session_id",
  "agentId": "agent_id_from_convex",
  "browserSessionId": "anchor_browser_session_id",
  "liveUrl": "https://live.anchorbrowser.io/session/..."
}
```

### Run Browser-Use Agent

```bash
POST /agent/browser-use
Content-Type: application/json

{
  "sessionId": "convex_session_id",
  "instruction": "Find companies that raised more than $10M in the US this month",
  "providerModel": "browser-use/bu-1.0"
}
```

**Response:**

```json
{
  "sessionId": "convex_session_id",
  "agentId": "agent_id_from_convex",
  "browserSessionId": "anchor_browser_session_id",
  "liveUrl": "https://live.anchorbrowser.io/session/..."
}
```

## Provider Models

For Browser-Use agent, you can specify different LLM providers:

- `"browser-use/bu-1.0"` - Browser-Use hosted model (default)
- `"openai/gpt-4"` - OpenAI GPT-4
- `"anthropic/claude-3-opus"` - Anthropic Claude
- `"google/gemini-pro"` - Google Gemini

## Architecture

1. **Request Flow:**
   - Client sends instruction + sessionId to agent endpoint
   - Server creates Anchor Browser session
   - Server creates agent record in Convex
   - Server returns session info + live URL immediately
   - Agent runs in background

2. **Background Execution:**
   - Agent task runs asynchronously
   - Updates Convex with status changes
   - Updates Convex with final result
   - Cleans up browser session when done

3. **Error Handling:**
   - Failures are captured and stored in Convex
   - Browser sessions are cleaned up on completion/error

## Development

### Run Individual Agents

**Skyvern:**

```bash
cd skyvern_agent
python main.py
```

**Browser-Use:**

```bash
cd browser_use_agent
python main.py
```

### Testing

```bash
# Test health check
curl http://localhost:8080/

# Test Notte endpoint
curl -X POST http://localhost:8080/agent/notte \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AGENT_SERVER_API_KEY" \
  -d '{
    "sessionId": "your_convex_session_id",
    "instruction": "Summarize the latest AI breakthroughs",
    "providerModel": "google/gemini-2.5-flash"
  }'

# Test Skyvern endpoint
curl -X POST http://localhost:8080/agent/skyvern \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "your_convex_session_id",
    "instruction": "Find the top post on hackernews",
    "providerModel": ""
  }'

# Test Browser-Use endpoint
curl -X POST http://localhost:8080/agent/browser-use \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "your_convex_session_id",
    "instruction": "Search for AI news on Google",
    "providerModel": "browser-use/bu-1.0"
  }'
```

## Convex Integration

The server uses these Convex mutations (no auth required for backend):

- `mutations:createAgentFromBackend` - Creates agent record
- `mutations:updateAgentStatusFromBackend` - Updates agent status
- `mutations:updateAgentResultFromBackend` - Stores final result

Make sure these mutations are deployed in your Convex backend.

## Troubleshooting

**Import Errors:**

Make sure you're in the agents directory when running the server:

```bash
cd agents
python server.py
```

**Convex Connection Issues:**

Verify your `CONVEX_URL` is correct and the Convex deployment is running:

```bash
# In the project root
npx convex dev
```

**Anchor Browser Issues:**

Verify your `ANCHOR_API_KEY` is valid. Test with the individual agent scripts first.

## License

MIT

