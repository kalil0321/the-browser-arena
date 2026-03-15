import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query } from "./_generated/server";
import { getUser } from "./auth";
import { Doc } from "./_generated/dataModel";
import {
    buildAgentsBySessionRecord,
    buildArenaStats,
    filterPublicAgents,
    filterPublicSessions,
} from "./lib/arena";

/**
 * Get all sessions for the current user
 */
export const getUserSessions = query({
    handler: async (ctx) => {
        const user = await getUser(ctx);

        if (!user) {
            return [];
        }

        const sessions = await ctx.db
            .query("sessions")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .order("desc")
            .collect();

        return sessions;
    },
});

/**
 * Get sessions by userId (for API key auth where there's no cookie session)
 */
export const getUserSessionsByUserId = query({
    args: { userId: v.string() },
    handler: async (ctx, { userId }) => {
        const sessions = await ctx.db
            .query("sessions")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .order("desc")
            .take(50);

        return sessions;
    },
});

/**
 * Get user sessions with pagination
 */
export const getUserSessionsPaginated = query({
    args: {
        paginationOpts: paginationOptsValidator,
    },
    handler: async (ctx, args) => {
        const user = await getUser(ctx);

        if (!user) {
            return {
                page: [],
                isDone: true,
                continueCursor: null,
            };
        }

        const result = await ctx.db
            .query("sessions")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .order("desc")
            .paginate(args.paginationOpts);

        return {
            page: result.page,
            isDone: result.isDone,
            continueCursor: result.continueCursor,
        };
    },
});

/**
 * Get total session count for user
 */
export const getUserSessionsCount = query({
    handler: async (ctx) => {
        const user = await getUser(ctx);

        if (!user) {
            return 0;
        }

        const sessions = await ctx.db
            .query("sessions")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .collect();

        return sessions.length;
    },
});

/**
 * Get a single session by ID
 * Returns session if it's public or if the user is the owner
 * Works for both authenticated and unauthenticated users (for public sessions)
 */
export const getSession = query({
    args: {
        sessionId: v.id("sessions"),
    },
    handler: async (ctx, args) => {
        const user = await getUser(ctx);

        const session = await ctx.db.get(args.sessionId);

        if (!session) {
            return null;
        }

        // Check if session is private
        const isPrivate = session.isPrivate ?? false;

        // If session is private, only the owner can access it (requires authentication)
        if (isPrivate) {
            if (!user || session.userId !== user._id) {
                return null; // Private session, only owner can access
            }
        }

        // Public sessions are accessible to everyone (authenticated or not)
        return session;
    },
});

/**
 * Get all agents for a session
 * Returns agents if session is public OR user is the owner
 * Works for both authenticated and unauthenticated users (for public sessions)
 */
export const getSessionAgents = query({
    args: {
        sessionId: v.id("sessions"),
    },
    handler: async (ctx, args) => {
        const user = await getUser(ctx);

        // Verify session exists and check privacy
        const session = await ctx.db.get(args.sessionId);
        if (!session) {
            return [];
        }

        // Check if session is private
        const isPrivate = session.isPrivate ?? false;

        // If session is private, only the owner can see agents (requires authentication)
        if (isPrivate) {
            if (!user || session.userId !== user._id) {
                return []; // Private session, only owner can see agents
            }
        }

        // Public sessions are accessible to everyone (authenticated or not)
        const agents = await ctx.db
            .query("agents")
            .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
            .collect();

        return agents;
    },
});

/**
 * Verify session ownership for authorization checks
 * Returns the session if the authenticated user owns it, null otherwise
 * This is used by API routes to verify authorization before allowing operations
 */
export const verifySessionOwnership = query({
    args: {
        sessionId: v.id("sessions"),
    },
    handler: async (ctx, args) => {
        const user = await getUser(ctx);

        if (!user) {
            return null; // User must be authenticated
        }

        const session = await ctx.db.get(args.sessionId);

        if (!session) {
            return null; // Session doesn't exist
        }

        // Only return session if the user owns it
        if (session.userId !== user._id) {
            return null; // User doesn't own the session
        }

        return session;
    },
});

/**
 * Arena queries - crowdsourced data view
 * Accessible to both authenticated and unauthenticated users (public sessions only)
 */

/**
 * Get all sessions from all users (for arena view)
 * Only returns public sessions (private sessions are excluded)
 * Works for both authenticated and unauthenticated users
 */
export const getAllSessions = query({
    handler: async (ctx) => {
        const allSessions = await ctx.db
            .query("sessions")
            .order("desc")
            .collect();

        return filterPublicSessions(allSessions);
    },
});

/**
 * Get all agents from all sessions (for arena view)
 * Only returns agents from public sessions
 * Works for both authenticated and unauthenticated users
 */
export const getAllAgents = query({
    handler: async (ctx) => {
        const allSessions = await ctx.db.query("sessions").collect();
        const publicSessions = filterPublicSessions(allSessions);
        const publicSessionIds = new Set(publicSessions.map((session) => session._id));

        const allAgents = await ctx.db
            .query("agents")
            .order("desc")
            .collect();

        return filterPublicAgents(allAgents, publicSessionIds);
    },
});

/**
 * Get arena statistics - models and agents usage
 * Only counts public sessions and agents from public sessions
 * Works for both authenticated and unauthenticated users
 */
export const getArenaStats = query({
    handler: async (ctx) => {
        const allSessions = await ctx.db.query("sessions").collect();
        const publicSessions = filterPublicSessions(allSessions);
        const publicSessionIds = new Set(publicSessions.map((session) => session._id));

        const allAgents = await ctx.db.query("agents").collect();
        const publicAgents = filterPublicAgents(allAgents, publicSessionIds);

        return buildArenaStats(publicSessions, publicAgents);
    },
});

/**
 * Aggregate arena payload to minimize client round-trips.
 */
export const getArenaData = query({
    handler: async (ctx) => {
        const allSessions = await ctx.db
            .query("sessions")
            .order("desc")
            .collect();
        const publicSessions = filterPublicSessions(allSessions);
        const publicSessionIds = new Set(publicSessions.map((session) => session._id));

        const allAgents = await ctx.db
            .query("agents")
            .order("desc")
            .collect();
        const publicAgents = filterPublicAgents(allAgents, publicSessionIds);

        return {
            sessions: publicSessions,
            agentsBySession: buildAgentsBySessionRecord(publicAgents),
            stats: buildArenaStats(publicSessions, publicAgents),
        };
    },
});

/**
 * OPTIMIZED: Sessions-only paginated query for 2-step loading
 * Returns sessions first without agents for faster initial render
 */
export const getArenaSessionsPaginated = query({
    args: {
        paginationOpts: paginationOptsValidator,
    },
    handler: async (ctx, args) => {
        // Query all sessions paginated
        const allSessionsResult = await ctx.db
            .query("sessions")
            .order("desc")
            .paginate(args.paginationOpts);

        // Filter to only public sessions (isPrivate is not true)
        const publicSessions = allSessionsResult.page.filter(
            (s) => s.isPrivate !== true
        );

        return {
            page: publicSessions,
            isDone: allSessionsResult.isDone,
            continueCursor: allSessionsResult.continueCursor,
        };
    },
});

/**
 * OPTIMIZED: Paginated arena data query
 * Fetches sessions in pages. For legacy data where isPrivate is undefined,
 * we treat undefined as public (not private).
 */
export const getArenaDataPaginated = query({
    args: {
        paginationOpts: paginationOptsValidator,
        filterAgent: v.optional(v.string()),
        filterModel: v.optional(v.string()),
        filterStatus: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // For legacy data, we query all sessions and filter
        // isPrivate === true means private, everything else (false or undefined) is public
        const allSessionsResult = await ctx.db
            .query("sessions")
            .order("desc")
            .paginate(args.paginationOpts);

        // Filter to only public sessions (isPrivate is not true)
        const publicSessions = allSessionsResult.page.filter(
            (s) => s.isPrivate !== true
        );

        // Fetch agents only for this page of sessions
        const agentsBySession: Record<string, Doc<"agents">[]> = {};
        const hasFilters = args.filterAgent || args.filterModel || args.filterStatus;

        for (const session of publicSessions) {
            let agents = await ctx.db
                .query("agents")
                .withIndex("by_session", (q) => q.eq("sessionId", session._id))
                .collect();

            // Apply filters if provided
            if (args.filterAgent) {
                agents = agents.filter((a) => a.name === args.filterAgent);
            }
            if (args.filterModel) {
                agents = agents.filter((a) => a.model === args.filterModel);
            }
            if (args.filterStatus) {
                agents = agents.filter((a) => a.status === args.filterStatus);
            }

            // Only include session if it has matching agents (when filters applied)
            // or if no filters are applied
            if (agents.length > 0 || !hasFilters) {
                agentsBySession[session._id] = agents;
            }
        }

        // Filter sessions that didn't match filters
        const filteredSessions = hasFilters
            ? publicSessions.filter((s) => agentsBySession[s._id] !== undefined)
            : publicSessions;

        return {
            page: filteredSessions,
            isDone: allSessionsResult.isDone,
            continueCursor: allSessionsResult.continueCursor,
            agentsBySession,
        };
    },
});

/**
 * OPTIMIZED: Separate stats query
 * Lightweight query for statistics that can load independently.
 * Uses server-side filtering with index.
 */
export const getArenaStatsOptimized = query({
    handler: async (ctx) => {
        // Count public sessions using index
        const publicSessions = await ctx.db
            .query("sessions")
            .withIndex("by_isPrivate_createdAt", (q) => q.eq("isPrivate", false))
            .collect();

        // Also count legacy undefined sessions
        const allSessions = await ctx.db.query("sessions").collect();
        const legacyPublicSessions = allSessions.filter(
            (s) => s.isPrivate === undefined
        );

        const allPublicSessions = [
            ...publicSessions,
            ...legacyPublicSessions.filter(
                (s) => !publicSessions.some((ps) => ps._id === s._id)
            ),
        ];

        // Get all agents for public sessions
        const publicSessionIds = new Set(allPublicSessions.map((s) => s._id));
        const allAgents = await ctx.db.query("agents").collect();
        const publicAgents = allAgents.filter((a) =>
            publicSessionIds.has(a.sessionId)
        );

        return buildArenaStats(allPublicSessions, publicAgents);
    },
});

/**
 * Get current user's usage statistics
 */
export const getUserUsageStats = query({
    handler: async (ctx) => {
        const user = await getUser(ctx);

        if (!user) {
            return null;
        }

        const stats = await ctx.db
            .query("userUsageStats")
            .withIndex("by_user", (q: any) => q.eq("userId", user._id))
            .first();

        if (!stats) {
            // Return default stats if user hasn't started yet
            return {
                userId: user._id,
                totalCost: 0,
                totalSessions: 0,
                totalAgents: 0,
                lastSessionAt: null,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };
        }

        return stats;
    },
});

/**
 * Get cost breakdown for current user's sessions
 */
export const getUserCostBreakdown = query({
    handler: async (ctx) => {
        const user = await getUser(ctx);

        if (!user) {
            return {
                byAgent: {},
                byModel: {},
                totalCost: 0,
            };
        }

        const sessions = await ctx.db
            .query("sessions")
            .withIndex("by_user", (q: any) => q.eq("userId", user._id))
            .collect();

        const byAgent: Record<string, number> = {};
        const byModel: Record<string, number> = {};
        let totalCost = 0;

        for (const session of sessions) {
            const agents = await ctx.db
                .query("agents")
                .withIndex("by_session", (q: any) => q.eq("sessionId", session._id))
                .collect();

            for (const agent of agents) {
                if (agent.result) {
                    // Extract cost
                    const cost = agent.result.usage?.total_cost ?? agent.result.cost ?? 0;
                    if (cost > 0) {
                        totalCost += cost;
                        byAgent[agent.name] = (byAgent[agent.name] || 0) + cost;
                        if (agent.model) {
                            byModel[agent.model] = (byModel[agent.model] || 0) + cost;
                        }
                    }
                }
            }
        }

        return {
            byAgent,
            byModel,
            totalCost,
        };
    },
});

/**
 * Get an agent by ID - used for backend verification
 * This is an internal query used by the upload-recording endpoint
 */
export const getAgentById = query({
    args: {
        agentId: v.id("agents"),
    },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.agentId);
    },
});

/**
 * Demo queries - for unauthenticated demo users
 */

/**
 * Get a demo session by ID - no auth required
 */
export const getDemoSession = query({
    args: {
        sessionId: v.id("sessions"),
    },
    handler: async (ctx, args) => {
        const session = await ctx.db.get(args.sessionId);

        if (!session) {
            return null;
        }

        // Only return demo sessions
        if (session.userId !== "demo-user") {
            return null;
        }

        return session;
    },
});

/**
 * Get agents for a demo session - no auth required
 */
export const getDemoSessionAgents = query({
    args: {
        sessionId: v.id("sessions"),
    },
    handler: async (ctx, args) => {
        // Verify it's a demo session
        const session = await ctx.db.get(args.sessionId);
        if (!session || session.userId !== "demo-user") {
            return [];
        }

        const agents = await ctx.db
            .query("agents")
            .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
            .collect();

        return agents;
    },
});

/**
 * Get all demo sessions for a device fingerprint (using client fingerprint)
 */
export const getDemoUserSessions = query({
    args: {
        clientFingerprint: v.string(),
    },
    handler: async (ctx, args) => {
        // Get the demo usage record for this client fingerprint
        const demoUsage = await ctx.db
            .query("demoUsage")
            .withIndex("by_client_fingerprint", (q) => q.eq("clientFingerprint", args.clientFingerprint))
            .first();

        if (!demoUsage || !demoUsage.sessionIds || demoUsage.sessionIds.length === 0) {
            return [];
        }

        // Fetch all sessions for this device, deduplicating by sessionId
        const sessions: Doc<"sessions">[] = [];
        const seenSessionIds = new Set<string>();
        for (const sessionId of demoUsage.sessionIds) {
            const sessionIdStr = sessionId as string;
            // Skip if we've already seen this session
            if (seenSessionIds.has(sessionIdStr)) {
                continue;
            }
            seenSessionIds.add(sessionIdStr);

            const session = await ctx.db.get(sessionId);
            if (session && session.userId === "demo-user") {
                sessions.push(session);
            }
        }

        // Sort by creation date descending (most recent first)
        return sessions.sort((a, b) => b.createdAt - a.createdAt);
    },
});

