![The Browser Arena](../assets/tba.jpeg)

# Stagehand Node Server (Express)

Env vars:

- PORT (default 3001)
- AGENT_SERVER_API_KEY (required)
- CONVEX_URL (required)
- OPENAI_API_KEY / GOOGLE_API_KEY / ANTHROPIC_API_KEY (optional fallbacks)


## Development

Run locally with tsx (hot reload):

```bash
npx tsx src/index.ts
```

Or with Vercel:

```bash
vercel dev
```

## Build & Production

Install and build:

```bash
npm install
npm run build
```

Run production build:

```bash
PORT=3001 AGENT_SERVER_API_KEY=your_key CONVEX_URL=https://YOUR.convex.cloud npm start
```

## Endpoints

- GET /healthz → 200 ok
- GET /status → { status: "ok" }
- POST /agent/stagehand (Bearer AGENT_SERVER_API_KEY)

Request body (JSON):

```json
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

```json
{ "agentId": "...", "liveUrl": "https://..." }
```
