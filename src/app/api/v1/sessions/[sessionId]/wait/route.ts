import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../../convex/_generated/api";
import { authenticateRequest } from "@/lib/auth/api-auth";
import { Id } from "../../../../../../../convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const POLL_INTERVAL_MS = 2000;
const MAX_WAIT_MS = 120_000;

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> },
) {
    const auth = await authenticateRequest(request);
    if (!auth) {
        return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Invalid or missing authentication" } }, { status: 401 });
    }

    const { sessionId } = await params;
    const start = Date.now();

    // Optional timeout override from query param (max 120s)
    const url = new URL(request.url);
    const timeoutParam = parseInt(url.searchParams.get("timeout") || "", 10);
    const maxWait = Math.min(
        Number.isFinite(timeoutParam) && timeoutParam > 0 ? timeoutParam * 1000 : MAX_WAIT_MS,
        MAX_WAIT_MS,
    );

    while (Date.now() - start < maxWait) {
        try {
            const agents = await convex.query(api.queries.getSessionAgents, {
                sessionId: sessionId as Id<"sessions">,
            });

            if (!agents || agents.length === 0) {
                return NextResponse.json({ error: { code: "NOT_FOUND", message: "Session not found or has no agents" } }, { status: 404 });
            }

            const allDone = agents.every(
                (a: any) => a.status === "completed" || a.status === "failed",
            );

            if (allDone) {
                const session = await convex.query(api.queries.getSession, {
                    sessionId: sessionId as Id<"sessions">,
                });

                return NextResponse.json({
                    data: {
                        ...session,
                        agents,
                        completed: true,
                    },
                });
            }
        } catch {
            return NextResponse.json({ error: { code: "NOT_FOUND", message: "Session not found" } }, { status: 404 });
        }

        // Wait before polling again
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    // Timeout — return current state
    const agents = await convex.query(api.queries.getSessionAgents, {
        sessionId: sessionId as Id<"sessions">,
    });

    const session = await convex.query(api.queries.getSession, {
        sessionId: sessionId as Id<"sessions">,
    });

    return NextResponse.json({
        data: {
            ...session,
            agents,
            completed: false,
            message: "Timeout reached. Some agents are still running.",
        },
    }, { status: 200 });
}
