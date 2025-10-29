import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getUser } from "./auth";

/**
 * Create a new session when user submits an instruction
 */
export const createSession = mutation({
    args: {
        instruction: v.string(),
        browserData: v.optional(v.object({
            sessionId: v.string(),
            url: v.string(),
        })),
        agentName: v.optional(v.string()),
        model: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const user = await getUser(ctx);

        if (!user) {
            throw new Error("User must be authenticated");
        }

        const now = Date.now();

        const sessionId = await ctx.db.insert("sessions", {
            userId: user._id,
            instruction: args.instruction,
            createdAt: now,
            updatedAt: now,
        });

        // If browser data is provided, create the agent at the same time
        let agentId = undefined;
        if (args.browserData) {
            agentId = await ctx.db.insert("agents", {
                sessionId,
                name: args.agentName ?? "stagehand",
                model: args.model,
                status: "running",
                browser: {
                    sessionId: args.browserData.sessionId,
                    url: args.browserData.url,
                },
                createdAt: now,
                updatedAt: now,
            });
        }

        return { sessionId, agentId };
    },
});

/**
 * Create an agent for a session
 */
export const createAgent = mutation({
    args: {
        sessionId: v.id("sessions"),
        name: v.string(),
        model: v.optional(v.string()),
        browser: v.object({
            sessionId: v.string(),
            url: v.string(),
        }),
    },
    handler: async (ctx, args) => {
        const user = await getUser(ctx);

        if (!user) {
            throw new Error("User must be authenticated");
        }

        // Verify session belongs to user
        const session = await ctx.db.get(args.sessionId);
        if (!session) {
            throw new Error("Session not found");
        }
        if (session.userId !== user._id) {
            throw new Error("Unauthorized");
        }

        const now = Date.now();

        const agentId = await ctx.db.insert("agents", {
            sessionId: args.sessionId,
            name: args.name,
            model: args.model,
            status: "running",
            browser: args.browser,
            createdAt: now,
            updatedAt: now,
        });

        return agentId;
    },
});

/**
 * Update agent with final result when agent completes
 */
export const updateAgentResult = mutation({
    args: {
        agentId: v.id("agents"),
        result: v.any(),
    },
    handler: async (ctx, args) => {
        const user = await getUser(ctx);

        if (!user) {
            throw new Error("User must be authenticated");
        }

        const agent = await ctx.db.get(args.agentId);
        if (!agent) {
            throw new Error("Agent not found");
        }

        // Verify session belongs to user
        const session = await ctx.db.get(agent.sessionId);
        if (!session || session.userId !== user._id) {
            throw new Error("Unauthorized");
        }

        await ctx.db.patch(args.agentId, {
            status: "completed",
            result: args.result,
            updatedAt: Date.now(),
        });
    },
});

/**
 * Update agent status
 */
export const updateAgentStatus = mutation({
    args: {
        agentId: v.id("agents"),
        status: v.union(v.literal("pending"), v.literal("running"), v.literal("completed"), v.literal("failed")),
    },
    handler: async (ctx, args) => {
        const user = await getUser(ctx);

        if (!user) {
            throw new Error("User must be authenticated");
        }

        const agent = await ctx.db.get(args.agentId);
        if (!agent) {
            throw new Error("Agent not found");
        }

        // Verify session belongs to user
        const session = await ctx.db.get(agent.sessionId);
        if (!session || session.userId !== user._id) {
            throw new Error("Unauthorized");
        }

        await ctx.db.patch(args.agentId, {
            status: args.status,
            updatedAt: Date.now(),
        });
    },
});

/**
 * Update agent recording URL
 */
export const updateAgentRecordingUrl = mutation({
    args: {
        agentId: v.id("agents"),
        recordingUrl: v.string(),
    },
    handler: async (ctx, args) => {
        const user = await getUser(ctx);

        if (!user) {
            throw new Error("User must be authenticated");
        }

        const agent = await ctx.db.get(args.agentId);
        if (!agent) {
            throw new Error("Agent not found");
        }

        // Verify session belongs to user
        const session = await ctx.db.get(agent.sessionId);
        if (!session || session.userId !== user._id) {
            throw new Error("Unauthorized");
        }

        await ctx.db.patch(args.agentId, {
            recordingUrl: args.recordingUrl,
            updatedAt: Date.now(),
        });
    },
});

/**
 * Update agent browser live URL as soon as it's available
 */
export const updateAgentBrowserUrl = mutation({
    args: {
        agentId: v.id("agents"),
        url: v.string(),
    },
    handler: async (ctx, args) => {
        const user = await getUser(ctx);

        if (!user) {
            throw new Error("User must be authenticated");
        }

        const agent = await ctx.db.get(args.agentId);
        if (!agent) {
            throw new Error("Agent not found");
        }

        const session = await ctx.db.get(agent.sessionId);
        if (!session || session.userId !== user._id) {
            throw new Error("Unauthorized");
        }

        await ctx.db.patch(args.agentId, {
            browser: {
                sessionId: agent.browser.sessionId,
                url: args.url,
            },
            updatedAt: Date.now(),
        });
    },
});

/**
 * Delete a session and all its agents
 */
export const deleteSession = mutation({
    args: {
        sessionId: v.id("sessions"),
    },
    handler: async (ctx, args) => {
        const user = await getUser(ctx);

        if (!user) {
            throw new Error("User must be authenticated");
        }

        // Verify session belongs to user
        const session = await ctx.db.get(args.sessionId);
        if (!session) {
            throw new Error("Session not found");
        }
        if (session.userId !== user._id) {
            throw new Error("Unauthorized");
        }

        // Delete all agents for this session
        const agents = await ctx.db
            .query("agents")
            .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
            .collect();

        for (const agent of agents) {
            await ctx.db.delete(agent._id);
        }

        // Delete the session
        await ctx.db.delete(args.sessionId);

        return { success: true };
    },
});

/**
 * Cleanup old sessions - removes status field from sessions that still have it
 * This is a one-time migration function
 */
export const cleanupOldSessions = mutation({
    args: {},
    handler: async (ctx) => {
        // Get all sessions
        const sessions = await ctx.db.query("sessions").collect();

        let count = 0;
        for (const session of sessions) {
            // If session has a status field (old schema), delete and recreate it
            if ('status' in session) {
                try {
                    const { _id, _creationTime, status, ...rest } = session as any;

                    // Delete the old session
                    await ctx.db.delete(_id);

                    // Create new session without status
                    await ctx.db.insert("sessions", {
                        ...rest,
                        updatedAt: Date.now(),
                    });
                    count++;
                } catch (e) {
                    console.error("Failed to clean up session:", session._id, e);
                }
            }
        }

        return { cleanedUp: count, total: sessions.length };
    },
});

/**
 * Python Backend Mutations (No Auth Required)
 * These mutations are called from the Python agent server
 */

/**
 * Create agent from Python backend - no auth required
 */
export const createAgentFromBackend = mutation({
    args: {
        sessionId: v.id("sessions"),
        name: v.string(),
        model: v.optional(v.string()),
        browser: v.object({
            sessionId: v.string(),
            url: v.string(),
        }),
    },
    handler: async (ctx, args) => {
        // Verify session exists
        const session = await ctx.db.get(args.sessionId);
        if (!session) {
            throw new Error("Session not found");
        }

        const now = Date.now();

        const agentId = await ctx.db.insert("agents", {
            sessionId: args.sessionId,
            name: args.name,
            model: args.model,
            status: "running",
            browser: args.browser,
            createdAt: now,
            updatedAt: now,
        });

        return agentId;
    },
});

/**
 * Update agent result from Python backend - no auth required
 */
export const updateAgentResultFromBackend = mutation({
    args: {
        agentId: v.id("agents"),
        result: v.any(),
        status: v.optional(v.union(v.literal("completed"), v.literal("failed"))),
    },
    handler: async (ctx, args) => {
        const agent = await ctx.db.get(args.agentId);
        if (!agent) {
            throw new Error("Agent not found");
        }

        await ctx.db.patch(args.agentId, {
            status: args.status ?? "completed",
            result: args.result,
            updatedAt: Date.now(),
        });
    },
});

/**
 * Update agent status from Python backend - no auth required
 */
export const updateAgentStatusFromBackend = mutation({
    args: {
        agentId: v.id("agents"),
        status: v.union(v.literal("pending"), v.literal("running"), v.literal("completed"), v.literal("failed")),
        error: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const agent = await ctx.db.get(args.agentId);
        if (!agent) {
            throw new Error("Agent not found");
        }

        const updateData: any = {
            status: args.status,
            updatedAt: Date.now(),
        };

        if (args.error) {
            updateData.result = { error: args.error };
        }

        await ctx.db.patch(args.agentId, updateData);
    },
});
