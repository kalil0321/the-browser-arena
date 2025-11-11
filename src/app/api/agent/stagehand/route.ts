import { after, NextRequest, NextResponse } from "next/server";
import AnchorBrowser from "anchorbrowser";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { getToken } from "@/lib/auth/server";
import { missingKey, serverMisconfigured, unauthorized, badRequest } from "@/lib/http-errors";
import { validateInstruction, logValidationFailure } from "@/lib/instruction-validation";
import { validateSecrets, validateApiKeyFormat, validateModelName, detectSuspiciousSecrets, logSecurityViolation } from "@/lib/security/validation";

// Stagehand server URL - dev: localhost:3001, prod: stagehand.thebrowserarena.com
// const STAGEHAND_SERVER_URL = "https://stagehand.thebrowserarena.com"
const STAGEHAND_SERVER_URL = process.env.NODE_ENV === "development" ? "http://localhost:3001" : "https://stagehand.thebrowserarena.com";


// Initialize the client
const browser = new AnchorBrowser({ apiKey: process.env.ANCHOR_API_KEY });

// Backend Convex client (no auth) for status updates from this route if needed
const convexBackend = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Browser session configuration
const config = {
    browser: {
        headless: {
            active: false
        }
    }
};


export async function POST(request: NextRequest) {
    try {
        const { instruction, model, sessionId: existingSessionId, openaiApiKey, googleApiKey, anthropicApiKey, openrouterApiKey, thinkingModel, executionModel, fileData, secrets } = await request.json();
        if (!instruction || typeof instruction !== 'string' || !instruction.trim()) {
            return badRequest("Field 'instruction' is required");
        }

        // Validate instruction for prompt injection attempts
        const validationResult = validateInstruction(instruction);
        if (!validationResult.isValid) {
            logValidationFailure(instruction, validationResult, undefined, "stagehand-route");
            return badRequest(validationResult.error || "Invalid instruction");
        }

        // Get user token for auth
        const token = await getToken();

        if (!token) {
            return unauthorized();
        }

        // Create Convex client per request for better isolation
        const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
        convex.setAuth(token);

        // Ensure required server env keys exist
        if (!process.env.ANCHOR_API_KEY) {
            return serverMisconfigured("Missing ANCHOR_API_KEY", { provider: "anchor" });
        }

        const agentServerApiKey = process.env.AGENT_SERVER_API_KEY;
        if (!agentServerApiKey) {
            return NextResponse.json({ error: "AGENT_SERVER_API_KEY is not configured" }, { status: 500 });
        }

        // Get current user for security logging and browser profile
        const user = await convex.query(api.auth.getCurrentUser, {});
        if (!user) {
            return unauthorized();
        }
        const userId = user._id;

        // Validate model names
        const defaultModel = model ?? "google/gemini-2.5-flash";
        const modelValidation = validateModelName(defaultModel);
        if (!modelValidation.isValid) {
            logSecurityViolation('invalid_model_name', { model: defaultModel }, userId, 'stagehand-route');
            return NextResponse.json({ error: `Invalid model: ${modelValidation.error}` }, { status: 400 });
        }

        if (thinkingModel) {
            const thinkingModelValidation = validateModelName(thinkingModel);
            if (!thinkingModelValidation.isValid) {
                logSecurityViolation('invalid_model_name', { model: thinkingModel, type: 'thinking' }, userId, 'stagehand-route');
                return NextResponse.json({ error: `Invalid thinking model: ${thinkingModelValidation.error}` }, { status: 400 });
            }
        }

        if (executionModel) {
            const executionModelValidation = validateModelName(executionModel);
            if (!executionModelValidation.isValid) {
                logSecurityViolation('invalid_model_name', { model: executionModel, type: 'execution' }, userId, 'stagehand-route');
                return NextResponse.json({ error: `Invalid execution model: ${executionModelValidation.error}` }, { status: 400 });
            }
        }

        // Validate API key formats
        if (openaiApiKey) {
            const keyValidation = validateApiKeyFormat(openaiApiKey, 'openai');
            if (!keyValidation.isValid) {
                logSecurityViolation('invalid_api_key_format', { provider: 'openai' }, userId, 'stagehand-route');
                return NextResponse.json({ error: keyValidation.error }, { status: 400 });
            }
        }
        if (anthropicApiKey) {
            const keyValidation = validateApiKeyFormat(anthropicApiKey, 'anthropic');
            if (!keyValidation.isValid) {
                logSecurityViolation('invalid_api_key_format', { provider: 'anthropic' }, userId, 'stagehand-route');
                return NextResponse.json({ error: keyValidation.error }, { status: 400 });
            }
        }
        if (googleApiKey) {
            const keyValidation = validateApiKeyFormat(googleApiKey, 'google');
            if (!keyValidation.isValid) {
                logSecurityViolation('invalid_api_key_format', { provider: 'google' }, userId, 'stagehand-route');
                return NextResponse.json({ error: keyValidation.error }, { status: 400 });
            }
        }
        if (openrouterApiKey) {
            const keyValidation = validateApiKeyFormat(openrouterApiKey, 'openrouter');
            if (!keyValidation.isValid) {
                logSecurityViolation('invalid_api_key_format', { provider: 'openrouter' }, userId, 'stagehand-route');
                return NextResponse.json({ error: keyValidation.error }, { status: 400 });
            }
        }

        // Validate secrets
        if (secrets) {
            const secretsValidation = validateSecrets(secrets);
            if (!secretsValidation.isValid) {
                logSecurityViolation('invalid_secrets', { error: secretsValidation.error }, userId, 'stagehand-route');
                return NextResponse.json({ error: `Invalid secrets: ${secretsValidation.error}` }, { status: 400 });
            }

            // Check for suspicious secrets (potential attack)
            if (detectSuspiciousSecrets(secrets)) {
                logSecurityViolation('suspicious_secrets', {}, userId, 'stagehand-route');
                return NextResponse.json({ error: 'Suspicious secrets detected. This may indicate an injection attempt.' }, { status: 403 });
            }
        }

        // Create browser profile configuration using user_id
        const browserProfileConfig = {
            ...config,
            browser: {
                ...config.browser,
                profile: {
                    name: `profile-${userId}`,
                    persist: true
                }
            }
        };

        // Create browser session (external API call) - this is the main bottleneck
        const browserSession = await browser.sessions.create(browserProfileConfig).catch((e: any) => {
            if (e?.status === 401 || e?.status === 403) {
                return Promise.reject(missingKey("Anchor Browser", true));
            }
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

        let dbSessionId: string;
        let agentId: any; // Use any to avoid type conflicts with Convex ID types

        // If sessionId is provided, add agent to existing session
        // Otherwise, create a new session
        if (existingSessionId) {
            // AUTHORIZATION CHECK: Verify session belongs to the authenticated user
            const session = await convex.query(api.queries.verifySessionOwnership, {
                sessionId: existingSessionId,
            });

            if (!session) {
                return NextResponse.json(
                    { error: "Unauthorized: You can only add agents to your own sessions" },
                    { status: 403 }
                );
            }

            agentId = await convex.mutation(api.mutations.createAgent, {
                sessionId: existingSessionId,
                name: "stagehand",
                model: defaultModel,
                browser: {
                    sessionId: browserSessionId,
                    url: liveViewUrl,
                },
            });
            dbSessionId = existingSessionId;
        } else {
            // Create both session and agent in the database at the same time
            const result = await convex.mutation(api.mutations.createSession, {
                instruction,
                browserData: {
                    sessionId: browserSessionId,
                    url: liveViewUrl,
                },
                agentName: "stagehand",
                model: defaultModel,
            });
            dbSessionId = result.sessionId;
            agentId = result.agentId!;
        }

        if (!agentId) {
            return NextResponse.json({ error: "Failed to create agent" }, { status: 500 });
        }

        // Fire-and-forget: run Stagehand in background to avoid frontend timeout
        after(async () => {
            try {
                if (secrets) {
                    // Log secrets count without exposing key names for security
                    console.log("🔐 Forwarding secrets to Stagehand server", {
                        count: Object.keys(secrets).length,
                    });
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
                        model: defaultModel,
                        thinkingModel,
                        executionModel,
                        cdpUrl,
                        liveViewUrl,
                        agentId,
                        userId: userId,
                        keys: {
                            openai: openaiApiKey,
                            google: googleApiKey,
                            anthropic: anthropicApiKey,
                            openrouter: openrouterApiKey,
                        },
                        ...(fileData ? { fileData } : {}),
                        ...(secrets ? { secrets } : {}),
                    }),
                });

                if (!resp.ok) {
                    // Mark failed so UI can reflect error
                    await convexBackend.mutation(api.mutations.updateAgentStatusFromBackend, {
                        agentId,
                        status: "failed",
                    });
                }
            } catch (err) {
                try {
                    await convexBackend.mutation(api.mutations.updateAgentStatusFromBackend, {
                        agentId,
                        status: "failed",
                    });
                } catch { }
            }
        });

        // Return session info with live URL immediately (non-blocking)
        return NextResponse.json({
            session: {
                id: dbSessionId,
            },
            agentId,
            liveViewUrl,
        });
    } catch (error) {
        console.error("❌ Error in POST handler:", error);
        return NextResponse.json(
            {
                error: "Internal server error",
                message: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}