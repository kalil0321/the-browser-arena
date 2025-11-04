# The Browser Arena

Compare AI browser automation agents side-by-side. Submit a task, watch agents run in real-time, and compare speed, cost, and success.

![Arena Demo](assets/tba-demo-bg.gif)


## What it does

- **Multi-agent runs**: Browser-Use, Smooth, Stagehand (local & cloud)
- **Live comparison**: Parallel execution with browser views
- **Metrics built-in**: Time, steps, cost, success
- **History & replay**: Sessions are saved automatically
- **Multi-LLM**: OpenAI, Gemini, Claude

## Quick start

1) Install and run the web app
```bash
npm install
npm run dev
```

2) Start the agent server (Python)
```bash
cd agents
uv sync        # or: pip install -r requirements.txt
python server.py
```

3) Create `.env.local`
```env
# Convex
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_DEPLOYMENT=your-deployment

# LLMs (add at least one)
OPENAI_API_KEY=...
GOOGLE_API_KEY=...
ANTHROPIC_API_KEY=...

# Optional services
SMOOTH_API_KEY=...
BROWSERBASE_API_KEY=...
BROWSERBASE_PROJECT_ID=...

# Agent server
AGENT_SERVER_URL=http://localhost:8080
```

4) Convex (first time)
```bash
npx convex auth
npx convex deploy
```

Open http://localhost:3000

```

## Scripts

```bash
npm run dev         # Next.js dev (3000)
npm run build       # Production build
npm run start       # Start production
npm run lint        # ESLint
npx convex dev      # Convex local
```



