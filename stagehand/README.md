Stagehand Node Server (Express)

Env vars:

- PORT (default 3001)
- AGENT_SERVER_API_KEY (required)
- CONVEX_URL (required)
- OPENAI_API_KEY / GOOGLE_API_KEY / ANTHROPIC_API_KEY (optional fallbacks)


To run locally: `vercel dev`

Install and build:

```bash
npm install
npm run build
```

Run:

```bash
PORT=3001 AGENT_SERVER_API_KEY=your_key CONVEX_URL=https://YOUR.convex.cloud npm start
```

Endpoints:

- GET /healthz → 200 ok
- GET /status → { status: "ok" }
- POST /agent/stagehand (Bearer AGENT_SERVER_API_KEY)

Request body (JSON):

```
{
  "sessionId": "...",
  "instruction": "...",
  "model": "google/gemini-2.5-flash",
  "thinkingModel": "optional",
  "executionModel": "optional",
  "cdpUrl": "wss://...",
  "liveViewUrl": "https://...",
  "agentId": "optional",
  "keys": { "openai": "...", "google": "...", "anthropic": "..." }
}
```

Response:

```
{ "agentId": "...", "liveUrl": "https://..." }
```
