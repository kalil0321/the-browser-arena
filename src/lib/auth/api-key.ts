import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function authenticateApiKey(
    request: Request,
): Promise<{ userId: string; keyId: string } | null> {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer sk_tba_")) return null;

    const rawKey = authHeader.slice("Bearer ".length);

    // SHA-256 hash
    const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(rawKey),
    );
    const keyHash = Array.from(new Uint8Array(hashBuffer), (b) =>
        b.toString(16).padStart(2, "0"),
    ).join("");

    const result = await convex.query(api.apiKeys.validateApiKeyHash, { keyHash });
    if (!result) return null;

    // Fire-and-forget lastUsedAt update
    convex.mutation(api.apiKeys.touchApiKey, { keyId: result.keyId }).catch(() => {});

    return { userId: result.userId, keyId: result.keyId };
}
