import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import AnchorBrowser from "anchorbrowser";
import { api } from "../../../../../convex/_generated/api";
import { getToken } from "@/lib/auth/server";

// Python agent server URL
const AGENT_SERVER_URL = process.env.AGENT_SERVER_URL || "http://localhost:8080";

// Initialize browser client
const browser = new AnchorBrowser({ apiKey: process.env.ANCHOR_API_KEY });

export async function POST(request: NextRequest) {
    try {
        const { instruction, model } = await request.json();

        // Get user token for auth
        const token = await getToken();

        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Create Convex client per request for better isolation and set auth
        const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
        convex.setAuth(token);

        // Prepare Python server request data
        const providerModel = model || "browser-use/bu-1.0";

        // CRITICAL: Parallelize browser session creation with Convex session creation
        // This saves 3-5 seconds by not blocking on browser session creation
        const [sessionResult, browserSession] = await Promise.all([
            convex.mutation(api.mutations.createSession, {
                instruction,
            }),
            browser.sessions.create(),
        ]);

        const { sessionId: dbSessionId } = sessionResult;
        const browserSessionId = browserSession.data?.id ?? "";
        const cdpUrl = browserSession.data?.cdp_url ?? "";
        const liveViewUrl = browserSession.data?.live_view_url ?? "";

        if (!liveViewUrl) {
            return NextResponse.json({ error: "Failed to create browser session - no live_view_url" }, { status: 500 });
        }

        if (!cdpUrl) {
            return NextResponse.json({ error: "Failed to create browser session - no cdp_url" }, { status: 500 });
        }

        // Call Python agent server with browser session info (no blocking browser creation!)
        const agentResponse = await fetch(`${AGENT_SERVER_URL}/agent/browser-use`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                sessionId: dbSessionId,
                instruction,
                providerModel,
                browserSessionId,
                cdpUrl,
                liveViewUrl,
            }),
        });

        if (!agentResponse.ok) {
            const errorText = await agentResponse.text();
            return NextResponse.json(
                { error: `Agent server error: ${errorText}` },
                { status: agentResponse.status }
            );
        }

        const agentData = await agentResponse.json();

        // Return session info with live URL immediately
        return NextResponse.json({
            session: {
                id: dbSessionId,
            },
            agentId: agentData.agentId,
            liveViewUrl: agentData.liveUrl,
            browserSessionId: agentData.browserSessionId,
        });
    } catch (error) {
        console.error("❌ Error in POST handler:", error);
        return NextResponse.json(
            {
                error: "Internal server error",
                message: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}

