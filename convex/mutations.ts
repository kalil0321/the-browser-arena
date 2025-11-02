import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getUser } from "./auth";

/**
 * Helper function to extract cost from agent result
 */
function extractCost(result: any): number {
    if (!result) return 0;

    // Browser-Use format: usage.total_cost
    if (result.usage?.total_cost !== undefined) {
        return result.usage.total_cost;
    }

    // Smooth format: cost
    if (result.cost !== undefined) {
        return result.cost;
    }

    return 0;
}

/**
 * Helper function to ensure user usage stats exist and update them
 */
async function updateUserCostTracking(
    ctx: any,
    userId: string,
    cost: number,
    isNewAgent: boolean = true
) {
    // Get or create user usage stats
    const existing = await ctx.db
        .query("userUsageStats")
        .withIndex("by_user", (q: any) => q.eq("userId", userId))
        .first();

    const now = Date.now();

    if (existing) {
        // Update existing stats
        await ctx.db.patch(existing._id, {
            totalCost: existing.totalCost + cost,
            totalAgents: isNewAgent ? existing.totalAgents + 1 : existing.totalAgents,
            lastSessionAt: now,
            updatedAt: now,
        });
    } else {
        // Create new stats
        await ctx.db.insert("userUsageStats", {
            userId,
            totalCost: cost,
            totalSessions: 0, // Will be incremented in createSession
            totalAgents: isNewAgent ? 1 : 0,
            lastSessionAt: now,
            createdAt: now,
            updatedAt: now,
        });
    }
}

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
        isPrivate: v.optional(v.boolean()), // Default to false if not provided
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
            isPrivate: args.isPrivate ?? false, // Default to public (false)
            createdAt: now,
            updatedAt: now,
        });

        // Increment session count in user stats
        const existing = await ctx.db
            .query("userUsageStats")
            .withIndex("by_user", (q: any) => q.eq("userId", user._id))
            .first();

        if (existing) {
            await ctx.db.patch(existing._id, {
                totalSessions: existing.totalSessions + 1,
                lastSessionAt: now,
                updatedAt: now,
            });
        } else {
            await ctx.db.insert("userUsageStats", {
                userId: user._id,
                totalCost: 0,
                totalSessions: 1,
                totalAgents: 0,
                lastSessionAt: now,
                createdAt: now,
                updatedAt: now,
            });
        }

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

        // Track cost for this agent
        const cost = extractCost(args.result);
        if (cost > 0) {
            await updateUserCostTracking(ctx, user._id, cost, false);
        }
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

        // Track cost for this agent (get session to find user)
        const session = await ctx.db.get(agent.sessionId);
        if (session && args.status !== "failed") {
            const cost = extractCost(args.result);
            if (cost > 0) {
                await updateUserCostTracking(ctx, session.userId, cost, false);
            }
        }
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

/**
 * Update agent recording URL from Python backend - no auth required
 */
export const updateAgentRecordingUrlFromBackend = mutation({
    args: {
        agentId: v.id("agents"),
        recordingUrl: v.string(),
    },
    handler: async (ctx, args) => {
        const agent = await ctx.db.get(args.agentId);
        if (!agent) {
            throw new Error("Agent not found");
        }
        await ctx.db.patch(args.agentId, {
            recordingUrl: args.recordingUrl,
            updatedAt: Date.now(),
        });
    },
});

/**
 * Update agent browser URL from backend - no auth required
 */
export const updateAgentBrowserUrlFromBackend = mutation({
    args: {
        agentId: v.id("agents"),
        url: v.string(),
    },
    handler: async (ctx, args) => {
        const agent = await ctx.db.get(args.agentId);
        if (!agent) {
            throw new Error("Agent not found");
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
 * Initialize userUsageStats for the current user by backfilling from existing
 * sessions and agents. If a stats document already exists, it is returned as-is.
 */
export const initializeUserUsageStats = mutation({
    args: {},
    handler: async (ctx) => {
        const user = await getUser(ctx);

        if (!user) {
            throw new Error("User must be authenticated");
        }

        // If stats already exist, return them
        const existing = await ctx.db
            .query("userUsageStats")
            .withIndex("by_user", (q: any) => q.eq("userId", user._id))
            .first();
        if (existing) {
            return existing;
        }

        // Backfill from sessions and agents
        const sessions = await ctx.db
            .query("sessions")
            .withIndex("by_user", (q: any) => q.eq("userId", user._id))
            .collect();

        const totalSessions = sessions.length;
        let totalAgents = 0;
        let totalCost = 0;

        for (const session of sessions) {
            const agents = await ctx.db
                .query("agents")
                .withIndex("by_session", (q: any) => q.eq("sessionId", session._id))
                .collect();
            totalAgents += agents.length;
            for (const agent of agents) {
                totalCost += extractCost((agent as any).result);
            }
        }

        const now = Date.now();
        const lastSessionAt = sessions.length
            ? Math.max(...sessions.map((s: any) => s.createdAt))
            : undefined;

        const statsId = await ctx.db.insert("userUsageStats", {
            userId: user._id,
            totalCost,
            totalSessions,
            totalAgents,
            lastSessionAt,
            createdAt: now,
            updatedAt: now,
        });

        const created = await ctx.db.get(statsId);
        return created;
    },
});

/**
 * Add arbitrary usage cost to the current user
 */
export const addUsageCost = mutation({
    args: {
        cost: v.number(),
    },
    handler: async (ctx, args) => {
        const user = await getUser(ctx);

        if (!user) {
            throw new Error("User must be authenticated");
        }

        const cost = Math.max(0, args.cost);
        if (cost === 0) {
            return { success: true };
        }

        await updateUserCostTracking(ctx, user._id, cost, false);
        return { success: true };
    },
});

/**
 * Demo mutations - for unauthenticated demo users
 */

/**
 * Atomically claim a demo query slot for a device fingerprint.
 * This prevents race conditions by checking the limit and incrementing usage
 * in a single atomic transaction.
 *
 * @returns { allowed: true, usageId } if the demo query is permitted
 * @returns { allowed: false, queriesUsed, maxQueries } if limit exceeded
 */
export const claimDemoQuerySlot = mutation({
    args: {
        deviceFingerprint: v.string(),
        clientFingerprint: v.string(),
        ipAddress: v.string(),
        userAgent: v.string(),
    },
    handler: async (ctx, args) => {
        const now = Date.now();

        // First check: Look for existing usage by device fingerprint (primary check)
        const existingByFingerprint = await ctx.db
            .query("demoUsage")
            .withIndex("by_fingerprint", (q) => q.eq("deviceFingerprint", args.deviceFingerprint))
            .first();

        if (existingByFingerprint) {
            // Check if limit already exceeded for this fingerprint
            if (existingByFingerprint.queriesUsed >= 1) {
                return {
                    allowed: false,
                    queriesUsed: existingByFingerprint.queriesUsed,
                    maxQueries: 1,
                };
            }

            // Atomically increment usage
            await ctx.db.patch(existingByFingerprint._id, {
                queriesUsed: existingByFingerprint.queriesUsed + 1,
                lastUsedAt: now,
            });

            return {
                allowed: true,
                usageId: existingByFingerprint._id,
                queriesUsed: existingByFingerprint.queriesUsed + 1,
                maxQueries: 1,
            };
        }

        // Second check: IP-based rate limiting (defense in depth)
        // This prevents bypassing fingerprint limits by spoofing cookies
        // Only check if IP is not "unknown" (which happens when IP can't be determined)
        if (args.ipAddress !== "unknown") {
            const existingByIP = await ctx.db
                .query("demoUsage")
                .withIndex("by_ip", (q) => q.eq("ipAddress", args.ipAddress))
                .first();

            if (existingByIP && existingByIP.queriesUsed >= 1) {
                // IP has already used a query, deny even with different fingerprint
                return {
                    allowed: false,
                    queriesUsed: existingByIP.queriesUsed,
                    maxQueries: 1,
                };
            }
        }

        // First usage - create new record with queriesUsed: 1
        const usageId = await ctx.db.insert("demoUsage", {
            deviceFingerprint: args.deviceFingerprint,
            clientFingerprint: args.clientFingerprint,
            ipAddress: args.ipAddress,
            userAgent: args.userAgent,
            queriesUsed: 1,
            sessionIds: [],
            firstUsedAt: now,
            lastUsedAt: now,
        });

        return {
            allowed: true,
            usageId,
            queriesUsed: 1,
            maxQueries: 1,
        };
    },
});

/**
 * Associate a session with a demo usage record
 */
export const associateDemoSession = mutation({
    args: {
        usageId: v.id("demoUsage"),
        sessionId: v.id("sessions"),
    },
    handler: async (ctx, args) => {
        const usage = await ctx.db.get(args.usageId);
        if (!usage) {
            throw new Error("Demo usage record not found");
        }

        await ctx.db.patch(args.usageId, {
            sessionIds: [...usage.sessionIds, args.sessionId],
        });
    },
});

/**
 * Create a demo session - no auth required
 */
export const createDemoSession = mutation({
    args: {
        instruction: v.string(),
        browserData: v.optional(v.object({
            sessionId: v.string(),
            url: v.string(),
        })),
        agentName: v.optional(v.string()),
        model: v.optional(v.string()),
        isPrivate: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const now = Date.now();

        // Demo sessions use a special userId
        const demoUserId = "demo-user";

        const sessionId = await ctx.db.insert("sessions", {
            userId: demoUserId,
            instruction: args.instruction,
            isPrivate: false, // Demo sessions are always public
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
