import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    // Sessions table - stores user instruction
    sessions: defineTable({
        userId: v.string(),
        instruction: v.string(),
        isPrivate: v.optional(v.boolean()), // Private sessions are only visible to the owner
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_user", ["userId"]),

    // Agents table - stores individual agent runs within a session
    agents: defineTable({
        sessionId: v.id("sessions"),
        name: v.string(),
        model: v.optional(v.string()), // Model used for this agent
        status: v.union(v.literal("pending"), v.literal("running"), v.literal("completed"), v.literal("failed")),
        browser: v.object({
            sessionId: v.string(), // Anchor Browser session ID
            url: v.string(),
        }),
        result: v.optional(v.any()),
        recordingUrl: v.optional(v.string()), // URL to the session recording
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_session", ["sessionId"])
        .index("by_session_status", ["sessionId", "status"])
        .index("by_session_name", ["sessionId", "name"]),

    // User usage stats table - tracks costs and usage metrics per user
    userUsageStats: defineTable({
        userId: v.string(),
        totalCost: v.number(), // Cumulative cost in USD
        totalSessions: v.number(), // Total number of sessions created
        totalAgents: v.number(), // Total number of agents run
        lastSessionAt: v.optional(v.number()), // Timestamp of last session
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_user", ["userId"]),

    // Demo usage table - tracks device fingerprints for demo rate limiting
    demoUsage: defineTable({
        deviceFingerprint: v.string(), // server-generated signed fingerprint
        clientFingerprint: v.string(), // client-only fingerprint for easy lookups
        ipAddress: v.string(),
        userAgent: v.string(),
        queriesUsed: v.number(), // Will be 0 or 1
        sessionIds: v.array(v.id("sessions")), // Track demo sessions
        firstUsedAt: v.number(),
        lastUsedAt: v.number(),
    })
        .index("by_fingerprint", ["deviceFingerprint"])
        .index("by_client_fingerprint", ["clientFingerprint"])
        .index("by_ip", ["ipAddress"]),
});
