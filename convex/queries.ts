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

        if (session.userId !== user._id) {
            return null;
        }

        return session;
    },
});

/**
 * Get all agents for a session
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

        // Verify session belongs to user
        const session = await ctx.db.get(args.sessionId);
        if (!session) {
            return [];
        }
        if (session.userId !== user._id) {
            return [];
        }

        const agents = await ctx.db
            .query("agents")
            .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
            .collect();

        return agents;
    },
});

