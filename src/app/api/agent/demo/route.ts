import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import AnchorBrowser from "anchorbrowser";
import { Stagehand } from "@browserbasehq/stagehand";
import { after } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { badRequest, mapProviderError, serverMisconfigured } from "@/lib/http-errors";
import { createHybridFingerprint } from "@/lib/fingerprint";

// Python agent server URL
const AGENT_SERVER_URL = process.env.AGENT_SERVER_URL || "http://localhost:8080";

// Initialize browser client
const browser = new AnchorBrowser({ apiKey: process.env.ANCHOR_API_KEY });

// Create a separate Convex client for background tasks (no auth needed)
const convexBackend = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// For explicit headfull session configuration
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
    return process.env.GOOGLE_API_KEY;
};

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

// Get client IP address from request
function getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
        return forwarded.split(",")[0].trim();
    }
    const realIP = request.headers.get("x-real-ip");
    if (realIP) {
        return realIP;
    }
    return "unknown";
}

export async function POST(request: NextRequest) {
    try {
        const { instruction, model, agentType, clientFingerprint } = await request.json();

        if (!instruction || typeof instruction !== 'string' || !instruction.trim()) {
            return badRequest("Field 'instruction' is required");
        }

        if (!agentType || !["stagehand", "browser-use"].includes(agentType)) {
            return badRequest("Field 'agentType' must be 'stagehand' or 'browser-use'");
        }

        if (!clientFingerprint || typeof clientFingerprint !== 'string') {
            return badRequest("Field 'clientFingerprint' is required");
        }

        // Get IP and User-Agent
        const ip = getClientIP(request);
        const userAgent = request.headers.get("user-agent") || "";

        // Create hybrid fingerprint
        const deviceFingerprint = await createHybridFingerprint(clientFingerprint, ip, userAgent);

        // Create Convex client without auth for demo endpoint
        const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

        // Atomically claim a demo query slot BEFORE creating any resources
        // This prevents race conditions by checking the limit and incrementing
        // usage in a single transaction
        const claimResult = await convex.mutation(api.mutations.claimDemoQuerySlot, {
            deviceFingerprint,
            clientFingerprint,
            ipAddress: ip,
            userAgent: userAgent,
        });

        if (!claimResult.allowed) {
            return NextResponse.json(
                {
                    error: "DEMO_LIMIT_REACHED",
                    message: "You've used your free demo query. Create an account to continue!",
                    queriesUsed: claimResult.queriesUsed,
                    maxQueries: claimResult.maxQueries,
                },
                { status: 403 }
            );
        }

        // Ensure required server env keys exist
        if (!process.env.ANCHOR_API_KEY) {
            return serverMisconfigured("Missing ANCHOR_API_KEY", { provider: "anchor" });
        }

        const demoUserId = "demo-user";

        // Create browser profile configuration
        const browserProfileConfig = {
            ...(agentType === "stagehand" ? config : {}),
            browser: {
                ...(agentType === "stagehand" ? config.browser : {}),
                profile: {
                    name: `demo-${deviceFingerprint}`,
                    persist: false, // Don't persist demo sessions
                }
            }
        };

        // Create browser session
        const browserSession = await browser.sessions.create(browserProfileConfig).catch((e: any) => {
            console.error("Error creating browser session:", e);
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

        // Create demo session and agent in Convex
        const result = await convex.mutation(api.mutations.createDemoSession, {
            instruction,
            browserData: {
                sessionId: browserSessionId,
                url: liveViewUrl,
            },
            agentName: agentType,
            model: model ?? "google/gemini-2.5-flash",
        });

        const { sessionId: dbSessionId, agentId } = result;

        if (!agentId) {
            return NextResponse.json({ error: "Failed to create agent" }, { status: 500 });
        }

        // Associate the session with the demo usage record
        await convex.mutation(api.mutations.associateDemoSession, {
            usageId: claimResult.usageId,
            sessionId: dbSessionId,
        });

        // Execute agent in background based on type
        after(async () => {
            const startTime = Date.now();
            try {
                if (agentType === "stagehand") {
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
                    const duration = (endTime - startTime) / 1000;

                    // Get recording before deleting
                    let recordingUrl = "";
                    try {
                        const recording = await browser.sessions.recordings.primary.get(browserSessionId);
                        const arrayBuffer = await recording.arrayBuffer();
                        const base64 = Buffer.from(arrayBuffer).toString('base64');
                        recordingUrl = `data:video/mp4;base64,${base64}`;
                    } catch (recordingError) {
                        console.error("Failed to get recording:", recordingError);
                    }

                    // Delete browser session
                    await browser.sessions.delete(browserSessionId);

                    const usageData = usage ?? { input_tokens: 0, output_tokens: 0, inference_time_ms: 0 };
                    const llmCost = computeCost(model, usageData);
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
                        cost,
                        duration,
                        message,
                        actions,
                        success,
                        agent: "stagehand",
                        completed,
                        metadata,
                    };

                    await convexBackend.mutation(api.mutations.updateAgentResultFromBackend, {
                        agentId,
                        result: payload,
                        status: success ? "completed" as const : "failed" as const,
                    });

                    if (recordingUrl) {
                        await convexBackend.mutation(api.mutations.updateAgentRecordingUrlFromBackend, {
                            agentId,
                            recordingUrl,
                        });
                    }
                } else if (agentType === "browser-use") {
                    // Browser-Use execution
                    const providerModel = model || "browser-use/bu-1.0";

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
                            userId: demoUserId,
                            agentId: agentId, // Pass the agentId to avoid duplicate creation
                        }),
                    });

                    if (!agentResponse.ok) {
                        await convexBackend.mutation(api.mutations.updateAgentStatusFromBackend, {
                            agentId,
                            status: "failed",
                            error: "Python agent execution failed",
                        });
                        await browser.sessions.delete(browserSessionId);
                    } else {
                        const agentData = await agentResponse.json();
                        console.log("Browser-Use execution completed", agentData);
                    }
                }
            } catch (error) {
                console.error("❌ Error in background execution:", error);
                try {
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

        // Return session info immediately
        return NextResponse.json({
            session: {
                id: dbSessionId,
            },
            agentId,
            liveViewUrl: liveViewUrl,
            isDemo: true,
        });
    } catch (error) {
        console.error("❌ Error in demo POST handler:", error);
        return NextResponse.json(
            {
                error: "Internal server error",
                message: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}

