import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { getToken } from "@/lib/auth/server";
import { badRequest, providerUnavailable, serverMisconfigured, unauthorized, mapProviderError } from "@/lib/http-errors";
import { validateInstruction, logValidationFailure } from "@/lib/instruction-validation";
import { validateSecrets, validateApiKeyFormat, validateModelName, detectSuspiciousSecrets, logSecurityViolation } from "@/lib/security/validation";
import { BrowserSession, createBrowserSession, deleteBrowserSession } from "@/lib/browser";

// Python agent server URL
const AGENT_SERVER_URL = process.env.AGENT_SERVER_URL || "http://localhost:8080";

interface AgentConfig {
    agent: "stagehand" | "smooth" | "stagehand-bb-cloud" | "browser-use" | "browser-use-cloud" | "notte";
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
    openrouterApiKey?: boolean;
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
        case "notte":
            // Uses server-side credentials
            break;
        case "stagehand":
        case "stagehand-bb-cloud":
        case "browser-use":
            // These agents require LLM API keys based on model
            const model = agentConfig.model?.toLowerCase() || "";
            const thinkingModel = agentConfig.thinkingModel?.toLowerCase() || "";
            const executionModel = agentConfig.executionModel?.toLowerCase() || "";

            // Helper function to determine which API key is needed based on model string
            const determineModelProvider = (modelStr: string): "openai" | "google" | "anthropic" | "openrouter" | null => {
                if (!modelStr) return null;

                // Handle provider/model format (e.g., "openai/gpt-4", "google/gemini-2.5-flash")
                const parts = modelStr.split("/");
                if (parts.length > 1) {
                    const provider = parts[0];
                    if (provider === "openai") return "openai";
                    if (provider === "google") return "google";
                    if (provider === "anthropic") return "anthropic";
                    if (provider === "openrouter") return "openrouter";
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
                if (modelStr.includes("openrouter")) {
                    return "openrouter";
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
            } else if (modelProvider === "openrouter") {
                required.openrouterApiKey = true;
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
            } else if (thinkingProvider === "openrouter") {
                required.openrouterApiKey = true;
            }

            // Check execution model (for stagehand)
            const executionProvider = determineModelProvider(executionModel);
            if (executionProvider === "openai") {
                required.openaiApiKey = true;
            } else if (executionProvider === "google") {
                required.googleApiKey = true;
            } else if (executionProvider === "anthropic") {
                required.anthropicApiKey = true;
            } else if (executionProvider === "openrouter") {
                required.openrouterApiKey = true;
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
        openrouterApiKey?: string;
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
        if (required.openrouterApiKey && !apiKeys.openrouterApiKey?.trim()) {
            missingKeys.push(`OpenRouter API key (required for ${agentConfig.agent} with model ${agentConfig.model})`);
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
            openrouterApiKey,
            isPrivate,
            smoothFileIds,
            browserUseFileId,
            stagehandFileData
        } = await request.json() as {
            instruction: string;
            agents: AgentConfig[];
            smoothApiKey?: string;
            openaiApiKey?: string;
            googleApiKey?: string;
            anthropicApiKey?: string;
            browserUseApiKey?: string;
            openrouterApiKey?: string;
            isPrivate?: boolean;
            smoothFileIds?: string[];
            browserUseFileId?: string;
            stagehandFileData?: { name: string; data: string };
        };

        console.log("[api/agent/multi] Agents requested:", agents?.map(a => a.agent));

        if (!instruction || typeof instruction !== 'string' || !instruction.trim()) {
            return badRequest("Field 'instruction' is required");
        }
        if (!agents || agents.length === 0) {
            return badRequest("At least one agent must be selected");
        }

        // Validate instruction for prompt injection attempts
        const validationResult = validateInstruction(instruction);
        if (!validationResult.isValid) {
            logValidationFailure(instruction, validationResult, undefined, "multi-route");
            return badRequest(validationResult.error || "Invalid instruction");
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

        // Get current user for security logging and browser profile
        const user = await convex.query(api.auth.getCurrentUser, {});
        if (!user) {
            return unauthorized();
        }
        const userId = user._id;

        // Validate API key formats
        if (openaiApiKey) {
            const keyValidation = validateApiKeyFormat(openaiApiKey, 'openai');
            if (!keyValidation.isValid) {
                logSecurityViolation('invalid_api_key_format', { provider: 'openai' }, userId, 'multi-route');
                return NextResponse.json({ error: keyValidation.error }, { status: 400 });
            }
        }
        if (anthropicApiKey) {
            const keyValidation = validateApiKeyFormat(anthropicApiKey, 'anthropic');
            if (!keyValidation.isValid) {
                logSecurityViolation('invalid_api_key_format', { provider: 'anthropic' }, userId, 'multi-route');
                return NextResponse.json({ error: keyValidation.error }, { status: 400 });
            }
        }
        if (googleApiKey) {
            const keyValidation = validateApiKeyFormat(googleApiKey, 'google');
            if (!keyValidation.isValid) {
                logSecurityViolation('invalid_api_key_format', { provider: 'google' }, userId, 'multi-route');
                return NextResponse.json({ error: keyValidation.error }, { status: 400 });
            }
        }
        if (openrouterApiKey) {
            const keyValidation = validateApiKeyFormat(openrouterApiKey, 'openrouter');
            if (!keyValidation.isValid) {
                logSecurityViolation('invalid_api_key_format', { provider: 'openrouter' }, userId, 'multi-route');
                return NextResponse.json({ error: keyValidation.error }, { status: 400 });
            }
        }
        if (browserUseApiKey) {
            const keyValidation = validateApiKeyFormat(browserUseApiKey, 'browseruse');
            if (!keyValidation.isValid) {
                logSecurityViolation('invalid_api_key_format', { provider: 'browseruse' }, userId, 'multi-route');
                return NextResponse.json({ error: keyValidation.error }, { status: 400 });
            }
        }
        if (smoothApiKey) {
            const keyValidation = validateApiKeyFormat(smoothApiKey, 'smooth');
            if (!keyValidation.isValid) {
                logSecurityViolation('invalid_api_key_format', { provider: 'smooth' }, userId, 'multi-route');
                return NextResponse.json({ error: keyValidation.error }, { status: 400 });
            }
        }

        // Validate model names and secrets for each agent
        for (const agentConfig of agents) {
            // Validate model name
            if (agentConfig.model) {
                const modelValidation = validateModelName(agentConfig.model);
                if (!modelValidation.isValid) {
                    logSecurityViolation('invalid_model_name', { model: agentConfig.model, agent: agentConfig.agent }, userId, 'multi-route');
                    return NextResponse.json({ error: `Invalid model for ${agentConfig.agent}: ${modelValidation.error}` }, { status: 400 });
                }
            }

            // Validate thinking model if present
            if (agentConfig.thinkingModel) {
                const modelValidation = validateModelName(agentConfig.thinkingModel);
                if (!modelValidation.isValid) {
                    logSecurityViolation('invalid_model_name', { model: agentConfig.thinkingModel, agent: agentConfig.agent, type: 'thinking' }, userId, 'multi-route');
                    return NextResponse.json({ error: `Invalid thinking model for ${agentConfig.agent}: ${modelValidation.error}` }, { status: 400 });
                }
            }

            // Validate execution model if present
            if (agentConfig.executionModel) {
                const modelValidation = validateModelName(agentConfig.executionModel);
                if (!modelValidation.isValid) {
                    logSecurityViolation('invalid_model_name', { model: agentConfig.executionModel, agent: agentConfig.agent, type: 'execution' }, userId, 'multi-route');
                    return NextResponse.json({ error: `Invalid execution model for ${agentConfig.agent}: ${modelValidation.error}` }, { status: 400 });
                }
            }

            // Validate secrets
            if (agentConfig.secrets) {
                const secretsValidation = validateSecrets(agentConfig.secrets);
                if (!secretsValidation.isValid) {
                    logSecurityViolation('invalid_secrets', { agent: agentConfig.agent, error: secretsValidation.error }, userId, 'multi-route');
                    return NextResponse.json({ error: `Invalid secrets for ${agentConfig.agent}: ${secretsValidation.error}` }, { status: 400 });
                }

                // Check for suspicious secrets (potential attack)
                if (detectSuspiciousSecrets(agentConfig.secrets)) {
                    logSecurityViolation('suspicious_secrets', { agent: agentConfig.agent }, userId, 'multi-route');
                    return NextResponse.json({ error: 'Suspicious secrets detected. This may indicate an injection attempt.' }, { status: 403 });
                }
            }
        }

        // Check if user has BYOK (Bring Your Own Key) for all agents
        const byokCheck = hasAllRequiredKeys(agents, {
            smoothApiKey,
            openaiApiKey,
            googleApiKey,
            anthropicApiKey,
            browserUseApiKey,
            openrouterApiKey,
        });

        // Check global session limit (5 sessions)
        const MAX_SESSIONS = 5;
        const usageStats = await convex.query(api.queries.getUserUsageStats, {});
        const currentSessionCount = usageStats?.totalSessions ?? 0;
        console.log("[api/agent/multi] Current session count:", currentSessionCount);
        if (process.env.NODE_ENV === 'production' && currentSessionCount >= MAX_SESSIONS) {
            return NextResponse.json(
                {
                    error: `Session limit reached. Maximum ${MAX_SESSIONS} sessions allowed.`,
                    limit: MAX_SESSIONS,
                    currentSessions: currentSessionCount
                },
                { status: 403 }
            );
        }

        // If user has BYOK for all agents, allow them to exceed the limit
        if (!byokCheck.hasAllKeys && process.env.NODE_ENV === 'production') {
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

        // first element will be { sessionId: string } and the rest will be BrowserSession
        const parallelPromises: Promise<{ sessionId: string } | BrowserSession>[] = [
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
                parallelPromises.push(createBrowserSession(browserConfig));
            });
        }

        const parallelResults = await Promise.all(parallelPromises) as (BrowserSession | { sessionId: string })[];


        // DB Session ID is the ID of the agents session, meaning 
        // the id to retrieve the session from the database, the agents activity, what we see in the UI
        // it's different from the browser session id
        const { sessionId: dbSessionId } = parallelResults[0] as { sessionId: string };
        const browserSessions = needsBrowserSessions
            ? parallelResults.slice(1) as BrowserSession[]
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
                            openrouterApiKey,
                            ...(agentConfig.thinkingModel && { thinkingModel: agentConfig.thinkingModel }),
                            ...(agentConfig.executionModel && { executionModel: agentConfig.executionModel }),
                        };
                        break;
                    case "browser-use":
                        endpoint = `${AGENT_SERVER_URL}/agent/browser-use`;
                        // Use pre-created browser session for performance
                        const { browserSessionId, cdpUrl, liveViewUrl } = browserSessions[browserSessionIndex++];
                        
                        payload = {
                            sessionId: dbSessionId,
                            instruction,
                            providerModel: agentConfig.model,
                            openaiApiKey,
                            googleApiKey,
                            anthropicApiKey,
                            ...(browserUseApiKey ? { browserUseApiKey } : {}),
                            ...(openrouterApiKey ? { openrouterApiKey } : {}),
                            userId: userId,
                            ...(agentConfig.secrets && { secrets: agentConfig.secrets }),
                            ...(browserSessionId && cdpUrl && liveViewUrl ? {
                                browserSessionId,
                                cdpUrl,
                                liveViewUrl,
                            } : {}),
                            ...(browserUseFileId ? { fileId: browserUseFileId } : {}),
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
                    case "notte":
                        endpoint = `${AGENT_SERVER_URL}/agent/notte`;
                        payload = {
                            sessionId: dbSessionId,
                            instruction,
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
                            openrouterApiKey,
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

