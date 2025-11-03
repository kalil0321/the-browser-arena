import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import AnchorBrowser from "anchorbrowser";
import { Stagehand } from "@browserbasehq/stagehand";
import { after } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { badRequest, mapProviderError, serverMisconfigured } from "@/lib/http-errors";
import { getOrCreateSignedFingerprint } from "@/lib/fingerprint";
import { z } from "zod";
import { tool } from "ai";

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
        const body = await request.json();
        const instruction: string = body.instruction;
        const model: string | undefined = body.model;
        const agentType: string | undefined = body.agentType;
        const clientFingerprint: string | undefined = body.clientFingerprint;
        const agents: Array<{ agent: "stagehand" | "browser-use"; model?: string }> | undefined = body.agents;

        if (!instruction || typeof instruction !== 'string' || !instruction.trim()) {
            return badRequest("Field 'instruction' is required");
        }

        // If multi-agent payload provided, validate cap and supported agents
        const isMulti = Array.isArray(agents) && agents.length > 0;
        if (isMulti) {
            if (agents.length > 4) {
                return NextResponse.json({ error: "Maximum 4 agents allowed for demo" }, { status: 400 });
            }
            const unsupported = agents.find(a => !(a.agent === "stagehand" || a.agent === "browser-use"));
            if (unsupported) {
                return badRequest("Only 'stagehand' and 'browser-use' are supported in demo mode");
            }
        } else {
            // Backward-compat single-agent validation
            if (!agentType || !["stagehand", "browser-use"].includes(agentType)) {
                return badRequest("Field 'agentType' must be 'stagehand' or 'browser-use'");
            }
        }

        // clientFingerprint is optional now - we use it for display purposes but not for rate limiting
        // Rate limiting is now based on server-generated signed fingerprint from cookies

        // Get IP and User-Agent
        const ip = getClientIP(request);
        const userAgent = request.headers.get("user-agent") || "";

        // Get or create server-side signed fingerprint from cookie
        // This prevents clients from spoofing the fingerprint
        const cookieName = "demo_fingerprint";
        const cookieValue = request.cookies.get(cookieName)?.value || null;
        const { fingerprint: deviceFingerprint, cookieValue: fingerprintCookie } =
            await getOrCreateSignedFingerprint(cookieValue, ip, userAgent);

        // Use clientFingerprint if provided, otherwise use a placeholder
        const effectiveClientFingerprint = clientFingerprint || "unknown";

        // Create Convex client without auth for demo endpoint
        const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

        // Atomically claim a demo query slot BEFORE creating any resources
        // This prevents race conditions by checking the limit and incrementing
        // usage in a single transaction
        const claimResult = await convex.mutation(api.mutations.claimDemoQuerySlot, {
            deviceFingerprint,
            clientFingerprint: effectiveClientFingerprint,
            ipAddress: ip,
            userAgent: userAgent,
        });

        if (!claimResult.allowed || !claimResult.usageId) {
            // Return response without setting cookie if limit reached
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

        // Create one browser session per requested agent
        type BuiltAgent = {
            kind: "stagehand" | "browser-use";
            model: string;
            browserSessionId: string;
            liveViewUrl: string;
            cdpUrl: string;
        };

        const requestedAgents: Array<{ agent: "stagehand" | "browser-use"; model?: string }> = isMulti
            ? (agents as Array<{ agent: "stagehand" | "browser-use"; model?: string }>)
            : [{ agent: agentType as "stagehand" | "browser-use", model }];

        const builtAgents: BuiltAgent[] = [];
        for (const a of requestedAgents) {
            const modelForAgent = a.model ?? (a.agent === "browser-use" ? "browser-use/bu-1.0" : "google/gemini-2.5-flash");
            const profileConfig = {
                ...(a.agent === "stagehand" ? config : {}),
                browser: {
                    ...(a.agent === "stagehand" ? config.browser : {}),
                    profile: {
                        name: `demo-${deviceFingerprint}-${a.agent}-${Math.random().toString(36).slice(2, 8)}`,
                        persist: false,
                    }
                }
            };
            const sessionResp = await browser.sessions.create(profileConfig).catch((e: any) => {
                console.error("Error creating browser session:", e);
                return Promise.reject(e);
            });
            const live = sessionResp.data?.live_view_url ?? "";
            const sid = sessionResp.data?.id ?? "";
            const cdp = sessionResp.data?.cdp_url ?? "";
            if (!live || !cdp) {
                return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
            }
            builtAgents.push({ kind: a.agent, model: modelForAgent, browserSessionId: sid, liveViewUrl: live, cdpUrl: cdp });
        }

        // Create demo session with first agent bound
        const first = builtAgents[0];
        const createResult = await convex.mutation(api.mutations.createDemoSession, {
            instruction,
            browserData: {
                sessionId: first.browserSessionId,
                url: first.liveViewUrl,
            },
            agentName: first.kind,
            model: first.model,
        });

        const { sessionId: dbSessionId, agentId: firstAgentId } = createResult;
        if (!firstAgentId) {
            return NextResponse.json({ error: "Failed to create agent" }, { status: 500 });
        }

        // Associate the session with the demo usage record
        await convex.mutation(api.mutations.associateDemoSession, {
            usageId: claimResult.usageId,
            sessionId: dbSessionId,
        });

        // Create remaining agents via backend mutation (no auth required)
        const additionalAgentIds: string[] = [];
        for (let i = 1; i < builtAgents.length; i++) {
            const b = builtAgents[i];
            const newAgentId = await convex.mutation(api.mutations.createAgentFromBackend, {
                sessionId: dbSessionId,
                name: b.kind,
                model: b.model,
                browser: {
                    sessionId: b.browserSessionId,
                    url: b.liveViewUrl,
                },
            });
            additionalAgentIds.push(newAgentId as any);
        }

        const allAgentIds = [firstAgentId as any, ...additionalAgentIds];

        // Execute each agent in background
        after(async () => {
            const startTime = Date.now();
            await Promise.all(builtAgents.map(async (b, idx) => {
                const agentId = allAgentIds[idx];
                try {
                    if (b.kind === "stagehand") {
                        const modelString = b.model;
                        const stagehand = new Stagehand({
                            env: "LOCAL",
                            model: {
                                modelName: modelString,
                                apiKey: determineKey(modelString),
                            },
                            localBrowserLaunchOptions: {
                                cdpUrl: b.cdpUrl,
                            },
                        });

                        await stagehand.init();
                        const agent = await stagehand.agent({
                            model: modelString,
                            executionModel: modelString,
                            tools: {
                                uploadFile: tool({
                                    description: "Upload a file to the browser",
                                    inputSchema: z.object({
                                        locator: z.string(),
                                    }),
                                    execute: async ({ locator }) => {
                                        const page = stagehand.context.pages()[0];
                                        if (!page) {
                                            return {
                                                error: "No page found",
                                            };
                                        }
                                    },
                                }),
                            },
                        });

                        const { message, actions, usage, success, completed, metadata } = await agent.execute({
                            highlightCursor: true,
                            instruction,
                        });

                        await stagehand.close();
                        const endTime = Date.now();
                        const duration = (endTime - startTime) / 1000;

                        await browser.sessions.delete(b.browserSessionId);

                        // let recordingUrl = "";
                        // try {
                        //     const recording = await browser.sessions.recordings.primary.get(b.browserSessionId);
                        //     const arrayBuffer = await recording.arrayBuffer();
                        //     const base64 = Buffer.from(arrayBuffer).toString('base64');
                        //     recordingUrl = `data:video/mp4;base64,${base64}`;
                        // } catch (recordingError) {
                        //     console.error("Failed to get recording:", recordingError);
                        // }

                        const usageData = usage ?? { input_tokens: 0, output_tokens: 0, inference_time_ms: 0 };
                        const llmCost = computeCost(modelString, usageData);
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
                            success: true,
                            agent: "stagehand",
                            completed: true,
                            metadata,
                        };

                        await convexBackend.mutation(api.mutations.updateAgentResultFromBackend, {
                            agentId,
                            result: payload,
                            status: success ? "completed" as const : "failed" as const,
                        });
                    } else {
                        const providerModel = b.model || "browser-use/bu-1.0";
                        const agentServerApiKey = process.env.AGENT_SERVER_API_KEY;
                        if (!agentServerApiKey) {
                            console.error("AGENT_SERVER_API_KEY is not configured");
                        }
                        const agentResponse = await fetch(`${AGENT_SERVER_URL}/agent/browser-use`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                ...(agentServerApiKey ? { "Authorization": `Bearer ${agentServerApiKey}` } : {}),
                            },
                            body: JSON.stringify({
                                sessionId: dbSessionId,
                                instruction,
                                providerModel,
                                browserSessionId: b.browserSessionId,
                                cdpUrl: b.cdpUrl,
                                liveViewUrl: b.liveViewUrl,
                                userId: demoUserId,
                                agentId: agentId,
                            }),
                        });
                        if (!agentResponse.ok) {
                            await convexBackend.mutation(api.mutations.updateAgentStatusFromBackend, {
                                agentId,
                                status: "failed",
                                error: "Python agent execution failed",
                            });
                            await browser.sessions.delete(b.browserSessionId);
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
                        await browser.sessions.delete(b.browserSessionId);
                    } catch (cleanupError) {
                        console.error("❌ Error cleaning up session:", cleanupError);
                    }
                }
            }));
        });

        // Return session info immediately with cookie set
        const response = NextResponse.json({
            session: {
                id: dbSessionId,
            },
            agentIds: allAgentIds,
            isDemo: true,
        });

        // Set cookie for server-generated fingerprint
        // Cookie expires in 1 year to persist across sessions
        response.cookies.set(cookieName, fingerprintCookie, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 365, // 1 year
            path: "/",
        });

        return response;
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

