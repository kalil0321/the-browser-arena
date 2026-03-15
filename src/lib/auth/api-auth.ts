import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { getToken } from "./server";
import { authenticateApiKey } from "./api-key";

export interface AuthResult {
    userId: string;
    authMethod: "cookie" | "api-key";
}

/**
 * Unified auth: tries cookie auth first, falls back to API key.
 * Used by all /api/v1/ routes.
 */
export async function authenticateRequest(
    request: Request,
): Promise<AuthResult | null> {
    // 1. Try cookie auth
    try {
        const token = await getToken();
        if (token) {
            const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
            convex.setAuth(token);
            const user = await convex.query(api.auth.getCurrentUser, {});
            if (user) {
                return { userId: user._id, authMethod: "cookie" };
            }
        }
    } catch {
        // Cookie auth failed, try API key
    }

    // 2. Try API key auth
    const apiKeyResult = await authenticateApiKey(request);
    if (apiKeyResult) {
        return { userId: apiKeyResult.userId, authMethod: "api-key" };
    }

    return null;
}
