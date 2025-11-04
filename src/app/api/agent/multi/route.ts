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

interface RequiredKeys {
    smoothApiKey?: boolean;
    openaiApiKey?: boolean;
    googleApiKey?: boolean;
    anthropicApiKey?: boolean;
    browserUseApiKey?: boolean;
}

/**
 * Determines which API keys are required for a given agent configuration
 */
function getRequiredKeysForAgent(agentConfig: AgentConfig): RequiredKeys {
    const required: RequiredKeys = {};

    switch (agentConfig.agent) {
        case "smooth":
            required.smoothApiKey = true;
            break;
        case "browser-use-cloud":
            required.browserUseApiKey = true;
            break;
        case "stagehand":
        case "stagehand-bb-cloud":
        case "browser-use":
            // These agents require LLM API keys based on model
            const model = agentConfig.model?.toLowerCase() || "";
            const thinkingModel = agentConfig.thinkingModel?.toLowerCase() || "";
            const executionModel = agentConfig.executionModel?.toLowerCase() || "";

            // Helper function to determine which API key is needed based on model string
            const determineModelProvider = (modelStr: string): "openai" | "google" | "anthropic" | null => {
                if (!modelStr) return null;
                
                // Handle provider/model format (e.g., "openai/gpt-4", "google/gemini-2.5-flash")
                const parts = modelStr.split("/");
                if (parts.length > 1) {
                    const provider = parts[0];
                    if (provider === "openai") return "openai";
                    if (provider === "google") return "google";
                    if (provider === "anthropic") return "anthropic";
                }
                
                // Check model name patterns
                if (modelStr.includes("openai") || modelStr.includes("gpt")) {
                    return "openai";
                }
                if (modelStr.includes("google") || modelStr.includes("gemini")) {
                    return "google";
                }
                if (modelStr.includes("anthropic") || modelStr.includes("claude")) {
                    return "anthropic";
                }
                
                return null;
            };

            // Check primary model
            const modelProvider = determineModelProvider(model);
            if (modelProvider === "openai") {
                required.openaiApiKey = true;
            } else if (modelProvider === "google") {
                required.googleApiKey = true;
            } else if (modelProvider === "anthropic") {
                required.anthropicApiKey = true;
            } else if (model) {
                // Default to OpenAI if model is specified but doesn't match patterns
                required.openaiApiKey = true;
            } else {
                // Default to Google if no model specified
                required.googleApiKey = true;
            }

            // Check thinking model (for stagehand)
            const thinkingProvider = determineModelProvider(thinkingModel);
            if (thinkingProvider === "openai") {
                required.openaiApiKey = true;
            } else if (thinkingProvider === "google") {
                required.googleApiKey = true;
            } else if (thinkingProvider === "anthropic") {
                required.anthropicApiKey = true;
            }

            // Check execution model (for stagehand)
            const executionProvider = determineModelProvider(executionModel);
            if (executionProvider === "openai") {
                required.openaiApiKey = true;
            } else if (executionProvider === "google") {
                required.googleApiKey = true;
            } else if (executionProvider === "anthropic") {
                required.anthropicApiKey = true;
            }

            // Browser-use optionally needs browserUseApiKey (but not required for BYOK check)
            break;
    }

    return required;
}

/**
 * Checks if all required BYOK keys are provided for all agents
 */
function hasAllRequiredKeys(
    agents: AgentConfig[],
    apiKeys: {
        smoothApiKey?: string;
        openaiApiKey?: string;
        googleApiKey?: string;
        anthropicApiKey?: string;
        browserUseApiKey?: string;
    }
): { hasAllKeys: boolean; missingKeys: string[] } {
    const missingKeys: string[] = [];

    for (const agentConfig of agents) {
        const required = getRequiredKeysForAgent(agentConfig);

        if (required.smoothApiKey && !apiKeys.smoothApiKey?.trim()) {
            missingKeys.push(`Smooth API key (required for ${agentConfig.agent})`);
        }
        if (required.openaiApiKey && !apiKeys.openaiApiKey?.trim()) {
            missingKeys.push(`OpenAI API key (required for ${agentConfig.agent} with model ${agentConfig.model})`);
        }
        if (required.googleApiKey && !apiKeys.googleApiKey?.trim()) {
            missingKeys.push(`Google API key (required for ${agentConfig.agent} with model ${agentConfig.model})`);
        }
        if (required.anthropicApiKey && !apiKeys.anthropicApiKey?.trim()) {
            missingKeys.push(`Anthropic API key (required for ${agentConfig.agent} with model ${agentConfig.model})`);
        }
        if (required.browserUseApiKey && !apiKeys.browserUseApiKey?.trim()) {
            missingKeys.push(`Browser-Use API key (required for ${agentConfig.agent})`);
        }
    }

    return {
        hasAllKeys: missingKeys.length === 0,
        missingKeys
    };
}

export async function POST(request: NextRequest) {
    try {
        console.log("[api/agent/multi] POST request received");
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

        console.log("[api/agent/multi] Agents requested:", agents?.map(a => a.agent));

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
        console.log("[api/agent/multi] Token fetched:", !!token);

        if (!token) {
            return unauthorized();
        }

        // Create Convex client per request for better isolation
        const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
        convex.setAuth(token);

        // Check if user has BYOK (Bring Your Own Key) for all agents
        const byokCheck = hasAllRequiredKeys(agents, {
            smoothApiKey,
            openaiApiKey,
            googleApiKey,
            anthropicApiKey,
            browserUseApiKey,
        });

        // Check global session limit (3 sessions)
        const MAX_SESSIONS = 3;
        const usageStats = await convex.query(api.queries.getUserUsageStats, {});
        const currentSessionCount = usageStats?.totalSessions ?? 0;
        console.log("[api/agent/multi] Current session count:", currentSessionCount);
        
        // If user has BYOK for all agents, allow them to exceed the limit
        if (!byokCheck.hasAllKeys) {
            // Not all agents have BYOK - check session limit
            if (currentSessionCount >= MAX_SESSIONS) {
                const missingKeysList = byokCheck.missingKeys.join(", ");
                return NextResponse.json(
                    {
                        error: `Session limit reached. Maximum ${MAX_SESSIONS} sessions allowed.`,
                        limit: MAX_SESSIONS,
                        currentSessions: currentSessionCount,
                        message: `To run more sessions, please add API keys for all agents in Settings. Missing: ${missingKeysList}`,
                        missingKeys: byokCheck.missingKeys
                    },
                    { status: 403 }
                );
            }
        } else {
            // All agents have BYOK - bypass session limit
            console.log("[api/agent/multi] All agents have BYOK - bypassing session limit");
        }

        // Get current user to create browser profile
        const user = await convex.query(api.auth.getCurrentUser, {});
        if (!user) {
            return unauthorized();
        }
        // getCurrentUser returns user with _id field (Convex document ID)
        const userId = user._id;
        console.log("[api/agent/multi] User ID:", userId);

        // Check if we need browser sessions for browser-use agents (not browser-use-cloud)
        const browserUseAgents = agents.filter(a => a.agent === "browser-use");
        const needsBrowserSessions = browserUseAgents.length > 0;
        console.log("[api/agent/multi] Browser sessions needed:", needsBrowserSessions, "count:", browserUseAgents.length);

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
            console.log("[api/agent/multi] Creating browser sessions, count:", browserUseAgents.length);
            browserUseAgents.forEach(() => {
                parallelPromises.push(browser.sessions.create(browserConfig));
            });
        }

        const parallelResults = await Promise.all(parallelPromises);
        const { sessionId: dbSessionId } = parallelResults[0] as { sessionId: string };
        const browserSessions = needsBrowserSessions
            ? parallelResults.slice(1) as any[]
            : [];
        console.log("[api/agent/multi] Session created:", dbSessionId, "browser sessions:", browserSessions.length);

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
                    ? `${process.env.NODE_ENV === 'production' ? 'https://www.thebrowserarena.com' : 'http://localhost:3000'}${endpoint}`
                    : endpoint;

                console.log("[api/agent/multi] Launching agent:", agentConfig.agent, "endpoint:", fetchUrl);

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
                        console.log("[api/agent/multi] Agent response failed:", agentConfig.agent, "status:", response.status, response.statusText);
                        if (isLocalEndpoint) {
                            // Local endpoints already return standardized errors; forward as-is
                            const text = await response.text();
                            return Promise.reject(new Error(text || `Failed with status ${response.status}`));
                        }
                        const mapped = await mapProviderError(response, agentConfig.agent);
                        return Promise.reject(new Error(JSON.stringify(await mapped.json())));
                    }

                    const agentData = await response.json();
                    console.log("[api/agent/multi] Agent launched successfully:", agentConfig.agent, "agentId:", agentData?.agentId);

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
                        console.log("[api/agent/multi] Agent timeout:", agentConfig.agent, errorMsg);
                        throw new Error(errorMsg);
                    }

                    // Re-throw other errors
                    console.log("[api/agent/multi] Agent fetch error:", agentConfig.agent, fetchError?.message || String(fetchError));
                    throw fetchError;
                }
            } catch (error) {
                console.log("[api/agent/multi] Agent failed:", agentConfig.agent, error instanceof Error ? error.message : String(error));
                return {
                    agent: agentConfig.agent,
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                };
            }
        });

        // Wait for all agents to launch
        const results = await Promise.all(agentPromises);
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.length - successCount;
        console.log("[api/agent/multi] Agent launch complete - success:", successCount, "failures:", failureCount);
        if (failureCount > 0) {
            results.filter(r => !r.success).forEach(r => {
                console.log("[api/agent/multi] Failed agent:", r.agent, "error:", r.error);
            });
        }

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
        console.error("[api/agent/multi] Unhandled error in POST handler:", error);
        return NextResponse.json(
            {
                error: "Internal server error",
                message: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}

