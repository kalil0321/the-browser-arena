import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { authenticateRequest } from "@/lib/auth/api-auth";
import { badRequest } from "@/lib/http-errors";
import { validateInstruction, logValidationFailure } from "@/lib/instruction-validation";
import { BrowserSession, createBrowserSession } from "@/lib/browser";

const STAGEHAND_SERVER_URL = process.env.NODE_ENV === "development"
    ? "http://localhost:3001"
    : "https://stagehand.thebrowserarena.com";

const AGENT_SERVER_URL = process.env.AGENT_SERVER_URL || "http://localhost:8080";

const APP_URL = process.env.NODE_ENV === "production"
    ? "https://www.thebrowserarena.com"
    : "http://localhost:3000";

const convexBackend = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface V1AgentConfig {
    agent: "stagehand" | "smooth" | "browser-use" | "browser-use-cloud" | "notte" | "claude-code" | "codex" | "playwright-mcp" | "chrome-devtools-mcp" | "agent-browser-mcp";
    model?: string;
    mcpType?: "playwright" | "chrome-devtools" | "agent-browser";
    thinkingModel?: string;
    executionModel?: string;
    secrets?: Record<string, string>;
}

const MCP_TYPE_MAP: Record<string, string> = {
    "playwright-mcp": "playwright",
    "chrome-devtools-mcp": "chrome-devtools",
    "agent-browser-mcp": "agent-browser",
};

const SDK_AGENT_MODELS: Record<string, string> = {
    "claude-code": "anthropic/claude-sonnet-4-6",
    "codex": "openai/gpt-5.4",
};

function isSdkAgent(agent: string): boolean {
    return ["claude-code", "codex", "playwright-mcp", "chrome-devtools-mcp", "agent-browser-mcp"].includes(agent);
}

function isMcpAgent(agent: string): boolean {
    return ["playwright-mcp", "chrome-devtools-mcp", "agent-browser-mcp"].includes(agent);
}

// GET: List user's sessions
export async function GET(request: NextRequest) {
    const auth = await authenticateRequest(request);
    if (!auth) {
        return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Invalid or missing authentication" } }, { status: 401 });
    }

    const sessions = await convexBackend.query(api.queries.getUserSessionsByUserId, {
        userId: auth.userId,
    });

    return NextResponse.json({ data: sessions });
}

// POST: Create session + launch agents
export async function POST(request: NextRequest) {
    const auth = await authenticateRequest(request);
    if (!auth) {
        return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Invalid or missing authentication" } }, { status: 401 });
    }

    const body = await request.json();
    const {
        instruction,
        agents,
        isPrivate,
        apiKeys: userApiKeys,
    } = body as {
        instruction?: string;
        agents?: V1AgentConfig[];
        isPrivate?: boolean;
        apiKeys?: {
            openai?: string;
            google?: string;
            anthropic?: string;
            openrouter?: string;
            browserUse?: string;
            smooth?: string;
        };
    };

    // Validate
    if (!instruction || typeof instruction !== "string" || !instruction.trim()) {
        return badRequest("Field 'instruction' is required");
    }

    const validationResult = validateInstruction(instruction);
    if (!validationResult.isValid) {
        logValidationFailure(instruction, validationResult, auth.userId, "v1-api");
        return badRequest(validationResult.error || "Invalid instruction");
    }

    if (!agents || !Array.isArray(agents) || agents.length === 0) {
        return badRequest("Field 'agents' is required and must be a non-empty array");
    }

    if (agents.length > 4) {
        return badRequest("Maximum 4 agents allowed");
    }

    const agentServerApiKey = process.env.AGENT_SERVER_API_KEY;
    if (!agentServerApiKey) {
        return NextResponse.json({ error: { code: "SERVER_ERROR", message: "Server not configured" } }, { status: 503 });
    }

    const userId = auth.userId;
    const browserProfileConfig = {
        browser: {
            headless: { active: false },
            profile: { name: `profile-${userId}`, persist: true },
        },
    };

    // Pre-create browser sessions for agents that need them (browser-use, notte)
    const agentsNeedingBrowser = agents.filter((a) => a.agent === "browser-use" || a.agent === "notte");
    const browserSessionPromises = agentsNeedingBrowser.map(() => createBrowserSession(browserProfileConfig));

    // Create DB session + browser sessions in parallel
    const [dbResult, ...browserSessions] = await Promise.all([
        convexBackend.mutation(api.mutations.createSessionFromBackend, {
            userId,
            instruction,
            isPrivate: isPrivate ?? false,
        }),
        ...browserSessionPromises,
    ]) as [{ sessionId: string }, ...BrowserSession[]];

    const dbSessionId = dbResult.sessionId;
    let browserSessionIndex = 0;

    // Launch all agents in parallel
    const agentPromises = agents.map(async (agentConfig): Promise<{ agent: string; agentId?: string; success: boolean; error?: string }> => {
        try {
            let endpoint: string;
            let payload: any;
            let isLocalEndpoint = false;
            let needsBrowserSession = false;

            // Create browser session for agents that need one (all except browser-use/notte which got them above)
            let browserSession: BrowserSession | undefined;

            switch (agentConfig.agent) {
                case "smooth":
                    endpoint = `/api/agent/smooth`;
                    isLocalEndpoint = true;
                    payload = {
                        task: instruction,
                        sessionId: dbSessionId,
                        apiKey: userApiKeys?.smooth,
                    };
                    break;

                case "browser-use": {
                    endpoint = `${AGENT_SERVER_URL}/agent/browser-use`;
                    const buBrowser = browserSessions[browserSessionIndex++];
                    payload = {
                        sessionId: dbSessionId,
                        instruction,
                        providerModel: agentConfig.model,
                        openaiApiKey: userApiKeys?.openai,
                        googleApiKey: userApiKeys?.google,
                        anthropicApiKey: userApiKeys?.anthropic,
                        openrouterApiKey: userApiKeys?.openrouter,
                        ...(userApiKeys?.browserUse ? { browserUseApiKey: userApiKeys.browserUse } : {}),
                        ...(agentConfig.secrets && { secrets: agentConfig.secrets }),
                        userId,
                        browserSessionId: buBrowser.browserSessionId,
                        cdpUrl: buBrowser.cdpUrl,
                        liveViewUrl: buBrowser.liveViewUrl,
                    };
                    break;
                }

                case "browser-use-cloud":
                    endpoint = `/api/agent/browser-use-cloud`;
                    isLocalEndpoint = true;
                    payload = {
                        instruction,
                        model: agentConfig.model,
                        sessionId: dbSessionId,
                        browserUseApiKey: userApiKeys?.browserUse,
                        ...(agentConfig.secrets && { secrets: agentConfig.secrets }),
                    };
                    break;

                case "notte": {
                    endpoint = `${AGENT_SERVER_URL}/agent/notte`;
                    const notteBrowser = browserSessions[browserSessionIndex++];
                    payload = {
                        sessionId: dbSessionId,
                        instruction,
                        model: agentConfig.model,
                        cdpUrl: notteBrowser.cdpUrl,
                        browserSessionId: notteBrowser.browserSessionId,
                        liveViewUrl: notteBrowser.liveViewUrl,
                    };
                    break;
                }

                case "stagehand":
                    endpoint = `/api/agent/stagehand`;
                    isLocalEndpoint = true;
                    payload = {
                        instruction,
                        model: agentConfig.model,
                        sessionId: dbSessionId,
                        openaiApiKey: userApiKeys?.openai,
                        googleApiKey: userApiKeys?.google,
                        anthropicApiKey: userApiKeys?.anthropic,
                        openrouterApiKey: userApiKeys?.openrouter,
                        ...(agentConfig.thinkingModel && { thinkingModel: agentConfig.thinkingModel }),
                        ...(agentConfig.executionModel && { executionModel: agentConfig.executionModel }),
                    };
                    break;

                case "claude-code":
                case "codex":
                    endpoint = `/api/agent/${agentConfig.agent}`;
                    isLocalEndpoint = true;
                    payload = {
                        instruction,
                        sessionId: dbSessionId,
                        mcpType: agentConfig.mcpType || "playwright",
                    };
                    break;

                case "playwright-mcp":
                case "chrome-devtools-mcp":
                case "agent-browser-mcp": {
                    const selectedClient = agentConfig.model === "codex" ? "codex" : "claude-code";
                    endpoint = `/api/agent/${selectedClient}`;
                    isLocalEndpoint = true;
                    payload = {
                        instruction,
                        sessionId: dbSessionId,
                        mcpType: MCP_TYPE_MAP[agentConfig.agent],
                        agentName: agentConfig.agent,
                        sdkClient: selectedClient,
                    };
                    break;
                }

                default:
                    return { agent: agentConfig.agent, success: false, error: `Unknown agent type: ${agentConfig.agent}` };
            }

            const fetchUrl = isLocalEndpoint ? `${APP_URL}${endpoint}` : endpoint;

            const headers: HeadersInit = { "Content-Type": "application/json" };

            if (!isLocalEndpoint && agentServerApiKey) {
                headers["Authorization"] = `Bearer ${agentServerApiKey}`;
            }

            // For local endpoints, forward the cookie if we have cookie auth
            if (isLocalEndpoint && auth.authMethod === "cookie") {
                const cookie = request.headers.get("cookie");
                if (cookie) headers["cookie"] = cookie;
            }

            // For local endpoints with API key auth, we still need to forward auth
            // The sub-routes use getToken() which requires cookies. For API key users,
            // pass the instruction data directly — the sub-route will create the session.
            // But these sub-routes expect cookie auth. For API key users calling
            // SDK agents, dispatch to stagehand server directly instead.
            if (isLocalEndpoint && auth.authMethod === "api-key" && isSdkAgent(agentConfig.agent)) {
                // For SDK agents via API key, skip the Next.js sub-route and dispatch to stagehand directly
                browserSession = await createBrowserSession(browserProfileConfig);

                const sdkClient = isMcpAgent(agentConfig.agent)
                    ? (agentConfig.model === "codex" ? "codex" : "claude-code")
                    : (agentConfig.agent === "codex" ? "codex" : "claude-code");

                const agentName = isMcpAgent(agentConfig.agent) ? agentConfig.agent : agentConfig.agent;
                const model = SDK_AGENT_MODELS[sdkClient] || agentConfig.model || "";
                const mcpType = MCP_TYPE_MAP[agentConfig.agent] || agentConfig.mcpType || "playwright";

                const agentId = await convexBackend.mutation(
                    api.mutations.createAgentFromBackend,
                    {
                        sessionId: dbSessionId,
                        name: agentName,
                        model,
                        sdkClient: isMcpAgent(agentConfig.agent) ? sdkClient as "claude-code" | "codex" : undefined,
                        browser: {
                            sessionId: browserSession.browserSessionId,
                            url: browserSession.liveViewUrl,
                        },
                    },
                ) as string;

                const stagehandEndpoint = sdkClient === "codex" ? "codex" : "claude-code";
                fetch(`${STAGEHAND_SERVER_URL}/agent/${stagehandEndpoint}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${agentServerApiKey}`,
                    },
                    body: JSON.stringify({
                        sessionId: dbSessionId,
                        instruction,
                        cdpUrl: browserSession.cdpUrl,
                        liveViewUrl: browserSession.liveViewUrl,
                        agentId,
                        mcpType,
                    }),
                }).catch(async () => {
                    await convexBackend.mutation(api.mutations.updateAgentStatusFromBackend, {
                        agentId,
                        status: "failed",
                    });
                });

                return { agent: agentConfig.agent, agentId, success: true };
            }

            // For non-SDK agents with API key auth calling local endpoints, we can't forward cookies.
            // These agents (stagehand, smooth, browser-use-cloud) need cookie auth on their routes.
            // Return an error for now — they need to add API key support to those sub-routes.
            if (isLocalEndpoint && auth.authMethod === "api-key" && !isSdkAgent(agentConfig.agent)) {
                return {
                    agent: agentConfig.agent,
                    success: false,
                    error: `Agent '${agentConfig.agent}' requires cookie-based auth. Use the web UI or SDK agents (playwright-mcp, chrome-devtools-mcp, agent-browser-mcp) with API key auth.`,
                };
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            try {
                const response = await fetch(fetchUrl, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(payload),
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const text = await response.text();
                    return { agent: agentConfig.agent, success: false, error: text || `Failed with status ${response.status}` };
                }

                const agentData = await response.json();
                return { agent: agentConfig.agent, agentId: agentData.agentId, success: true };
            } catch (fetchError: any) {
                clearTimeout(timeoutId);
                if (fetchError.name === "AbortError") {
                    return { agent: agentConfig.agent, success: false, error: "Timeout launching agent" };
                }
                throw fetchError;
            }
        } catch (error) {
            return {
                agent: agentConfig.agent,
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    });

    const results = await Promise.all(agentPromises);
    const anySuccess = results.some((r) => r.success);

    if (!anySuccess) {
        return NextResponse.json(
            { error: { code: "LAUNCH_FAILED", message: "All agents failed to launch" }, details: results },
            { status: 500 },
        );
    }

    return NextResponse.json({
        data: {
            sessionId: dbSessionId,
            agents: results,
        },
    }, { status: 201 });
}
