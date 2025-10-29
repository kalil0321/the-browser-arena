# Python Agents Integration Setup

This guide explains how to set up and use the Python-based agents (Skyvern and Browser-Use) with your Next.js frontend.

## Architecture

```
Frontend (Next.js)
    ↓
Next.js API Routes (/api/agent/skyvern or /api/agent/browser-use)
    ↓
Python FastAPI Server (http://localhost:8080)
    ↓
Agent Execution (Skyvern or Browser-Use)
    ↓
Updates Convex Database
    ↓
Frontend Real-time Updates (via Convex subscriptions)
```

## Setup Steps

### 1. Environment Variables

Add to your `.env.local` file in the project root:

```bash
# Python Agent Server URL
AGENT_SERVER_URL=http://localhost:8080

# Already existing (make sure these are set):
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
ANCHOR_API_KEY=your_anchor_api_key
BROWSER_USE_API_KEY=your_browser_use_api_key  # Optional
```

### 2. Start the Python Agent Server

```bash
cd agents
./start.sh
```

The server will start on `http://localhost:8080`

### 3. Start Your Frontend

```bash
npm run dev
```

Your frontend will be available at `http://localhost:3000`

### 4. Start Convex

```bash
npx convex dev
```

## Usage

### From the UI

1. Go to `http://localhost:3000`
2. Enter your task in the input field
3. Select an agent from the dropdown:
   - **Stagehand** - TypeScript agent (runs in Next.js)
   - **Smooth** - TypeScript agent (runs in Next.js)
   - **Skyvern (Python)** - Computer vision-based agent
   - **Browser-Use (Python)** - LLM-powered browser agent
4. Click submit
5. Watch the live browser view and status updates in real-time!

### From the API

#### Skyvern

```bash
curl -X POST http://localhost:3000/api/agent/skyvern \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "instruction": "Find the top post on hackernews today",
    "model": ""
  }'
```

#### Browser-Use

```bash
curl -X POST http://localhost:3000/api/agent/browser-use \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "instruction": "Search for AI news on Google",
    "model": "browser-use/bu-1.0"
  }'
```

## API Response

Both endpoints return:

```json
{
  "session": {
    "id": "k17abc..."
  },
  "agentId": "k18def...",
  "liveViewUrl": "https://live.anchorbrowser.io/session/...",
  "browserSessionId": "anchor_session_id"
}
```

- **session.id**: Convex session ID (use to track in UI)
- **agentId**: Agent record ID in Convex
- **liveViewUrl**: Live browser preview URL
- **browserSessionId**: Anchor Browser session ID

## Real-time Updates

The frontend automatically subscribes to agent updates via Convex:

```typescript
// In your component
const agents = useQuery(api.queries.getSessionAgents, { 
  sessionId: session.id 
});

// agents will update in real-time with:
// - status: "pending" | "running" | "completed" | "failed"
// - result: final result when completed
// - recordingUrl: video recording (if available)
```

## Files Changed

### Frontend Files

1. **`src/app/api/agent/skyvern/route.ts`** - New Skyvern endpoint
2. **`src/app/api/agent/browser-use/route.ts`** - New Browser-Use endpoint
3. **`src/components/chat-input.tsx`** - Updated to include Python agents in dropdown

### Backend Files (Python)

4. **`agents/server.py`** - FastAPI server with agent endpoints
5. **`agents/skyvern_agent/`** - Skyvern agent module
6. **`agents/browser_use_agent/`** - Browser-Use agent module

### Convex Files

7. **`convex/mutations.ts`** - Added backend mutations:
   - `createAgentFromBackend`
   - `updateAgentStatusFromBackend`
   - `updateAgentResultFromBackend`

## Troubleshooting

### "Failed to connect to agent server"

**Solution**: Make sure the Python agent server is running:
```bash
cd agents
./start.sh
```

### "AGENT_SERVER_URL not found"

**Solution**: Add to `.env.local`:
```bash
AGENT_SERVER_URL=http://localhost:8080
```

### "Session not found" error

**Solution**: This usually means the Convex session was created but the Python server couldn't find it. Check:
1. Convex is running (`npx convex dev`)
2. `CONVEX_URL` is set correctly in `agents/.env.local`
3. Both `.env.local` files (root and agents/) have the same Convex URL

### Port conflicts

If port 8080 is in use, change it in:
1. `agents/server.py` (bottom of file, `port=8080`)
2. `.env.local` (`AGENT_SERVER_URL=http://localhost:YOUR_PORT`)

### Agent execution fails

Check the Python server logs for detailed error messages:
```bash
cd agents
.venv/bin/python server.py
```

## Testing

### Test the Python server directly:

```bash
# Health check
curl http://localhost:8080/

# Test Skyvern (requires valid sessionId from Convex)
curl -X POST http://localhost:8080/agent/skyvern \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "YOUR_CONVEX_SESSION_ID",
    "instruction": "Find the top post on hackernews",
    "providerModel": ""
  }'
```

### Test through the frontend API:

1. Start all services (Convex, Python server, Frontend)
2. Use the UI to submit a task
3. Check browser network tab for API calls
4. Check Python server logs for execution
5. Check Convex dashboard for database updates

## Production Deployment

### Python Server

Deploy the agent server to a cloud provider:

```bash
# Railway, Render, or similar
cd agents
# Deploy with start command: uvicorn server:app --host 0.0.0.0 --port 8080
```

### Environment Variables

Update production `.env`:

```bash
AGENT_SERVER_URL=https://your-agent-server.railway.app
```

### Security

Add API key authentication between frontend and Python server:

```python
# In server.py
from fastapi import Header, HTTPException

@app.post("/agent/skyvern")
async def run_skyvern_agent(
    request: AgentRequest,
    background_tasks: BackgroundTasks,
    x_api_key: str = Header(...)
):
    if x_api_key != os.getenv("API_KEY"):
        raise HTTPException(status_code=401, detail="Invalid API key")
    # ... rest of code
```

## Benefits of Python Agents

1. **Skyvern**: Computer vision-based automation, better for complex UIs
2. **Browser-Use**: Advanced LLM reasoning, multi-step tasks
3. **Background Execution**: No blocking, immediate response with live URL
4. **Real-time Updates**: Watch agents work live via Anchor Browser
5. **Persistent Storage**: All results saved in Convex

## Next Steps

1. ✅ Customize agent behavior (edit `agents/skyvern_agent/main.py` or `agents/browser_use_agent/main.py`)
2. ✅ Add more agent types
3. ✅ Implement custom LLM providers for Browser-Use
4. ✅ Add recording downloads
5. ✅ Deploy to production

For more details, see:
- `agents/README.md` - Python server documentation
- `agents/SUMMARY.md` - Quick reference
- Python Server API docs: http://localhost:8080/docs

