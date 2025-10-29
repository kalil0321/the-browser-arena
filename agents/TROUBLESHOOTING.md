# Troubleshooting Guide

## Common Issues and Solutions

### 1. Authentication Errors in Background Tasks

**Error:**
```
❌ Error: {"code":"Unauthenticated","message":"Could not verify OIDC token claim..."}
```

**Cause:** Auth tokens expire during long-running background tasks in Next.js `after()` functions.

**Solutions:**

#### For Python Agents (Recommended)
The Python server uses backend mutations that **don't require authentication**. Make sure you're using:
- `/api/agent/skyvern` (uses Python server)
- `/api/agent/browser-use` (uses Python server)

These should NOT have auth issues because:
1. Frontend creates session with auth
2. Frontend calls Python server (no auth needed)
3. Python server updates Convex using `*FromBackend` mutations (no auth required)

#### For TypeScript Agents (Stagehand, Smooth)
If you see this error with Stagehand/Smooth agents, the auth token expires during background execution. This is a known issue with long-running Next.js `after()` tasks.

**Workaround:**
1. Increase token expiration time
2. Refresh tokens before they expire
3. Or migrate to Python agents which don't have this issue

### 2. Cannot Connect to Agent Server

**Error:**
```
Failed to fetch
ERR_CONNECTION_REFUSED
```

**Solution:**

1. Make sure Python server is running:
```bash
cd agents
./start.sh
```

2. Check the server logs for errors

3. Verify the URL is correct:
```bash
# In your root .env.local
AGENT_SERVER_URL=http://localhost:8080
```

4. Test the connection:
```bash
curl http://localhost:8080/
```

### 3. CONVEX_URL Not Found

**Error:**
```
ValueError: CONVEX_URL environment variable is required
```

**Solution:**

1. Create `agents/.env.local` from template:
```bash
cd agents
cp env.example ../.env.local
```

2. Add your Convex URL:
```bash
# In .env.local (project root)
CONVEX_URL=https://your-deployment.convex.cloud
```

3. Restart the Python server

### 4. Circular Import Error

**Error:**
```
ImportError: cannot import name 'Skyvern' from partially initialized module 'skyvern'
```

**Solution:** This should be fixed. The agent folders are now named:
- `skyvern_agent/` (not `skyvern/`)
- `browser_use_agent/` (not `browser-use/`)

If you still see this:
```bash
cd agents
rm -rf skyvern browser-use browser_use  # Remove old conflicting folders
```

### 5. Session Not Found

**Error:**
```
Session not found
```

**Cause:** The Convex session wasn't created before calling the Python server.

**Solution:**

1. Make sure Convex is running:
```bash
npx convex dev
```

2. Check that your frontend API route creates the session first:
```typescript
// Should happen before calling Python server
const { sessionId } = await convex.mutation(api.mutations.createSession, {
    instruction,
});
```

3. Verify the session ID is being passed correctly to Python server

### 6. Agent Not Found

**Error:**
```
Agent not found
```

**Cause:** The agent record doesn't exist in Convex.

**Solution:**

Check the Python server logs to see if the agent was created successfully:
```bash
# Look for:
✅ Skyvern agent started: {agentId: "..."}
```

If not created, check:
1. Convex URL is correct
2. Session ID is valid
3. Python server has network access to Convex

### 7. Port Already in Use

**Error:**
```
Address already in use
```

**Solution:**

Option 1 - Kill the process:
```bash
lsof -ti:8080 | xargs kill -9
```

Option 2 - Change the port:
```python
# In agents/server.py
uvicorn.run("server:app", host="0.0.0.0", port=8081, ...)
```

And update `.env.local`:
```bash
AGENT_SERVER_URL=http://localhost:8081
```

### 8. Module Not Found

**Error:**
```
ModuleNotFoundError: No module named 'fastapi'
```

**Solution:**

Install dependencies:
```bash
cd agents
uv sync
```

Or manually:
```bash
pip install -r pyproject.toml
```

### 9. Anchor Browser API Key Invalid

**Error:**
```
Unauthorized: Invalid API key
```

**Solution:**

1. Get a valid API key from https://anchorbrowser.io
2. Add to both `.env.local` files:

```bash
# Root .env.local
ANCHOR_API_KEY=your_key_here

# agents/.env.local (create symlink or copy)
ANCHOR_API_KEY=your_key_here
```

### 10. Browser Session Creation Failed

**Error:**
```
Failed to create session - no live_view_url
```

**Cause:** Anchor Browser API call failed.

**Solution:**

1. Check your Anchor API key is valid
2. Check your internet connection
3. Verify Anchor Browser service is up
4. Check rate limits on your account

### 11. Convex Mutations Not Found

**Error:**
```
Convex error: Function not found: mutations:createAgentFromBackend
```

**Solution:**

1. Make sure Convex is running with latest schema:
```bash
npx convex dev
```

2. Verify the mutations are in `convex/mutations.ts`:
   - `createAgentFromBackend`
   - `updateAgentStatusFromBackend`
   - `updateAgentResultFromBackend`

3. Wait for Convex to finish deploying (watch terminal output)

## Testing & Debugging

### Test Convex Connection

```bash
cd agents
.venv/bin/python test_convex.py
```

Expected output:
```
✅ ConvexClient created successfully
✅ Basic connection test passed!
```

### Test Python Server

```bash
# Health check
curl http://localhost:8080/

# Convex connection test
curl http://localhost:8080/health/convex
```

### Test Full Flow

1. Start all services:
```bash
# Terminal 1
npx convex dev

# Terminal 2
cd agents && ./start.sh

# Terminal 3
npm run dev
```

2. Use the UI:
   - Go to http://localhost:3000
   - Select "Skyvern (Python)" or "Browser-Use (Python)"
   - Submit a task
   - Watch the console logs in all terminals

3. Check for errors in:
   - Browser console (F12)
   - Python server terminal
   - Convex terminal
   - Next.js terminal

### Enable Verbose Logging

In `agents/server.py`, add debug prints:
```python
# At the top
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Still Having Issues?

1. **Check environment variables:**
```bash
# Root .env.local should have:
CONVEX_URL=...
ANCHOR_API_KEY=...
AGENT_SERVER_URL=http://localhost:8080

# agents/.env.local should have:
CONVEX_URL=... (same as above)
ANCHOR_API_KEY=... (same as above)
BROWSER_USE_API_KEY=... (optional)
```

2. **Restart everything:**
```bash
# Kill all processes
pkill -f "convex dev"
pkill -f "npm run dev"
pkill -f "uvicorn"

# Start fresh
npx convex dev
cd agents && ./start.sh
npm run dev
```

3. **Check the logs:**
   - Python server: Look for emoji indicators (✅ ❌ 🔄 etc.)
   - Convex: Watch for schema updates
   - Frontend: Check network tab for failed API calls

4. **Verify versions:**
```bash
# Python
python --version  # Should be 3.12+

# Node
node --version  # Should be 18+

# npm packages
npm list convex
```

## Getting Help

If issues persist:

1. Check the logs in all terminals
2. Look for specific error messages
3. Note which step fails (session creation, agent creation, execution, etc.)
4. Check if it's a Python agent issue or TypeScript agent issue
5. Review the documentation:
   - `agents/README.md`
   - `PYTHON_AGENTS_SETUP.md`
   - `INTEGRATION_COMPLETE.md`

