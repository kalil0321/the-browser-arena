import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import AnchorBrowser from "anchorbrowser";
import { api } from "../../../../../convex/_generated/api";
import { getToken } from "@/lib/auth/server";
import { badRequest, mapProviderError, serverMisconfigured, unauthorized, providerUnavailable } from "@/lib/http-errors";

// Python agent server URL
const AGENT_SERVER_URL = process.env.AGENT_SERVER_URL || "http://localhost:8080";

// Initialize browser client
const browser = new AnchorBrowser({ apiKey: process.env.ANCHOR_API_KEY });

export async function POST(request: NextRequest) {
    try {
        const {
            instruction,
            model,
            secrets,
            openaiApiKey,
            googleApiKey,
            anthropicApiKey,
            browserUseApiKey,
            filePath,
        } = await request.json();
        if (!instruction || typeof instruction !== 'string' || !instruction.trim()) {
            return badRequest("Field 'instruction' is required");
        }

        // Get user token for auth
        const token = await getToken();

        if (!token) {
            return unauthorized();
        }

        // Create Convex client per request for better isolation and set auth
        const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
        convex.setAuth(token);

        // Prepare Python server request data
        const providerModel = model || "browser-use/bu-1.0";

        if (!process.env.ANCHOR_API_KEY) {
            return serverMisconfigured("Missing ANCHOR_API_KEY", { provider: "anchor" });
        }
        // Get current user to create browser profile
        const user = await convex.query(api.auth.getCurrentUser, {});
        if (!user) {
            return unauthorized();
        }
        // getCurrentUser returns user with _id field (Convex document ID)
        const userId = user._id;

        // Create browser profile configuration using user_id
        const browserConfig = {
            browser: {
                profile: {
                    name: `profile-${userId}`,
                    persist: true
                }
            }
        };

        // CRITICAL: Parallelize browser session creation with Convex session creation
        // This saves 3-5 seconds by not blocking on browser session creation
        const [sessionResult, browserSession] = await Promise.all([
            convex.mutation(api.mutations.createSession, {
                instruction,
            }),
            browser.sessions.create(browserConfig),
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
        const agentServerApiKey = process.env.AGENT_SERVER_API_KEY;
        if (!agentServerApiKey) {
            return NextResponse.json({ error: "AGENT_SERVER_API_KEY is not configured" }, { status: 500 });
        }

        const agentResponse = await fetch(`${AGENT_SERVER_URL}/agent/browser-use`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${agentServerApiKey}`,
            },
            body: JSON.stringify({
                sessionId: dbSessionId,
                instruction,
                providerModel,
                browserSessionId,
                cdpUrl,
                liveViewUrl,
                ...(secrets ? { secrets } : {}),
                ...(openaiApiKey ? { openaiApiKey } : {}),
                ...(googleApiKey ? { googleApiKey } : {}),
                ...(anthropicApiKey ? { anthropicApiKey } : {}),
                ...(browserUseApiKey ? { browserUseApiKey } : {}),
                userId: userId,
                ...(filePath ? { filePath } : {}),
            }),
        });

        if (!agentResponse.ok) {
            return await mapProviderError(agentResponse, 'python-agent');
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

