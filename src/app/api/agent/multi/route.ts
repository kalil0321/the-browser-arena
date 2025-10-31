import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import AnchorBrowser from "anchorbrowser";
import { api } from "../../../../../convex/_generated/api";
import { getToken } from "@/lib/auth/server";

// Python agent server URL
const AGENT_SERVER_URL = process.env.AGENT_SERVER_URL || "http://localhost:8080";

// Initialize browser client for browser-use agents
const browser = new AnchorBrowser({ apiKey: process.env.ANCHOR_API_KEY });

interface AgentConfig {
    agent: "stagehand" | "smooth" | "stagehand-bb-cloud" | "browser-use" | "browser-use-cloud";
    model: string;
    secrets?: Record<string, string>; // For browser-use: key-value pairs of secrets
    thinkingModel?: string; // For stagehand: model used for thinking/planning
    executionModel?: string; // For stagehand: model used for execution
}

export async function POST(request: NextRequest) {
    try {
        const { instruction, agents, smoothApiKey, isPrivate } = await request.json() as {
            instruction: string;
            agents: AgentConfig[];
            smoothApiKey?: string;
            isPrivate?: boolean;
        };

        if (!agents || agents.length === 0) {
            return NextResponse.json({ error: "At least one agent must be selected" }, { status: 400 });
        }

        if (agents.length > 4) {
            return NextResponse.json({ error: "Maximum 4 agents allowed" }, { status: 400 });
        }

        // Get user token for auth
        const token = await getToken();

        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Create Convex client per request for better isolation
        const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
        convex.setAuth(token);

        // Check if we need browser sessions for browser-use agents (not browser-use-cloud)
        const browserUseAgents = agents.filter(a => a.agent === "browser-use");
        const needsBrowserSessions = browserUseAgents.length > 0;

        // Create session in Convex, and browser sessions in parallel if needed
        const parallelPromises: Promise<any>[] = [
            convex.mutation(api.mutations.createSession, {
                instruction,
                isPrivate: isPrivate ?? false,
            })
        ];

        // Create browser sessions for all browser-use agents in parallel
        if (needsBrowserSessions) {
            browserUseAgents.forEach(() => {
                parallelPromises.push(browser.sessions.create());
            });
        }

        const parallelResults = await Promise.all(parallelPromises);
        const { sessionId: dbSessionId } = parallelResults[0] as { sessionId: string };
        const browserSessions = needsBrowserSessions
            ? parallelResults.slice(1) as any[]
            : [];

        // Launch all agents in parallel
        let browserSessionIndex = 0;
        const agentPromises = agents.map(async (agentConfig) => {
            try {
                let endpoint: string;
                let payload: any;
                let isLocalEndpoint = false;

                switch (agentConfig.agent) {
                    case "smooth":
                        // Smooth is a Next.js route, not Python
                        endpoint = `/api/agent/smooth`;
                        isLocalEndpoint = true;
                        payload = {
                            task: instruction,
                            sessionId: dbSessionId, // Pass the shared session ID
                            apiKey: smoothApiKey, // Pass user's API key if provided
                        };
                        break;
                    case "stagehand-bb-cloud":
                        // Stagehand BrowserBase Cloud is a Next.js route
                        endpoint = `/api/agent/stagehand-cloud`;
                        isLocalEndpoint = true;
                        payload = {
                            instruction,
                            model: agentConfig.model,
                            sessionId: dbSessionId, // Pass the shared session ID
                            ...(agentConfig.thinkingModel && { thinkingModel: agentConfig.thinkingModel }),
                            ...(agentConfig.executionModel && { executionModel: agentConfig.executionModel }),
                        };
                        break;
                    case "browser-use":
                        endpoint = `${AGENT_SERVER_URL}/agent/browser-use`;
                        // Use pre-created browser session for performance
                        const browserSession = browserSessions[browserSessionIndex++];
                        const browserSessionId = browserSession?.data?.id ?? "";
                        const cdpUrl = browserSession?.data?.cdp_url ?? "";
                        const liveViewUrl = browserSession?.data?.live_view_url ?? "";

                        payload = {
                            sessionId: dbSessionId,
                            instruction,
                            providerModel: agentConfig.model,
                            ...(agentConfig.secrets && { secrets: agentConfig.secrets }),
                            ...(browserSessionId && cdpUrl && liveViewUrl ? {
                                browserSessionId,
                                cdpUrl,
                                liveViewUrl,
                            } : {})
                        };
                        break;
                    case "browser-use-cloud":
                        // Browser Use Cloud is a Next.js route
                        endpoint = `/api/agent/browser-use-cloud`;
                        isLocalEndpoint = true;
                        payload = {
                            instruction,
                            model: agentConfig.model,
                            sessionId: dbSessionId, // Pass the shared session ID
                            ...(agentConfig.secrets && { secrets: agentConfig.secrets }),
                        };
                        break;
                    case "stagehand":
                        // Stagehand is a Next.js route, not Python
                        endpoint = `/api/agent/stagehand`;
                        isLocalEndpoint = true;
                        payload = {
                            instruction,
                            model: agentConfig.model,
                            sessionId: dbSessionId, // Pass the shared session ID
                            ...(agentConfig.thinkingModel && { thinkingModel: agentConfig.thinkingModel }),
                            ...(agentConfig.executionModel && { executionModel: agentConfig.executionModel }),
                        };
                        break;
                    default:
                        throw new Error(`Unknown agent: ${agentConfig.agent}`);
                }

                // For local Next.js endpoints, we need to use absolute URL or call directly
                const fetchUrl = isLocalEndpoint
                    ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${endpoint}`
                    : endpoint;

                // Create an AbortController for timeout handling
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

                try {
                    const response = await fetch(fetchUrl, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            // Forward the authorization cookie for local endpoints
                            ...(isLocalEndpoint && request.headers.get('cookie')
                                ? { 'cookie': request.headers.get('cookie')! }
                                : {}
                            ),
                        },
                        body: JSON.stringify(payload),
                        signal: controller.signal,
                    });

                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Failed to launch ${agentConfig.agent}: ${errorText}`);
                    }

                    const agentData = await response.json();

                    return {
                        agent: agentConfig.agent,
                        agentId: agentData.agentId,
                        success: true
                    };
                } catch (fetchError: any) {
                    clearTimeout(timeoutId);

                    // Handle timeout errors specifically
                    if (fetchError.name === 'AbortError' || fetchError.code === 'UND_ERR_HEADERS_TIMEOUT') {
                        const errorMsg = `Timeout while connecting to ${agentConfig.agent} agent server. ` +
                            `Make sure the Python agent server is running at ${AGENT_SERVER_URL}`;
                        throw new Error(errorMsg);
                    }

                    // Re-throw other errors
                    throw fetchError;
                }
            } catch (error) {
                return {
                    agent: agentConfig.agent,
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                };
            }
        });

        // Wait for all agents to launch
        const results = await Promise.all(agentPromises);

        // Check if at least one agent launched successfully
        const successfulAgents = results.filter(r => r.success);
        if (successfulAgents.length === 0) {
            return NextResponse.json(
                { error: "Failed to launch any agents", details: results },
                { status: 500 }
            );
        }

        // Return session info
        return NextResponse.json({
            session: {
                id: dbSessionId,
            },
            agents: results,
        });
    } catch (error) {
        console.error("? Error in POST handler:", error);
        return NextResponse.json(
            {
                error: "Internal server error",
                message: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}

