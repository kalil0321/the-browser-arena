import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { after } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { badRequest } from "@/lib/http-errors";
import { getOrCreateSignedFingerprint } from "@/lib/fingerprint";
import { validateInstruction, logValidationFailure } from "@/lib/instruction-validation";
import { createBrowserSession, deleteBrowserSession } from "@/lib/browser";

export const runtime = "nodejs";

// Python agent server URL
const AGENT_SERVER_URL = process.env.AGENT_SERVER_URL || "http://localhost:8080";

// Stagehand server URL
const STAGEHAND_SERVER_URL = process.env.NODE_ENV === "development" ? "http://localhost:3001" : "https://stagehand.thebrowserarena.com";

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

        // Validate instruction for prompt injection attempts
        const validationResult = validateInstruction(instruction);
        if (!validationResult.isValid) {
            logValidationFailure(instruction, validationResult, undefined, "demo-route");
            return badRequest(validationResult.error || "Invalid instruction");
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
            const { browserSessionId, cdpUrl, liveViewUrl } = await createBrowserSession(profileConfig).catch((e: any) => {
                console.error("Error creating browser session:", e);
                return Promise.reject(e);
            });

            if (!liveViewUrl || !cdpUrl) {
                return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
            }
            builtAgents.push({ kind: a.agent, model: modelForAgent, browserSessionId, liveViewUrl, cdpUrl });
        }

        // Create demo session with all agents
        // Since demo route is unauthenticated, we create agents directly in createDemoSession
        // instead of using createAgentFromBackend (which is meant for authenticated users or backend services)
        const first = builtAgents[0];
        const createResult = await convex.mutation(api.mutations.createDemoSession, {
            instruction,
            browserData: {
                sessionId: first.browserSessionId,
                url: first.liveViewUrl,
            },
            agentName: first.kind,
            model: first.model,
            // Pass additional agents data to create them all at once
            additionalAgents: builtAgents.slice(1).map(b => ({
                name: b.kind,
                model: b.model,
                browser: {
                    sessionId: b.browserSessionId,
                    url: b.liveViewUrl,
                },
            })),
        });

        const { sessionId: dbSessionId, agentIds } = createResult;
        if (!agentIds || agentIds.length === 0) {
            return NextResponse.json({ error: "Failed to create agents" }, { status: 500 });
        }

        // Associate the session with the demo usage record
        await convex.mutation(api.mutations.associateDemoSession, {
            usageId: claimResult.usageId,
            sessionId: dbSessionId,
        });

        const allAgentIds = agentIds;

        // Execute each agent in background
        after(async () => {
            await Promise.all(builtAgents.map(async (b, idx) => {
                const agentId = allAgentIds[idx];
                try {
                    if (b.kind === "stagehand") {
                        const modelString = b.model;
                        const agentServerApiKey = process.env.AGENT_SERVER_API_KEY;
                        if (!agentServerApiKey) {
                            console.error("AGENT_SERVER_API_KEY is not configured");
                        }

                        const resp = await fetch(`${STAGEHAND_SERVER_URL}/agent/stagehand`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${agentServerApiKey}`,
                            },
                            body: JSON.stringify({
                                sessionId: dbSessionId,
                                instruction,
                                model: modelString,
                                cdpUrl: b.cdpUrl,
                                liveViewUrl: b.liveViewUrl,
                                agentId: agentId,
                                userId: demoUserId,
                                keys: {
                                    openai: process.env.OPENAI_API_KEY,
                                    google: process.env.GOOGLE_API_KEY,
                                    anthropic: process.env.ANTHROPIC_API_KEY,
                                    openrouter: process.env.OPENROUTER_API_KEY,
                                },
                            }),
                        });

                        if (!resp.ok) {
                            await convexBackend.mutation(api.mutations.updateAgentStatusFromBackend, {
                                agentId,
                                status: "failed",
                                error: "Stagehand server execution failed",
                            });
                            await deleteBrowserSession(b.browserSessionId);
                        } else {
                            const agentData = await resp.json();
                            console.log("Stagehand execution completed", agentData);
                        }
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
                            await deleteBrowserSession(b.browserSessionId);
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
                        await deleteBrowserSession(b.browserSessionId);
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

