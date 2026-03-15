import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { authenticateRequest } from "@/lib/auth/api-auth";
import { badRequest } from "@/lib/http-errors";
import { validateInstruction, logValidationFailure } from "@/lib/instruction-validation";
import { createBrowserSession, deleteBrowserSession } from "@/lib/browser";

const STAGEHAND_SERVER_URL = process.env.NODE_ENV === "development"
    ? "http://localhost:3001"
    : "https://stagehand.thebrowserarena.com";

const convexBackend = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface V1AgentConfig {
    agent: "stagehand" | "browser-use" | "browser-use-cloud" | "notte" | "playwright-mcp" | "chrome-devtools-mcp" | "agent-browser-mcp";
    model?: string;
    mcpType?: "playwright" | "chrome-devtools" | "agent-browser";
}

const SDK_AGENTS = new Set(["claude-code", "codex", "playwright-mcp", "chrome-devtools-mcp", "agent-browser-mcp"]);

const MCP_TYPE_MAP: Record<string, string> = {
    "playwright-mcp": "playwright",
    "chrome-devtools-mcp": "chrome-devtools",
    "agent-browser-mcp": "agent-browser",
};

const SDK_AGENT_MODELS: Record<string, string> = {
    "claude-code": "anthropic/claude-sonnet-4-6",
    "codex": "openai/gpt-5.4",
};

// GET: List user's sessions
export async function GET(request: NextRequest) {
    const auth = await authenticateRequest(request);
    if (!auth) {
        return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Invalid or missing authentication" } }, { status: 401 });
    }

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    // For API key auth, we query without cookie auth — use a backend query
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
    const { instruction, agents, isPrivate } = body as {
        instruction?: string;
        agents?: V1AgentConfig[];
        isPrivate?: boolean;
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

    if (!process.env.ANCHOR_API_KEY) {
        return NextResponse.json({ error: { code: "SERVER_ERROR", message: "Browser provider not configured" } }, { status: 503 });
    }

    const browserProfileConfig = {
        browser: {
            headless: { active: false },
            profile: { name: `profile-${auth.userId}`, persist: true },
        },
    };

    // Create DB session
    const { sessionId: dbSessionId } = await convexBackend.mutation(
        api.mutations.createSessionFromBackend,
        {
            userId: auth.userId,
            instruction,
            isPrivate: isPrivate ?? false,
        },
    );

    const results: Array<{ agent: string; agentId?: string; success: boolean; error?: string }> = [];

    // Launch each agent
    for (const agentConfig of agents) {
        try {
            // Create browser session
            const browserSession = await createBrowserSession(browserProfileConfig);

            // Determine agent display name and SDK client
            const isMcpAgent = ["playwright-mcp", "chrome-devtools-mcp", "agent-browser-mcp"].includes(agentConfig.agent);
            const sdkClient = isMcpAgent
                ? (agentConfig.model === "codex" ? "codex" : "claude-code")
                : undefined;
            const agentName = agentConfig.agent;
            const model = SDK_AGENT_MODELS[sdkClient || agentConfig.agent] || agentConfig.model || "";
            const mcpType = MCP_TYPE_MAP[agentConfig.agent] || agentConfig.mcpType;

            // Create agent in DB
            const agentId = await convexBackend.mutation(
                api.mutations.createAgentFromBackend,
                {
                    sessionId: dbSessionId,
                    name: agentName,
                    model,
                    sdkClient,
                    browser: {
                        sessionId: browserSession.browserSessionId,
                        url: browserSession.liveViewUrl,
                    },
                },
            ) as string;

            // Dispatch to stagehand server for SDK agents
            if (SDK_AGENTS.has(agentConfig.agent) || SDK_AGENTS.has(sdkClient || "")) {
                const sdkAgentType = sdkClient || agentConfig.agent;
                const endpoint = sdkAgentType === "codex" ? "codex" : "claude-code";

                fetch(`${STAGEHAND_SERVER_URL}/agent/${endpoint}`, {
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
                        mcpType: mcpType || "playwright",
                    }),
                }).catch(async () => {
                    await convexBackend.mutation(api.mutations.updateAgentStatusFromBackend, {
                        agentId,
                        status: "failed",
                    });
                });

                results.push({ agent: agentConfig.agent, agentId, success: true });
            } else {
                // Non-SDK agents (stagehand, browser-use, notte, etc.) — not supported via API v1 yet
                await convexBackend.mutation(api.mutations.updateAgentStatusFromBackend, {
                    agentId,
                    status: "failed",
                });
                results.push({
                    agent: agentConfig.agent,
                    agentId,
                    success: false,
                    error: `Agent type '${agentConfig.agent}' is not yet supported via the API. Supported: playwright-mcp, chrome-devtools-mcp, agent-browser-mcp`,
                });
            }
        } catch (e: any) {
            results.push({
                agent: agentConfig.agent,
                success: false,
                error: e.message || "Failed to launch agent",
            });
        }
    }

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
