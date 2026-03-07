import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { after } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { badRequest } from "@/lib/http-errors";
import { getOrCreateSignedFingerprint } from "@/lib/fingerprint";
import { validateInstruction, logValidationFailure } from "@/lib/instruction-validation";
import { createBrowserSession, deleteBrowserSession } from "@/lib/browser";
import { BrowserUseClient } from "browser-use-sdk";

export const runtime = "nodejs";

const AGENT_SERVER_URL = process.env.AGENT_SERVER_URL || "http://localhost:8080";
const STAGEHAND_SERVER_URL = process.env.NODE_ENV === "development" ? "http://localhost:3001" : "https://stagehand.thebrowserarena.com";
const SMOOTH_API_URL = "https://api.smooth.sh/api/v1/task";

const convexBackend = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const BROWSER_AGENTS = ["stagehand", "browser-use", "claude-code", "codex", "notte"] as const;

const config = {
    browser: {
        headless: { active: false }
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
        const agents: Array<{ agent: string; model?: string }> | undefined = body.agents;

        if (!instruction || typeof instruction !== 'string' || !instruction.trim()) {
            return badRequest("Field 'instruction' is required");
        }

        const validationResult = validateInstruction(instruction);
        if (!validationResult.isValid) {
            logValidationFailure(instruction, validationResult, undefined, "demo-route");
            return badRequest(validationResult.error || "Invalid instruction");
        }

        const isMulti = Array.isArray(agents) && agents.length > 0;
        if (!isMulti && !agentType) {
            return badRequest("Field 'agentType' is required for single-agent demo");
        }
        if (isMulti && agents.length > 4) {
            return NextResponse.json({ error: "Maximum 4 agents allowed for demo" }, { status: 400 });
        }

        const requestedAgents: Array<{ agent: string; model?: string }> = isMulti
            ? agents
            : [{ agent: agentType!, model }];

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

        type BuiltAgent = {
            kind: string;
            model: string;
            browserSessionId?: string;
            liveViewUrl?: string;
            cdpUrl?: string;
        };

        const browserAgents = requestedAgents.filter(a => BROWSER_AGENTS.includes(a.agent as any));
        const nonBrowserAgents = requestedAgents.filter(a => !BROWSER_AGENTS.includes(a.agent as any));

        const builtAgents: BuiltAgent[] = [];
        for (const a of browserAgents) {
            const modelForAgent = a.model ?? (a.agent === "browser-use" ? "browser-use/bu-2.0" : "google/gemini-2.5-flash");
            const profileConfig = {
                ...(a.agent === "stagehand" || a.agent === "claude-code" || a.agent === "codex" ? config : {}),
                browser: {
                    ...(a.agent === "stagehand" || a.agent === "claude-code" || a.agent === "codex" ? config.browser : {}),
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

        for (const a of nonBrowserAgents) {
            builtAgents.push({
                kind: a.agent,
                model: a.model ?? "",
            });
        }

        const firstBrowser = builtAgents.find(b => b.browserSessionId);
        const createResult = await convex.mutation(api.mutations.createDemoSession, {
            instruction,
            browserData: firstBrowser ? {
                sessionId: firstBrowser.browserSessionId!,
                url: firstBrowser.liveViewUrl!,
            } : undefined,
            agentName: firstBrowser?.kind ?? requestedAgents[0]?.agent ?? "stagehand",
            model: firstBrowser?.model ?? "google/gemini-2.5-flash",
            additionalAgents: builtAgents.slice(1).filter(b => b.browserSessionId).map(b => ({
                name: b.kind,
                model: b.model,
                browser: { sessionId: b.browserSessionId!, url: b.liveViewUrl! },
            })),
        });

        const { sessionId: dbSessionId, agentIds: initialAgentIds } = createResult;
        const allAgentIds: string[] = [...(initialAgentIds || [])];
        const smoothTasks: Array<{ agentId: string; taskId: string; apiKey: string }> = [];
        const buCloudTasks: Array<{ agentId: string; taskId: string; apiKey: string }> = [];

        for (const a of nonBrowserAgents) {
            if (a.agent === "smooth") {
                const smoothKey = process.env.SMOOTH_API_KEY;
                if (!smoothKey) {
                    console.error("SMOOTH_API_KEY not configured for demo");
                    continue;
                }
                try {
                    const taskResp = await fetch(SMOOTH_API_URL, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "apikey": smoothKey },
                        body: JSON.stringify({ task: instruction, device: "desktop" }),
                    });
                    if (!taskResp.ok) continue;
                    const taskData = await taskResp.json();
                    const taskId = taskData?.r?.id;
                    const liveUrl = taskData?.r?.live_url || "";
                    if (taskId) {
                        const agentId = await convex.mutation(api.mutations.createAgentFromBackend, {
                            sessionId: dbSessionId,
                            name: "smooth",
                            model: "smooth",
                            browser: { sessionId: taskId, url: liveUrl },
                        });
                        allAgentIds.push(agentId);
                        smoothTasks.push({ agentId, taskId, apiKey: smoothKey });
                    }
                } catch (e) {
                    console.error("Smooth demo agent creation failed:", e);
                }
            } else if (a.agent === "browser-use-cloud") {
                const buKey = process.env.BROWSER_USE_API_KEY;
                if (!buKey) {
                    console.error("BROWSER_USE_API_KEY not configured for demo");
                    continue;
                }
                try {
                    const client = new BrowserUseClient({ apiKey: buKey });
                    const task = await client.tasks.createTask({ task: instruction, llm: "browser-use-llm" });
                    const taskId = task.id;
                    const agentId = await convex.mutation(api.mutations.createAgentFromBackend, {
                        sessionId: dbSessionId,
                        name: "browser-use-cloud",
                        model: a.model || "browser-use-llm",
                        browser: { sessionId: taskId, url: "" },
                    });
                    allAgentIds.push(agentId);
                    buCloudTasks.push({ agentId, taskId, apiKey: buKey });
                } catch (e) {
                    console.error("Browser-Use Cloud demo agent creation failed:", e);
                }
            }
        }

        if (allAgentIds.length === 0) {
            return NextResponse.json({ error: "Failed to create agents" }, { status: 500 });
        }

        await convex.mutation(api.mutations.associateDemoSession, {
            usageId: claimResult.usageId,
            sessionId: dbSessionId,
        });

        const browserBuiltAgents = builtAgents.filter(b => b.browserSessionId);
        after(async () => {
            await Promise.all(browserBuiltAgents.map(async (b, idx) => {
                const agentId = allAgentIds[idx];
                if (!agentId) return;
                try {
                    const agentServerApiKey = process.env.AGENT_SERVER_API_KEY;
                    if (b.kind === "stagehand") {
                        if (!agentServerApiKey) {
                            console.error("AGENT_SERVER_API_KEY is not configured");
                            return;
                        }
                        const resp = await fetch(`${STAGEHAND_SERVER_URL}/agent/stagehand`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${agentServerApiKey}` },
                            body: JSON.stringify({
                                sessionId: dbSessionId,
                                instruction,
                                model: b.model,
                                cdpUrl: b.cdpUrl,
                                liveViewUrl: b.liveViewUrl,
                                agentId,
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
                            await deleteBrowserSession(b.browserSessionId!);
                        } else {
                            await resp.json();
                        }
                    } else if (b.kind === "browser-use") {
                        if (!agentServerApiKey) {
                            console.error("AGENT_SERVER_API_KEY is not configured");
                            return;
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
                                providerModel: b.model || "browser-use/bu-2.0",
                                browserSessionId: b.browserSessionId,
                                cdpUrl: b.cdpUrl,
                                liveViewUrl: b.liveViewUrl,
                                userId: demoUserId,
                                agentId,
                            }),
                        });
                        if (!agentResponse.ok) {
                            await convexBackend.mutation(api.mutations.updateAgentStatusFromBackend, {
                                agentId,
                                status: "failed",
                                error: "Python agent execution failed",
                            });
                            await deleteBrowserSession(b.browserSessionId!);
                        } else {
                            await agentResponse.json();
                        }
                    } else if (b.kind === "notte") {
                        if (!agentServerApiKey) {
                            console.error("AGENT_SERVER_API_KEY is not configured");
                            return;
                        }
                        const notteResp = await fetch(`${AGENT_SERVER_URL}/agent/notte`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${agentServerApiKey}`,
                            },
                            body: JSON.stringify({
                                sessionId: dbSessionId,
                                instruction,
                                model: b.model,
                                cdpUrl: b.cdpUrl,
                                browserSessionId: b.browserSessionId,
                                liveViewUrl: b.liveViewUrl,
                            }),
                        });
                        if (!notteResp.ok) {
                            await convexBackend.mutation(api.mutations.updateAgentStatusFromBackend, {
                                agentId,
                                status: "failed",
                                error: "Notte agent execution failed",
                            });
                            await deleteBrowserSession(b.browserSessionId!);
                        } else {
                            await notteResp.json();
                        }
                    } else if (b.kind === "claude-code" || b.kind === "codex") {
                        if (!agentServerApiKey) {
                            console.error("AGENT_SERVER_API_KEY is not configured");
                            return;
                        }
                        const resp = await fetch(`${STAGEHAND_SERVER_URL}/agent/${b.kind}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${agentServerApiKey}` },
                            body: JSON.stringify({
                                sessionId: dbSessionId,
                                instruction,
                                cdpUrl: b.cdpUrl,
                                liveViewUrl: b.liveViewUrl,
                                agentId,
                                mcpType: "playwright",
                            }),
                        });
                        if (!resp.ok) {
                            await convexBackend.mutation(api.mutations.updateAgentStatusFromBackend, {
                                agentId,
                                status: "failed",
                                error: `${b.kind} execution failed`,
                            });
                            await deleteBrowserSession(b.browserSessionId!);
                        } else {
                            await resp.json();
                        }
                    }
                } catch (error) {
                    console.error("❌ Error in background execution:", error);
                    try {
                        await convexBackend.mutation(api.mutations.updateAgentStatusFromBackend, {
                            agentId,
                            status: "failed",
                        });
                        if (b.browserSessionId) await deleteBrowserSession(b.browserSessionId);
                    } catch (cleanupError) {
                        console.error("❌ Error cleaning up session:", cleanupError);
                    }
                }
            }));

            for (const { agentId, taskId, apiKey } of smoothTasks) {
                (async () => {
                    try {
                        for (let i = 0; i < 100000; i++) {
                            const r = await fetch(`${SMOOTH_API_URL}/${taskId}`, {
                                headers: { "Content-Type": "application/json", "apikey": apiKey },
                            });
                            if (!r.ok) throw new Error("Smooth status fetch failed");
                            const data = await r.json();
                            const status = data?.r;
                            if (status?.live_url) {
                                await convexBackend.mutation(api.mutations.updateAgentBrowserUrlFromBackend, {
                                    agentId,
                                    url: status.live_url,
                                });
                            }
                            if (["done", "failed", "cancelled"].includes(status?.status)) {
                                await convexBackend.mutation(api.mutations.updateAgentResultFromBackend, {
                                    agentId,
                                    result: { agent: "smooth", ...status, success: status?.status === "done" },
                                    status: status?.status === "done" ? "completed" : "failed",
                                });
                                if (status?.recording_url) {
                                    await convexBackend.mutation(api.mutations.updateAgentRecordingUrlFromBackend, {
                                        agentId,
                                        recordingUrl: status.recording_url,
                                    });
                                }
                                return;
                            }
                            await new Promise(r => setTimeout(r, 3000));
                        }
                    } catch (e) {
                        console.error("Smooth demo polling failed:", e);
                        await convexBackend.mutation(api.mutations.updateAgentStatusFromBackend, {
                            agentId,
                            status: "failed",
                        });
                    }
                })();
            }

            for (const { agentId, taskId, apiKey } of buCloudTasks) {
                (async () => {
                    try {
                        const client = new BrowserUseClient({ apiKey });
                        for (let i = 0; i < 600; i++) {
                            const taskView = await client.tasks.getTask({ task_id: taskId });
                            const status = (taskView as any).status;
                            const liveUrl = (taskView as any).session?.liveUrl || (taskView as any).liveUrl || "";
                            if (liveUrl) {
                                await convexBackend.mutation(api.mutations.updateAgentBrowserUrlFromBackend, {
                                    agentId,
                                    url: liveUrl,
                                });
                            }
                            if (status === "completed" || status === "failed") {
                                await convexBackend.mutation(api.mutations.updateAgentResultFromBackend, {
                                    agentId,
                                    result: taskView,
                                    status: status === "completed" ? "completed" : "failed",
                                });
                                return;
                            }
                            await new Promise(r => setTimeout(r, 1000));
                        }
                    } catch (e) {
                        console.error("Browser-Use Cloud demo polling failed:", e);
                        await convexBackend.mutation(api.mutations.updateAgentStatusFromBackend, {
                            agentId,
                            status: "failed",
                        });
                    }
                })();
            }
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

