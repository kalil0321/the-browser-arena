import { v } from "convex/values";
import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { getUser } from "./auth";

export const createApiKey = mutation({
    args: { label: v.string() },
    handler: async (ctx, { label }) => {
        const user = await getUser(ctx);
        if (!user) throw new Error("Unauthorized");

        if (!label.trim()) throw new Error("Label is required");

        // Generate raw key: sk_tba_ + 32 random hex chars
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
        const rawKey = `sk_tba_${hex}`;

        // SHA-256 hash for storage
        const hashBuffer = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(rawKey),
        );
        const keyHash = Array.from(new Uint8Array(hashBuffer), (b) =>
            b.toString(16).padStart(2, "0"),
        ).join("");

        const keyPrefix = rawKey.slice(0, 12);

        await ctx.db.insert("apiKeys", {
            userId: user._id,
            keyHash,
            keyPrefix,
            label: label.trim(),
            createdAt: Date.now(),
        });

        return { rawKey };
    },
});

export const listApiKeys = query({
    args: {},
    handler: async (ctx) => {
        const user = await getUser(ctx);
        if (!user) return [];

        const keys = await ctx.db
            .query("apiKeys")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .collect();

        return keys.map((k) => ({
            _id: k._id,
            keyPrefix: k.keyPrefix,
            label: k.label,
            lastUsedAt: k.lastUsedAt,
            revokedAt: k.revokedAt,
            createdAt: k.createdAt,
        }));
    },
});

export const revokeApiKey = mutation({
    args: { keyId: v.id("apiKeys") },
    handler: async (ctx, { keyId }) => {
        const user = await getUser(ctx);
        if (!user) throw new Error("Unauthorized");

        const key = await ctx.db.get(keyId);
        if (!key || key.userId !== user._id) throw new Error("Not found");
        if (key.revokedAt) throw new Error("Already revoked");

        await ctx.db.patch(keyId, { revokedAt: Date.now() });
    },
});

// Internal query for API key validation (called from Next.js API routes)
export const validateApiKeyHash = query({
    args: { keyHash: v.string() },
    handler: async (ctx, { keyHash }) => {
        const key = await ctx.db
            .query("apiKeys")
            .withIndex("by_key_hash", (q) => q.eq("keyHash", keyHash))
            .first();

        if (!key || key.revokedAt) return null;
        return { userId: key.userId, keyId: key._id };
    },
});

// Internal mutation to update lastUsedAt
export const touchApiKey = mutation({
    args: { keyId: v.id("apiKeys") },
    handler: async (ctx, { keyId }) => {
        const key = await ctx.db.get(keyId);
        if (key) {
            await ctx.db.patch(keyId, { lastUsedAt: Date.now() });
        }
    },
});
