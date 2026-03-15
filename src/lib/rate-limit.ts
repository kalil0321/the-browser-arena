import { NextResponse } from "next/server";

/**
 * Check rate limit for a user+action combo.
 * Returns null if allowed, or a NextResponse 429 if exceeded.
 *
 * TODO: Implement with Redis. Currently a no-op pass-through.
 */
export function checkRateLimit(
    _userId: string,
    _action: "write" | "read",
): NextResponse | null {
    return null;
}
