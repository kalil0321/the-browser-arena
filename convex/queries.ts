import { v } from "convex/values";
import { query } from "./_generated/server";
import { getUser } from "./auth";

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

        // Filter out private sessions - only show public sessions
        // A session is public if isPrivate is false or undefined
        const publicSessions = allSessions.filter(session => !(session.isPrivate ?? false));

        return publicSessions;
    },
});

/**
 * Get all agents from all sessions (for arena view)
 * Only returns agents from public sessions
 * Works for both authenticated and unauthenticated users
 */
export const getAllAgents = query({
    handler: async (ctx) => {
        const allAgents = await ctx.db
            .query("agents")
            .order("desc")
            .collect();

        // Filter out agents from private sessions
        // A session is public if isPrivate is false or undefined
        const publicAgents = [];
        for (const agent of allAgents) {
            const session = await ctx.db.get(agent.sessionId);
            if (session && !(session.isPrivate ?? false)) {
                publicAgents.push(agent);
            }
        }

        return publicAgents;
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
        const allAgents = await ctx.db.query("agents").collect();

        // Filter out private sessions for stats
        // A session is public if isPrivate is false or undefined
        const publicSessions = allSessions.filter(session => !(session.isPrivate ?? false));

        // Filter agents to only include those from public sessions
        const publicAgents = [];
        for (const agent of allAgents) {
            const session = await ctx.db.get(agent.sessionId);
            if (session && !(session.isPrivate ?? false)) {
                publicAgents.push(agent);
            }
        }

        // Count models (only from public agents)
        const models: Record<string, number> = {};
        publicAgents.forEach((agent) => {
            if (agent.model) {
                models[agent.model] = (models[agent.model] || 0) + 1;
            }
        });

        // Count agents by name (only from public sessions)
        const agentCounts: Record<string, number> = {};
        publicAgents.forEach((agent) => {
            agentCounts[agent.name] = (agentCounts[agent.name] || 0) + 1;
        });

        // Count by status (only from public sessions)
        const statusCounts: Record<string, number> = {};
        publicAgents.forEach((agent) => {
            statusCounts[agent.status] = (statusCounts[agent.status] || 0) + 1;
        });

        return {
            totalSessions: publicSessions.length,
            totalAgents: publicAgents.length,
            models,
            agents: agentCounts,
            statusCounts,
        };
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
        const sessions = [];
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

