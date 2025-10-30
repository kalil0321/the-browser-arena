# Browser Agent Arena

## Overview

Browser Agent Arena is a platform for comparing AI browser agents in real-time. Users submit prompts and watch as different AI agents compete to complete the same task, allowing for side-by-side performance comparison.

## Project Structure

### Core Features

1. **Anonymous Authentication**
   - Uses Better Auth with anonymous authentication
   - No login required - users are automatically authenticated
   - Session management for tracking user interactions

2. **User Flow**
   - User enters a prompt on the home page
   - System creates a new session and redirects to `/session/[id]`
   - Session page shows two AI agents working on the task simultaneously
   - Users can see which agent performs better

3. **Routes**

#### `/` (Home Page)
- Chat-style UI interface
- Sidebar for navigation and history
- Prompt input area
- Submit button to start a new session

#### `/session/[id]` (Session Page)
- Dynamic route for individual sessions
- Split-screen view showing two AI agents
- Real-time browser automation display
- Performance metrics and comparison

#### `/api/auth/[...all]` (Better Auth API)
- Handles all authentication endpoints
- Anonymous user creation and session management

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Authentication**: Better Auth (Anonymous)
- **UI**: React 19, Tailwind CSS
- **Components**: Radix UI primitives
- **TypeScript**: Full type safety

## Authentication Flow

1. User visits the site
2. Better Auth automatically creates an anonymous session
3. User can interact with the platform without explicit login
4. Session persists across page navigation
5. User can be identified by their session for history tracking

## Development

### Getting Started

```bash
npm install
npm run dev
```

### Environment Variables

Create a `.env.local` file with the following:

```env
BETTER_AUTH_SECRET=your-secret-key-here
BETTER_AUTH_URL=http://localhost:3000
DATABASE_URL=your-database-url-here
```

## Future Enhancements

- Session history in sidebar
- Agent performance analytics
- Multiple agent comparisons (3+)
- Prompt templates
- Share session results
- User preferences and settings

