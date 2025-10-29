# Quick Start Guide

Get the agent server running in 5 minutes.

## 1. Install Dependencies

```bash
cd agents
uv sync
```

## 2. Configure Environment

Copy environment template to project root:

```bash
cp env.example ../.env.local
```

Edit `../.env.local` with your API keys:

```bash
# Required
CONVEX_URL=https://your-deployment.convex.cloud
ANCHOR_API_KEY=your_anchor_api_key

# Optional (for Browser-Use agent)
BROWSER_USE_API_KEY=your_browser_use_api_key
```

Get API keys:
- **Convex**: Run `npx convex dev` in project root, get URL from output
- **Anchor Browser**: Sign up at https://anchorbrowser.io
- **Browser-Use**: Sign up at https://browser-use.com (optional)

## 3. Deploy Convex Schema & Mutations

Make sure your Convex backend has the updated mutations:

```bash
# In project root
npx convex dev
```

The server uses these backend mutations (already added to `convex/mutations.ts`):
- `mutations:createAgentFromBackend`
- `mutations:updateAgentStatusFromBackend`
- `mutations:updateAgentResultFromBackend`

## 4. Start the Server

```bash
./start.sh
```

Or manually:

```bash
python server.py
```

Server will be available at:
- API: http://localhost:8000
- Docs: http://localhost:8000/docs

## 5. Test It

**Health Check:**

```bash
curl http://localhost:8000/
```

**Run Skyvern Agent:**

First, create a session in your frontend or via Convex dashboard. Then:

```bash
curl -X POST http://localhost:8000/agent/skyvern \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "YOUR_CONVEX_SESSION_ID",
    "instruction": "Find the top post on hackernews today",
    "providerModel": ""
  }'
```

**Run Browser-Use Agent:**

```bash
curl -X POST http://localhost:8000/agent/browser-use \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "YOUR_CONVEX_SESSION_ID",
    "instruction": "Search for AI news on Google",
    "providerModel": "browser-use/bu-1.0"
  }'
```

## What You Get Back

```json
{
  "sessionId": "k17...",
  "agentId": "k18...",
  "browserSessionId": "abc123",
  "liveUrl": "https://live.anchorbrowser.io/session/abc123"
}
```

- **sessionId**: Your Convex session ID
- **agentId**: Convex agent record ID (use to track status)
- **browserSessionId**: Anchor Browser session ID
- **liveUrl**: Watch the agent work in real-time! 🎥

## Next Steps

1. **Frontend Integration**: See [INTEGRATION.md](./INTEGRATION.md) for React/Next.js examples
2. **API Documentation**: Visit http://localhost:8000/docs for interactive API docs
3. **Monitor Status**: Query Convex for real-time agent status updates
4. **View Results**: Check Convex for final results when agent completes

## Troubleshooting

**"CONVEX_URL not found":**
- Make sure `.env.local` is in the project root (one level up from agents/)
- Verify the file has `CONVEX_URL=...` (no spaces around `=`)

**"ANCHOR_API_KEY not found":**
- Get API key from https://anchorbrowser.io
- Add to `.env.local`

**Import errors:**
- Make sure you're in the `agents/` directory
- Run `uv sync` to install dependencies

**Port 8000 already in use:**
- Change port in `server.py`: `uvicorn.run(..., port=8001)`
- Or kill existing process: `lsof -ti:8000 | xargs kill -9`

## Full Dev Setup

For development with hot reload:

```bash
# Terminal 1: Convex backend
cd /path/to/project
npx convex dev

# Terminal 2: Agent server
cd agents
uvicorn server:app --reload --port 8000

# Terminal 3: Frontend (if integrating)
cd /path/to/project
npm run dev
```

## Architecture Overview

```
User Request
    ↓
POST /agent/{skyvern|browser-use}
    ↓
Create Browser Session (Anchor)
    ↓
Create Agent Record (Convex)
    ↓
Return Session Info + Live URL ← YOU ARE HERE (immediately)
    ↓
Run Agent in Background
    ↓
Update Convex with Results
    ↓
Frontend Subscribes to Updates (Real-time)
```

The key benefit: **Your API returns immediately** with the live URL, so users can watch the agent work while it runs in the background!

