import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";
import { authenticateRequest } from "@/lib/auth/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { Id } from "../../../../../../convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> },
) {
    const auth = await authenticateRequest(request);
    if (!auth) {
        return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Invalid or missing authentication" } }, { status: 401 });
    }

    const rl = checkRateLimit(auth.userId, "read");
    if (rl) return rl;

    const { sessionId } = await params;

    try {
        const session = await convex.query(api.queries.getSession, {
            sessionId: sessionId as Id<"sessions">,
        });

        if (!session) {
            return NextResponse.json({ error: { code: "NOT_FOUND", message: "Session not found" } }, { status: 404 });
        }

        const agents = await convex.query(api.queries.getSessionAgents, {
            sessionId: sessionId as Id<"sessions">,
        });

        return NextResponse.json({
            data: {
                ...session,
                agents,
            },
        });
    } catch {
        return NextResponse.json({ error: { code: "NOT_FOUND", message: "Session not found" } }, { status: 404 });
    }
}
