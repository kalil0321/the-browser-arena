import { after, NextRequest, NextResponse } from "next/server";
import { Stagehand } from "@browserbasehq/stagehand";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { getToken } from "@/lib/auth/server";

// Create a separate Convex client for background tasks (no auth needed - uses backend mutations)
const convexBackend = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Initialize Browserbase client helper
const getBrowserbaseConfig = () => {
    const apiKey = process.env.BROWSERBASE_API_KEY;
    const projectId = process.env.BROWSERBASE_PROJECT_ID;

    if (!apiKey) {
        throw new Error("BROWSERBASE_API_KEY environment variable is required");
    }
    if (!projectId) {
        throw new Error("BROWSERBASE_PROJECT_ID environment variable is required");
    }

    return { apiKey, projectId };
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
    "anthropic/claude-4.5-haiku": {
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

        // Get user token for auth
        const token = await getToken();

        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Create Convex client per request for better isolation
        const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
        convex.setAuth(token);

        // Get Browserbase config
        const browserbaseConfig = getBrowserbaseConfig();
        const modelString = model ?? "google/gemini-2.5-flash";

        // Browserbase manages sessions internally, so we don't create a browser session manually
        // The live view URL will be available from Stagehand after init
        let liveViewUrl = "";

        let dbSessionId: string;
        let agentId: any; // Use any to avoid type conflicts with Convex ID types

        // If sessionId is provided, add agent to existing session
        // Otherwise, create a new session
        if (existingSessionId) {
            agentId = await convex.mutation(api.mutations.createAgent, {
                sessionId: existingSessionId,
                name: "stagehand-cloud",
                model: modelString,
                browser: {
                    sessionId: "", // Browserbase session ID will be set after init
                    url: liveViewUrl,
                },
            });
            dbSessionId = existingSessionId;
        } else {
            // Create both session and agent in the database at the same time
            const result = await convex.mutation(api.mutations.createSession, {
                instruction,
                browserData: {
                    sessionId: "", // Browserbase session ID will be set after init
                    url: liveViewUrl,
                },
                agentName: "stagehand-cloud",
                model: modelString,
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
                const stagehand = new Stagehand({
                    env: "BROWSERBASE",
                    apiKey: browserbaseConfig.apiKey,
                    projectId: browserbaseConfig.projectId,
                    model: {
                        modelName: modelString,
                        apiKey: determineKey(model),
                    },
                });

                await stagehand.init();

                const agent = await stagehand.agent();

                const { message, actions, usage, success, completed, metadata } = await agent.execute({
                    highlightCursor: true,
                    instruction,
                });

                // Try to get metrics to retrieve session info if available
                let browserbaseSessionId = "";
                try {
                    const metrics = await stagehand.metrics;
                    // Browserbase session info might be in metadata
                    browserbaseSessionId = (metadata as any)?.sessionId || "";
                } catch (e) {
                    console.log("Could not retrieve metrics/session info");
                }

                // Try to update live URL from stagehand context if available
                try {
                    // Browserbase may expose live URL through different means
                    // This might need to be adjusted based on actual Browserbase API
                    const updatedLiveUrl = (metadata as any)?.liveUrl ||
                        (metadata as any)?.live_view_url ||
                        "";
                    if (updatedLiveUrl && updatedLiveUrl !== liveViewUrl) {
                        liveViewUrl = updatedLiveUrl;
                        await convexBackend.mutation(api.mutations.updateAgentBrowserUrlFromBackend, {
                            agentId,
                            url: liveViewUrl,
                        });
                    }
                } catch (e) {
                    console.log("Could not update live URL");
                }

                await stagehand.close();
                const endTime = Date.now();
                const duration = (endTime - startTime) / 1000; // Convert to seconds

                const usageData = usage ?? { input_tokens: 0, output_tokens: 0, inference_time_ms: 0 };
                const llmCost = computeCost(model, usageData);
                // Browserbase pricing: $0.2 per hour
                const hours = Math.max(duration / 3600, 0);
                const browserCost = 0.2 * hours;
                const cost = llmCost + browserCost;

                const payload = {
                    usage: {
                        ...usageData,
                        total_cost: cost,
                        browser_cost: browserCost,
                        llm_cost: llmCost,
                    },
                    cost,
                    duration,
                    message,
                    actions,
                    success,
                    agent: "stagehand-cloud",
                    completed,
                    metadata: {
                        ...metadata,
                        browserbaseSessionId,
                    },
                }

                // Save result to Convex database using backend mutation (no auth required)
                await convexBackend.mutation(api.mutations.updateAgentResultFromBackend, {
                    agentId,
                    result: payload,
                    status: success ? "completed" as const : "failed" as const,
                });

                // Update browser session ID if we got it
                if (browserbaseSessionId) {
                    await convexBackend.mutation(api.mutations.updateAgentBrowserUrlFromBackend, {
                        agentId,
                        url: liveViewUrl || "",
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
                } catch (cleanupError) {
                    console.error("❌ Error updating agent status:", cleanupError);
                }
            }
        });

        // Return session object and live view url (may be empty initially)
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

