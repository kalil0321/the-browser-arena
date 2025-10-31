import { after, NextRequest, NextResponse } from "next/server";
import { Stagehand } from "@browserbasehq/stagehand";
import AnchorBrowser from "anchorbrowser";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { getToken } from "@/lib/auth/server";
import { missingKey, serverMisconfigured, unauthorized, badRequest, providerUnavailable } from "@/lib/http-errors";

// Initialize the client
const browser = new AnchorBrowser({ apiKey: process.env.ANCHOR_API_KEY });

// Create a separate Convex client for background tasks (no auth needed - uses backend mutations)
const convexBackend = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// For explicit headfull session configuration (optional, default to false)
const config = {
    browser: {
        headless: {
            active: false
        }
    }
};

const determineKey = (model: string | undefined) => {
    if (!model) {
        return process.env.GOOGLE_API_KEY;
    }
    const provider = model.split("/")[0];
    if (provider === "google") {
        return process.env.GOOGLE_API_KEY;
    }
    if (provider === "openai") {
        return process.env.OPENAI_API_KEY;
    }
    if (provider === "anthropic") {
        return process.env.ANTHROPIC_API_KEY;
    }

    return process.env.OPENAI_API_KEY;
}

// LLM pricing per 1M tokens
const pricing: Record<string, { in: number; out: number; cached: number }> = {
    "google/gemini-2.5-flash": {
        in: 0.3 / 1_000_000,
        out: 2.5 / 1_000_000,
        cached: 0.03 / 1_000_000,
    },
    "google/gemini-2.5-pro": {
        in: 1.25 / 1_000_000,
        out: 10.0 / 1_000_000,
        cached: 0.3125 / 1_000_000,
    },
    "openai/gpt-4.1": {
        in: 2.0 / 1_000_000,
        out: 8.0 / 1_000_000,
        cached: 0.5 / 1_000_000,
    },
    "anthropic/claude-haiku-4.5": {
        in: 1.0 / 1_000_000,
        out: 5.0 / 1_000_000,
        cached: 0.1 / 1_000_000,
    },
};

function computeCost(model: string | undefined, usage: any): number {
    if (!usage) return 0;

    const modelKey = model ?? "google/gemini-2.5-flash";
    const price = pricing[modelKey] || {
        in: 0.5 / 1_000_000,
        out: 3.0 / 1_000_000,
        cached: 0.1 / 1_000_000,
    };

    const inputTokens = usage.input_tokens || 0;
    const outputTokens = usage.output_tokens || 0;
    const cachedTokens = usage.cached_tokens || usage.input_tokens_cached || 0;

    return (
        inputTokens * price.in +
        outputTokens * price.out +
        cachedTokens * price.cached
    );
}

export async function POST(request: NextRequest) {
    try {
        const { instruction, model, sessionId: existingSessionId } = await request.json();
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
        const providerKey = determineKey(model);
        if (!providerKey) {
            return serverMisconfigured("Missing LLM provider API key", { model });
        }

        // Create browser session (external API call) - this is the main bottleneck
        const browserSession = await browser.sessions.create(config).catch((e: any) => {
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

        after(async () => {
            const startTime = Date.now();
            try {
                const modelString = model ?? "google/gemini-2.5-flash";
                const stagehand = new Stagehand({
                    env: "LOCAL",
                    model: {
                        modelName: modelString,
                        apiKey: determineKey(model),
                    },
                    localBrowserLaunchOptions: {
                        cdpUrl: cdpUrl,
                    },
                });

                await stagehand.init();
                const agent = await stagehand.agent();

                const { message, actions, usage, success, completed, metadata } = await agent.execute({
                    highlightCursor: true,
                    instruction,
                });

                await stagehand.close();
                const endTime = Date.now();
                const duration = (endTime - startTime) / 1000; // Convert to seconds

                // Get recording before deleting
                let recordingUrl = "";
                try {
                    const recording = await browser.sessions.recordings.primary.get(browserSessionId);
                    const arrayBuffer = await recording.arrayBuffer();
                    const base64 = Buffer.from(arrayBuffer).toString('base64');
                    recordingUrl = `data:video/mp4;base64,${base64}`;
                    console.log("Recording captured, length:", recordingUrl.length);
                } catch (recordingError) {
                    console.error("Failed to get recording:", recordingError);
                }

                // Delete browser session
                await browser.sessions.delete(browserSessionId);

                const usageData = usage ?? { input_tokens: 0, output_tokens: 0, inference_time_ms: 0 };
                const llmCost = computeCost(model, usageData);
                // Anchor Browser pricing: $0.01 base + $0.05 per hour
                const hours = Math.max(duration / 3600, 0);
                const browserCost = 0.01 + 0.05 * hours;
                const cost = llmCost + browserCost;

                const payload = {
                    usage: {
                        ...usageData,
                        total_cost: cost,
                        browser_cost: browserCost,
                        llm_cost: llmCost,
                    },
                    cost, // Also keep cost field for backward compatibility
                    duration,
                    message,
                    actions,
                    success,
                    agent: "stagehand",
                    completed,
                    metadata,
                }

                // Save result to Convex database using backend mutation (no auth required)
                await convexBackend.mutation(api.mutations.updateAgentResultFromBackend, {
                    agentId,
                    result: payload,
                    status: success ? "completed" as const : "failed" as const,
                });

                // Save recording URL if available
                if (recordingUrl) {
                    await convexBackend.mutation(api.mutations.updateAgentRecordingUrlFromBackend, {
                        agentId,
                        recordingUrl,
                    });
                }

                console.log(JSON.stringify(payload, null, 2));
            } catch (error) {
                console.error("❌ Error in background execution:", error);
                try {
                    // Update agent status to failed using backend mutation
                    await convexBackend.mutation(api.mutations.updateAgentStatusFromBackend, {
                        agentId,
                        status: "failed",
                    });

                    await browser.sessions.delete(browserSessionId);
                } catch (cleanupError) {
                    console.error("❌ Error cleaning up session:", cleanupError);
                }
            }
        });

        // return session object and live view url
        return NextResponse.json({
            session: {
                id: dbSessionId,
            },
            agentId,
            liveViewUrl: liveViewUrl,
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