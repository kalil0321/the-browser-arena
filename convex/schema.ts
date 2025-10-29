import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    // Sessions table - stores user instruction
    sessions: defineTable({
        userId: v.string(),
        instruction: v.string(),
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
});
