# Browser Agent Arena

A platform for comparing AI browser agents in real-time. Watch different AI agents compete to complete the same task and see which performs better.

![Next.js](https://img.shields.io/badge/Next.js-16.0-black)
![React](https://img.shields.io/badge/React-19.2-blue)
![Better Auth](https://img.shields.io/badge/Better%20Auth-Latest-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)

## Features

- 🎭 **Anonymous Authentication** - No login required, powered by Better Auth
- ⚡ **Real-time Comparison** - Watch two AI agents work simultaneously
- 🎨 **Refined UI** - Clean design with shadcn components and subtle contrast
- 📊 **Performance Metrics** - Track speed, steps, and success rates
- 💾 **PostgreSQL + Drizzle** - Production-ready database setup
- 📝 **Session History** - Review past agent competitions (coming soon)

## Quick Start

### Installation

```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### Environment Setup

Create a `.env.local` file:

```env
DATABASE_URL=postgresql://user:password@host:5432/database
BETTER_AUTH_SECRET=your-secret-key-here
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000
```

**Database Setup:**
```bash
# Push schema to database
npm run db:push

# View database in Drizzle Studio
npm run db:studio
```

See `DATABASE_SETUP.md` and `BETTER_AUTH_SETUP.md` for detailed instructions.

## Project Structure

```
arena/
├── app/
│   ├── api/
│   │   ├── auth/[...all]/     # Better Auth endpoints
│   │   └── session/            # Session management API
│   ├── session/[id]/          # Session view page
│   ├── page.tsx               # Home page with chat UI
│   └── layout.tsx             # Root layout
├── components/
│   ├── sidebar.tsx            # Navigation sidebar
│   └── chat-interface.tsx     # Prompt input interface
├── lib/
│   ├── auth.ts                # Server-side auth config
│   └── auth-client.ts         # Client-side auth utilities
├── middleware.ts              # Request middleware
└── PROJECT.md                 # Detailed project documentation
```

## Usage

1. **Enter a Prompt**: Type a task on the home page
2. **Start Arena**: Click "Start Arena" to create a new session
3. **Watch Agents**: View both agents working in split-screen
4. **Compare Results**: See metrics and determine which agent performed better

### Example Prompts

- "Find the top 3 trending AI tools on Product Hunt"
- "Research TypeScript best practices and create a comparison"
- "Look up weather in San Francisco and find nearby coffee shops"

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS, shadcn/ui
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Better Auth (Anonymous)
- **Components**: Radix UI primitives via shadcn
- **TypeScript**: Full type safety
- **Styling**: Tailwind CSS with semantic color system

## Better Auth Integration

This project uses Better Auth with anonymous authentication:

- ✅ **Zero-friction UX** - Users can start immediately
- ✅ **Session Management** - Automatic session tracking
- ✅ **Upgrade Path** - Can convert to authenticated users later
- ✅ **Secure** - Industry-standard security practices

See `BETTER_AUTH_SETUP.md` for detailed authentication documentation.

## Development

### Running Locally

```bash
npm run dev     # Start development server
npm run build   # Build for production
npm run start   # Run production server
npm run lint    # Run ESLint
```

### Adding Features

Current routes are set up but external API logic is not yet implemented:

- [ ] Connect to actual browser automation services
- [ ] Implement agent selection
- [ ] Add database persistence
- [ ] Create session history
- [ ] Add result sharing

## Documentation

- `PROJECT.md` - Complete project overview and architecture
- `BETTER_AUTH_SETUP.md` - Better Auth configuration guide
- [Better Auth Docs](https://www.better-auth.com/docs)
- [Next.js Docs](https://nextjs.org/docs)

## Contributing

This is a starter template. Feel free to:
- Add more agent providers
- Implement actual browser automation
- Enhance the UI/UX
- Add analytics and tracking
- Implement session sharing

## License

MIT

## What's Next?

To complete the implementation:

1. **Database Setup** - Add PostgreSQL or your preferred database
2. **Agent Integration** - Connect to browser automation APIs
3. **Real-time Updates** - Add WebSocket or SSE for live updates
4. **Session Storage** - Persist sessions and results
5. **User Preferences** - Save favorite agents and settings

---

Built with ❤️ using Next.js and Better Auth
