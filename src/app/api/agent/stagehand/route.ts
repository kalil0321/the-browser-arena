import { after, NextRequest, NextResponse } from "next/server";
import AnchorBrowser from "anchorbrowser";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { getToken } from "@/lib/auth/server";
import { missingKey, serverMisconfigured, unauthorized, badRequest } from "@/lib/http-errors";

// Stagehand server URL - dev: localhost:3001, prod: stagehand.thebrowserarena.com
// const STAGEHAND_SERVER_URL = "https://stagehand.thebrowserarena.com"
const STAGEHAND_SERVER_URL = process.env.NODE_ENV === "development" ? "http://localhost:3001" : "https://stagehand.thebrowserarena.com";


// Initialize the client
const browser = new AnchorBrowser({ apiKey: process.env.ANCHOR_API_KEY });

// Backend Convex client (no auth) for status updates from this route if needed
const convexBackend = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Browser session configuration
const config = {
    browser: {
        headless: {
            active: false
        }
    }
};


export async function POST(request: NextRequest) {
    try {
        const { instruction, model, sessionId: existingSessionId, openaiApiKey, googleApiKey, anthropicApiKey, openrouterApiKey, thinkingModel, executionModel, fileData } = await request.json();
        if (!instruction || typeof instruction !== 'string' || !instruction.trim()) {
            return badRequest("Field 'instruction' is required");
        }

        // Get user token for auth
        const token = await getToken();

        if (!token) {
            return unauthorized();
        }

        // Create Convex client per request for better isolation
        const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
        convex.setAuth(token);

        // Ensure required server env keys exist
        if (!process.env.ANCHOR_API_KEY) {
            return serverMisconfigured("Missing ANCHOR_API_KEY", { provider: "anchor" });
        }

        const agentServerApiKey = process.env.AGENT_SERVER_API_KEY;
        if (!agentServerApiKey) {
            return NextResponse.json({ error: "AGENT_SERVER_API_KEY is not configured" }, { status: 500 });
        }

        // Get current user to create browser profile
        const user = await convex.query(api.auth.getCurrentUser, {});
        if (!user) {
            return unauthorized();
        }
        // getCurrentUser returns user with _id field (Convex document ID)
        const userId = user._id;

        // Create browser profile configuration using user_id
        const browserProfileConfig = {
            ...config,
            browser: {
                ...config.browser,
                profile: {
                    name: `profile-${userId}`,
                    persist: true
                }
            }
        };

        // Create browser session (external API call) - this is the main bottleneck
        const browserSession = await browser.sessions.create(browserProfileConfig).catch((e: any) => {
            if (e?.status === 401 || e?.status === 403) {
                return Promise.reject(missingKey("Anchor Browser", true));
            }
            return Promise.reject(e);
        });
        const liveViewUrl = browserSession.data?.live_view_url ?? "";
        const browserSessionId = browserSession.data?.id ?? "";
        const cdpUrl = browserSession.data?.cdp_url ?? "";

        if (!liveViewUrl) {
            console.error("❌ Failed to create session - no live_view_url");
            return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
        }

        if (!cdpUrl) {
            console.error("❌ Failed to create session - no cdp_url");
            return NextResponse.json({ error: "Failed to create session - missing cdp_url" }, { status: 500 });
        }

        let dbSessionId: string;
        let agentId: any; // Use any to avoid type conflicts with Convex ID types

        // If sessionId is provided, add agent to existing session
        // Otherwise, create a new session
        if (existingSessionId) {
            agentId = await convex.mutation(api.mutations.createAgent, {
                sessionId: existingSessionId,
                name: "stagehand",
                model: model ?? "google/gemini-2.5-flash",
                browser: {
                    sessionId: browserSessionId,
                    url: liveViewUrl,
                },
            });
            dbSessionId = existingSessionId;
        } else {
            // Create both session and agent in the database at the same time
            const result = await convex.mutation(api.mutations.createSession, {
                instruction,
                browserData: {
                    sessionId: browserSessionId,
                    url: liveViewUrl,
                },
                agentName: "stagehand",
                model: model ?? "google/gemini-2.5-flash",
            });
            dbSessionId = result.sessionId;
            agentId = result.agentId!;
        }

        if (!agentId) {
            return NextResponse.json({ error: "Failed to create agent" }, { status: 500 });
        }

        // Fire-and-forget: run Stagehand in background to avoid frontend timeout
        after(async () => {
            try {
                const resp = await fetch(`${STAGEHAND_SERVER_URL}/agent/stagehand`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${agentServerApiKey}`,
                    },
                    body: JSON.stringify({
                        sessionId: dbSessionId,
                        instruction,
                        model: model ?? "google/gemini-2.5-flash",
                        thinkingModel,
                        executionModel,
                        cdpUrl,
                        liveViewUrl,
                        agentId,
                        userId: userId,
                        keys: {
                            openai: openaiApiKey,
                            google: googleApiKey,
                            anthropic: anthropicApiKey,
                            openrouter: openrouterApiKey,
                        },
                        ...(fileData ? { fileData } : {}),
                    }),
                });

                if (!resp.ok) {
                    // Mark failed so UI can reflect error
                    await convexBackend.mutation(api.mutations.updateAgentStatusFromBackend, {
                        agentId,
                        status: "failed",
                    });
                }
            } catch (err) {
                try {
                    await convexBackend.mutation(api.mutations.updateAgentStatusFromBackend, {
                        agentId,
                        status: "failed",
                    });
                } catch { }
            }
        });

        // Return session info with live URL immediately (non-blocking)
        return NextResponse.json({
            session: {
                id: dbSessionId,
            },
            agentId,
            liveViewUrl,
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