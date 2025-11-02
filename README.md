# Browser Agent Arena

A platform for comparing and evaluating AI browser automation agents in real-time. Submit tasks and watch multiple agents compete to complete the same instruction while tracking performance metrics like speed, cost, and success rates.

![Next.js](https://img.shields.io/badge/Next.js-16.0-black)
![React](https://img.shields.io/badge/React-19.2-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688)
![Convex](https://img.shields.io/badge/Convex-Database-6366f1)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)

## Features

- 🤖 **Multi-Agent Support** - Compare Browser-Use, Smooth, Stagehand, and more
- 🎯 **Real-time Comparison** - Watch multiple agents execute tasks simultaneously
- 💰 **Cost Tracking** - Monitor API costs and token usage for each agent
- 📊 **Performance Metrics** - Track execution time, steps, and success rates
- 💾 **Session History** - Review and replay past agent competitions
- 🌐 **Multi-LLM Support** - OpenAI, Google Gemini, Anthropic Claude backends
- 📹 **Browser Recording** - Automatic capture and playback of agent interactions

## Quick Start

### Prerequisites

- Node.js 18+ and npm/yarn
- Python 3.12+
- Convex account (for serverless backend)
- API keys for at least one LLM provider (OpenAI, Google, or Anthropic)

### Installation

**Frontend:**
```bash
# Install Node dependencies
npm install

# Run the development server
npm run dev
```

**Backend (Python Agent Server):**
```bash
cd agents

# Install Python dependencies
pip install -r requirements.txt
# or with uv:
uv sync

# Run the FastAPI server
python server.py
```

Open [http://localhost:3000](http://localhost:3000) to access the application.

### Environment Setup

Create a `.env.local` file in the root directory:

```env
# Convex
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_DEPLOYMENT=your-deployment

# API Keys (at least one required)
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...
ANTHROPIC_API_KEY=sk-ant-...

# Optional: Browser & Service APIs
ANCHOR_API_KEY=...
SMOOTH_API_KEY=...
BROWSERBASE_API_KEY=...
BROWSERBASE_PROJECT_ID=...

# Agent Server
AGENT_SERVER_URL=http://localhost:8080
```

**Convex Setup:**
```bash
# Initialize Convex (first time only)
npx convex auth

# Deploy functions to Convex
npx convex deploy
```

## Project Structure

```
arena/
├── src/
│   ├── app/                           # Next.js App Router
│   │   ├── api/                       # API routes
│   │   │   ├── agent/                 # Agent execution endpoints
│   │   │   │   ├── browser-use        # Browser-Use agent
│   │   │   │   ├── smooth             # Smooth agent
│   │   │   │   ├── stagehand          # Stagehand agent
│   │   │   │   └── stagehand-cloud    # Stagehand cloud version
│   │   │   ├── auth/[...all]/         # Better Auth endpoints
│   │   │   ├── profile/               # User profile API
│   │   │   └── recordings/            # Session recording retrieval
│   │   ├── page.tsx                   # Home page with task input
│   │   ├── session/[id]/              # Individual session view
│   │   ├── sessions/                  # Session history
│   │   ├── settings/                  # User settings & API keys
│   │   ├── profile/                   # User profile
│   │   ├── arena/                     # Arena comparison page
│   │   └── layout.tsx                 # Root layout
│   ├── components/                    # React components
│   │   ├── chat-input.tsx             # Task input interface
│   │   ├── agent-panel.tsx            # Agent execution display
│   │   ├── agent-config-dialog.tsx    # Agent configuration
│   │   ├── app-sidebar.tsx            # Navigation sidebar
│   │   ├── loading-dino.tsx           # Animated loader
│   │   ├── user-info.tsx              # User information
│   │   └── ...                        # Additional components
│   ├── lib/                           # Utilities and config
│   │   ├── auth.ts                    # Server-side auth
│   │   ├── auth-client.ts             # Client-side auth
│   │   └── ...                        # Helper functions
│   ├── hooks/                         # Custom React hooks
│   └── middleware.ts                  # Request middleware
├── agents/                            # Python FastAPI backend
│   ├── server.py                      # Main FastAPI application
│   ├── browser_use_agent/             # Browser-Use implementation
│   ├── skyvern_agent/                 # Skyvern agent (disabled)
│   ├── pyproject.toml                 # Python dependencies
│   └── .env                           # Python environment variables
├── convex/                            # Serverless backend
│   ├── schema.ts                      # Database schema
│   ├── mutations.ts                   # Write operations
│   ├── queries.ts                     # Read operations
│   ├── auth.ts                        # Authentication logic
│   └── http.ts                        # HTTP endpoints
├── package.json                       # Node.js dependencies
├── tsconfig.json                      # TypeScript config
└── README.md                          # This file
```

## Usage

### Basic Workflow

1. **Submit Task**: Enter your task or instruction in the chat interface
2. **Select Agents**: Choose which agents you want to compare (e.g., Browser-Use vs Stagehand)
3. **Configure Settings**: Set LLM models, API keys, and agent-specific options
4. **Run Arena**: Click "Start Arena" to begin simultaneous execution
5. **Monitor Progress**: Watch both agents execute in real-time with live browser views
6. **Compare Results**: Review metrics including execution time, cost, steps taken, and success status
7. **Save Session**: Sessions are automatically saved to your history for future reference

### Example Prompts

- "Find the top 5 trending AI tools on Product Hunt and list their pricing"
- "Search for TypeScript best practices documentation and summarize key patterns"
- "Look up current weather in San Francisco and find the 3 nearest coffee shops"
- "Create a GitHub issue with the title 'Test Issue' and description 'This is a test'"
- "Fill out a form on example.com with realistic sample data"

### Agent Selection

Choose from available agents based on your needs:

- **Browser-Use**: Flexible, supports multiple LLM providers, good for complex workflows
- **Smooth**: Fast, proprietary optimization, includes free trial credits
- **Stagehand**: Computer vision-based, excels at visual element interaction
- **Stagehand Cloud**: Cloud-hosted version via Browserbase for production reliability

## Tech Stack

### Frontend
- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript 5
- **UI Library**: React 19
- **Styling**: Tailwind CSS v4, shadcn/ui components
- **Animations**: Framer Motion
- **State Management**: Convex React client (real-time)
- **Authentication**: Better Auth

### Backend
- **Database**: Convex (serverless, real-time)
- **API**: Next.js API routes + FastAPI (Python)
- **Language**: Python 3.12+
- **Framework**: FastAPI with Uvicorn

### Agent Backends
- **Browser-Use**: AI-powered browser automation
- **Smooth**: Proprietary optimization service
- **Stagehand**: Computer vision-based automation
- **LLM Providers**: OpenAI, Google Gemini, Anthropic Claude

### Infrastructure
- **Browser Sessions**: Anchor Browser SDK
- **Recording**: Automatic session capture and playback
- **Cloud Services**: Convex, Browserbase (optional)

## Authentication

This project uses **Better Auth** for flexible authentication:

- ✅ **Anonymous Access** - No signup required, instant access
- ✅ **User Accounts** - Optional account creation for session persistence
- ✅ **Session Management** - Automatic session tracking and management
- ✅ **Security** - Industry-standard security practices

Users can start anonymously and upgrade to a full account later.

## Development

### Available Commands

```bash
# Frontend development
npm run dev         # Start Next.js dev server (port 3000)
npm run build       # Build for production
npm run start       # Run production server
npm run lint        # Run ESLint
npm run type-check  # Check TypeScript types

# Database
npx convex dev      # Run Convex locally
npx convex deploy   # Deploy to production
```

### Backend Development

```bash
cd agents

# Start agent server (port 8080)
python server.py

# Install new dependencies
pip install package-name
# or with uv:
uv add package-name
```

### Implementing New Features

The architecture supports adding new agents and features:

- **New Agent**: Create new folder in `agents/` with FastAPI integration
- **API Routes**: Add endpoints in `src/app/api/agent/`
- **Database Schema**: Extend Convex schema in `convex/schema.ts`
- **UI Components**: Use shadcn/ui for consistency

## API Reference

### Agent Endpoints

**POST** `/api/agent/browser-use`
- Execute task using Browser-Use agent
- Requires: `instruction`, `model`, `apiKey`

**POST** `/api/agent/smooth`
- Execute task using Smooth agent
- Requires: `instruction`, `apiKey`

**POST** `/api/agent/stagehand`
- Execute task using Stagehand (local)
- Requires: `instruction`, `model`

**POST** `/api/agent/stagehand-cloud`
- Execute task using Stagehand (Browserbase)
- Requires: `instruction`, `projectId`, `apiKey`

### Database Schema

**sessions** - Stores task execution sessions
```typescript
- id: string
- userId: string
- instruction: string
- isPrivate: boolean
- createdAt: timestamp
- updatedAt: timestamp
```

**agents** - Individual agent runs within a session
```typescript
- sessionId: string
- name: string
- model: string
- status: "running" | "completed" | "failed"
- result: string
- recordingUrl: string
- cost: number
- tokensUsed: number
```

## Troubleshooting

### Agent Server Not Connecting
```bash
# Check if FastAPI server is running
curl http://localhost:8080/

# Ensure AGENT_SERVER_URL is set correctly in .env.local
# Default: http://localhost:8080
```

### Convex Not Syncing
```bash
# Re-authenticate with Convex
npx convex auth

# Deploy schema changes
npx convex deploy
```

### API Key Issues
- Verify API keys are set in `.env.local` (frontend) or `agents/.env` (backend)
- Check that keys are valid and have appropriate permissions
- For user-provided keys, ensure they're passed in request body

## Documentation

- [PROJECT.md](./PROJECT.md) - Detailed architecture and implementation guide
- [Better Auth Docs](https://www.better-auth.com/docs)
- [Convex Docs](https://docs.convex.dev)
- [Next.js Docs](https://nextjs.org/docs)
- [FastAPI Docs](https://fastapi.tiangolo.com)
- [Browser-Use Docs](https://github.com/browser-use/browser-use)

## Contributing

We welcome contributions! Areas for improvement:

- **New Agents**: Add support for additional browser automation services
- **LLM Providers**: Integrate more language model providers
- **Features**: Advanced filtering, agent performance analytics, result exports
- **UI/UX**: Enhanced visualizations, better mobile support
- **Performance**: Optimize agent execution and cost tracking
- **Testing**: Expand test coverage for critical paths

## Performance Tips

1. **Parallel Execution**: Running agents in parallel leverages both hardware and provides faster comparison
2. **Cost Tracking**: Use lower-cost models for simpler tasks
3. **Browser Profiles**: Reuse browser profiles for faster subsequent executions
4. **Caching**: Session results are cached for instant replay

## Deployment

### Frontend (Vercel)
```bash
# Push to GitHub, auto-deploys on Vercel
git push origin main
```

### Backend (Python Server)
```bash
# Docker deployment
docker build -t arena-agent agents/
docker run -p 8080:8080 --env-file agents/.env arena-agent
```

## License


---
