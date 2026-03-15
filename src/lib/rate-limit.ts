import { NextResponse } from "next/server";

interface RateLimitEntry {
    timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
    const cutoff = Date.now() - 120_000;
    for (const [key, entry] of store) {
        entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
        if (entry.timestamps.length === 0) store.delete(key);
    }
}, 300_000);

/**
 * Check rate limit for a user+action combo.
 * Returns null if allowed, or a NextResponse 429 if exceeded.
 */
export function checkRateLimit(
    userId: string,
    action: "write" | "read",
): NextResponse | null {
    const maxRequests = action === "write" ? 10 : 60;
    const windowMs = 60_000;

    const key = `${userId}:${action}`;
    const now = Date.now();
    const cutoff = now - windowMs;

    let entry = store.get(key);
    if (!entry) {
        entry = { timestamps: [] };
        store.set(key, entry);
    }

    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

    if (entry.timestamps.length >= maxRequests) {
        const retryAfter = Math.ceil((entry.timestamps[0] + windowMs - now) / 1000);
        return NextResponse.json(
            {
                error: {
                    code: "RATE_LIMITED",
                    message: `Too many requests. Limit: ${maxRequests} per minute for ${action} operations.`,
                },
            },
            {
                status: 429,
                headers: { "Retry-After": String(retryAfter) },
            },
        );
    }

    entry.timestamps.push(now);
    return null;
}
