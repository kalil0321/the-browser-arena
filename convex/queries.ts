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
 */
export const getSession = query({
    args: {
        sessionId: v.id("sessions"),
    },
    handler: async (ctx, args) => {
        const user = await getUser(ctx);

        if (!user) {
            return null;
        }

        const session = await ctx.db.get(args.sessionId);

        if (!session) {
            return null;
        }

        // Allow access if session is public OR user is the owner
        const isPrivate = session.isPrivate ?? false;
        if (isPrivate && session.userId !== user._id) {
            return null; // Private session, only owner can access
        }

        return session;
    },
});

/**
 * Get all agents for a session
 * Returns agents if session is public OR user is the owner
 */
export const getSessionAgents = query({
    args: {
        sessionId: v.id("sessions"),
    },
    handler: async (ctx, args) => {
        const user = await getUser(ctx);

        if (!user) {
            return [];
        }

        // Verify session exists and check privacy
        const session = await ctx.db.get(args.sessionId);
        if (!session) {
            return [];
        }

        // Allow access if session is public OR user is the owner
        const isPrivate = session.isPrivate ?? false;
        if (isPrivate && session.userId !== user._id) {
            return []; // Private session, only owner can see agents
        }

        const agents = await ctx.db
            .query("agents")
            .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
            .collect();

        return agents;
    },
});

/**
 * Arena queries - crowdsourced data view (requires authentication)
 */

/**
 * Get all sessions from all users (for arena view)
 * Only returns public sessions (private sessions are excluded)
 */
export const getAllSessions = query({
    handler: async (ctx) => {
        const user = await getUser(ctx);

        if (!user) {
            return [];
        }

        const allSessions = await ctx.db
            .query("sessions")
            .order("desc")
            .collect();

        // Filter out private sessions - only show public sessions
        const publicSessions = allSessions.filter(session => !session.isPrivate);

        return publicSessions;
    },
});

/**
 * Get all agents from all sessions (for arena view)
 * Only returns agents from public sessions
 */
export const getAllAgents = query({
    handler: async (ctx) => {
        const user = await getUser(ctx);

        if (!user) {
            return [];
        }

        const allAgents = await ctx.db
            .query("agents")
            .order("desc")
            .collect();

        // Filter out agents from private sessions
        const publicAgents = [];
        for (const agent of allAgents) {
            const session = await ctx.db.get(agent.sessionId);
            if (session && !session.isPrivate) {
                publicAgents.push(agent);
            }
        }

        return publicAgents;
    },
});

/**
 * Get arena statistics - models and agents usage
 */
export const getArenaStats = query({
    handler: async (ctx) => {
        const user = await getUser(ctx);

        if (!user) {
            return {
                totalSessions: 0,
                totalAgents: 0,
                models: {},
                agents: {},
                statusCounts: {},
            };
        }

        const allSessions = await ctx.db.query("sessions").collect();
        const agents = await ctx.db.query("agents").collect();

        // Filter out private sessions for stats
        const sessions = allSessions.filter(session => !session.isPrivate);

        // Count models
        const models: Record<string, number> = {};
        agents.forEach((agent) => {
            if (agent.model) {
                models[agent.model] = (models[agent.model] || 0) + 1;
            }
        });

        // Count agents by name
        const agentCounts: Record<string, number> = {};
        agents.forEach((agent) => {
            agentCounts[agent.name] = (agentCounts[agent.name] || 0) + 1;
        });

        // Count by status
        const statusCounts: Record<string, number> = {};
        agents.forEach((agent) => {
            statusCounts[agent.status] = (statusCounts[agent.status] || 0) + 1;
        });

        return {
            totalSessions: sessions.length,
            totalAgents: agents.length,
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

