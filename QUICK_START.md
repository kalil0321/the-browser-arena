# Quick Start Guide

Get your Browser Agent Arena up and running in 3 steps!

## Step 1: Install Dependencies

```bash
npm install
```

✅ Already includes Better Auth for anonymous authentication

## Step 2: Start Development Server

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000)

## Step 3: Try It Out

1. Open your browser to `http://localhost:3000`
2. You'll see the chat interface with example prompts
3. Enter a task or click an example prompt
4. Click "Start Arena" to create a new session
5. You'll be redirected to `/session/[id]` to watch the agents compete

## What You'll See

### Home Page (`/`)
- Beautiful chat-style interface
- Collapsible sidebar with navigation
- Example prompts to get started
- Prompt input with character counter
- Anonymous authentication (automatic)

### Session Page (`/session/[id]`)
- Split-screen view for two agents
- Real-time status indicators
- Performance metrics (time, steps, status)
- Task description footer

## Project Structure at a Glance

```
📁 app/
  ├── 📄 page.tsx              # Home with chat UI
  ├── 📁 session/[id]/         # Session view
  └── 📁 api/
      ├── auth/[...all]/       # Better Auth endpoints
      └── session/             # Session APIs

📁 components/
  ├── 📄 sidebar.tsx           # Navigation sidebar
  └── 📄 chat-interface.tsx    # Prompt input UI

📁 lib/
  ├── 📄 auth.ts               # Server auth config
  └── 📄 auth-client.ts        # Client auth hooks

📁 types/
  └── 📄 session.ts            # TypeScript types
```

## Environment Variables

### Development
No configuration needed! Works out of the box with defaults.

### Production (Optional)
Create `.env.local`:

```env
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=https://yourdomain.com
NEXT_PUBLIC_BETTER_AUTH_URL=https://yourdomain.com
DATABASE_URL=your-database-url
```

## Features Ready to Use

✅ Anonymous authentication (Better Auth)
✅ Chat-style UI interface
✅ Session creation and routing
✅ Split-screen agent comparison layout
✅ Responsive sidebar navigation
✅ Dark theme UI
✅ TypeScript support
✅ API routes structure

## What's Not Implemented Yet

The UI and routing are complete, but you'll need to add:

🔲 Actual browser automation integration
🔲 Real agent APIs (GPT-4, Claude, etc.)
🔲 Database persistence
🔲 Real-time updates via WebSockets
🔲 Session history retrieval
🔲 Result sharing

## Next Steps

### 1. Connect Your Agents
Edit `/app/api/session/route.ts` to integrate with your browser automation service.

### 2. Add Database
Replace the in-memory database in `lib/auth.ts`:

```typescript
database: {
  provider: "postgres",
  url: process.env.DATABASE_URL,
}
```

### 3. Implement Real-time Updates
Add WebSocket or Server-Sent Events for live agent updates.

### 4. Customize Agents
Modify the agent configurations in `/app/session/[id]/page.tsx`.

## Useful Commands

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run linter
```

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3000
npx kill-port 3000

# Or use a different port
npm run dev -- -p 3001
```

### Build Warnings
The "middleware" deprecation warning is informational - the app works fine.
Database adapter warnings during build are expected with in-memory SQLite.

### Session Not Persisting
This is expected! We're using in-memory storage. Add a real database for persistence.

## Learn More

- 📖 `README.md` - Full project overview
- 📖 `PROJECT.md` - Architecture details
- 📖 `BETTER_AUTH_SETUP.md` - Auth configuration
- 🌐 [Better Auth Docs](https://www.better-auth.com)
- 🌐 [Next.js Docs](https://nextjs.org)

## Getting Help

1. Check the documentation files
2. Review the code comments
3. Look at the example prompts
4. Check Better Auth documentation

---

Ready to build something amazing! 🚀

