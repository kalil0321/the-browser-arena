import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import AnchorBrowser from "anchorbrowser";
import { api } from "../../../../../convex/_generated/api";
import { getToken } from "@/lib/auth/server";
import { badRequest, providerUnavailable, serverMisconfigured, unauthorized, mapProviderError } from "@/lib/http-errors";

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
        const {
            instruction,
            agents,
            smoothApiKey,
            openaiApiKey,
            googleApiKey,
            anthropicApiKey,
            browserUseApiKey,
            isPrivate,
            smoothFileIds,
            browserUseFilePath,
            stagehandFileData
        } = await request.json() as {
            instruction: string;
            agents: AgentConfig[];
            smoothApiKey?: string;
            openaiApiKey?: string;
            googleApiKey?: string;
            anthropicApiKey?: string;
            browserUseApiKey?: string;
            isPrivate?: boolean;
            smoothFileIds?: string[];
            browserUseFilePath?: string;
            stagehandFileData?: { name: string; data: string };
        };

        if (!instruction || typeof instruction !== 'string' || !instruction.trim()) {
            return badRequest("Field 'instruction' is required");
        }
        if (!agents || agents.length === 0) {
            return badRequest("At least one agent must be selected");
        }

        if (agents.length > 4) {
            return NextResponse.json({ error: "Maximum 4 agents allowed" }, { status: 400 });
        }

        // Get user token for auth
        const token = await getToken();

        if (!token) {
            return unauthorized();
        }

        // Create Convex client per request for better isolation
        const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
        convex.setAuth(token);

        // Check global session limit (3 sessions)
        const MAX_SESSIONS = 3;
        const usageStats = await convex.query(api.queries.getUserUsageStats, {});
        const currentSessionCount = usageStats?.totalSessions ?? 0;
        if (currentSessionCount >= MAX_SESSIONS) {
            return NextResponse.json(
                {
                    error: `Session limit reached. Maximum ${MAX_SESSIONS} sessions allowed.`,
                    limit: MAX_SESSIONS,
                    currentSessions: currentSessionCount
                },
                { status: 403 }
            );
        }

        // Get current user to create browser profile
        const user = await convex.query(api.auth.getCurrentUser, {});
        if (!user) {
            return unauthorized();
        }
        // getCurrentUser returns user with _id field (Convex document ID)
        const userId = user._id;

        // Check if we need browser sessions for browser-use agents (not browser-use-cloud)
        const browserUseAgents = agents.filter(a => a.agent === "browser-use");
        const needsBrowserSessions = browserUseAgents.length > 0;

        // Create browser profile configuration using user_id
        const browserConfig = {
            browser: {
                profile: {
                    name: `profile-${userId}`,
                    persist: true
                }
            }
        };

        // Create session in Convex, and browser sessions in parallel if needed
        const parallelPromises: Promise<any>[] = [
            convex.mutation(api.mutations.createSession, {
                instruction,
                isPrivate: isPrivate ?? false,
            })
        ];

        // Create browser sessions for all browser-use agents in parallel
        if (needsBrowserSessions) {
            if (!process.env.ANCHOR_API_KEY) {
                return serverMisconfigured("Missing ANCHOR_API_KEY", { provider: "anchor" });
            }
            browserUseAgents.forEach(() => {
                parallelPromises.push(browser.sessions.create(browserConfig));
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
                            ...(smoothFileIds && smoothFileIds.length > 0 ? { fileIds: smoothFileIds } : {}),
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
                            openaiApiKey,
                            googleApiKey,
                            anthropicApiKey,
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
                            openaiApiKey,
                            googleApiKey,
                            anthropicApiKey,
                            ...(browserUseApiKey ? { browserUseApiKey } : {}),
                            userId: userId,
                            ...(agentConfig.secrets && { secrets: agentConfig.secrets }),
                            ...(browserSessionId && cdpUrl && liveViewUrl ? {
                                browserSessionId,
                                cdpUrl,
                                liveViewUrl,
                            } : {}),
                            ...(browserUseFilePath ? { filePath: browserUseFilePath } : {}),
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
                            browserUseApiKey,
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
                            openaiApiKey,
                            googleApiKey,
                            anthropicApiKey,
                            ...(agentConfig.thinkingModel && { thinkingModel: agentConfig.thinkingModel }),
                            ...(agentConfig.executionModel && { executionModel: agentConfig.executionModel }),
                            ...(stagehandFileData ? { fileData: stagehandFileData } : {}),
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
                    // Add API key for Python server endpoints
                    const agentServerApiKey = process.env.AGENT_SERVER_API_KEY;
                    const headers: HeadersInit = {
                        "Content-Type": "application/json",
                    };

                    // Add Authorization header for Python agent server endpoints
                    if (!isLocalEndpoint && agentServerApiKey) {
                        headers["Authorization"] = `Bearer ${agentServerApiKey}`;
                    }

                    // Forward the authorization cookie for local endpoints
                    if (isLocalEndpoint && request.headers.get('cookie')) {
                        headers['cookie'] = request.headers.get('cookie')!;
                    }

                    const response = await fetch(fetchUrl, {
                        method: "POST",
                        headers,
                        body: JSON.stringify(payload),
                        signal: controller.signal,
                    });

                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        if (isLocalEndpoint) {
                            // Local endpoints already return standardized errors; forward as-is
                            const text = await response.text();
                            return Promise.reject(new Error(text || `Failed with status ${response.status}`));
                        }
                        const mapped = await mapProviderError(response, agentConfig.agent);
                        return Promise.reject(new Error(JSON.stringify(await mapped.json())));
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

