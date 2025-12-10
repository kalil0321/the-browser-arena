import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { getToken } from "@/lib/auth/server";
import { badRequest, mapProviderError, serverMisconfigured, unauthorized, providerUnavailable } from "@/lib/http-errors";
import { validateInstruction, logValidationFailure } from "@/lib/instruction-validation";
import { validateSecrets, validateApiKeyFormat, validateModelName, detectSuspiciousSecrets, logSecurityViolation } from "@/lib/security/validation";
import { createBrowserSession } from "@/lib/browser";

// Python agent server URL
const AGENT_SERVER_URL = process.env.AGENT_SERVER_URL || "http://localhost:8080";



export async function POST(request: NextRequest) {
    try {
        const {
            instruction,
            model,
            secrets,
            openaiApiKey,
            googleApiKey,
            anthropicApiKey,
            browserUseApiKey,
            fileId,
        } = await request.json();
        if (!instruction || typeof instruction !== 'string' || !instruction.trim()) {
            return badRequest("Field 'instruction' is required");
        }

        // Validate instruction for prompt injection attempts
        const validationResult = validateInstruction(instruction);
        if (!validationResult.isValid) {
            logValidationFailure(instruction, validationResult, undefined, "browser-use-route");
            return badRequest(validationResult.error || "Invalid instruction");
        }

        // Get user token for auth
        const token = await getToken();

        if (!token) {
            return unauthorized();
        }

        // Create Convex client per request for better isolation and set auth
        const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
        convex.setAuth(token);

        // Get current user for security logging and browser profile
        const user = await convex.query(api.auth.getCurrentUser, {});
        if (!user) {
            return unauthorized();
        }
        const userId = user._id;

        // Prepare Python server request data
        const providerModel = model || "browser-use/bu-1.0";

        // Validate model name
        const modelValidation = validateModelName(providerModel);
        if (!modelValidation.isValid) {
            logSecurityViolation('invalid_model_name', { model: providerModel }, userId, 'browser-use-route');
            return NextResponse.json({ error: `Invalid model: ${modelValidation.error}` }, { status: 400 });
        }

        // Validate API key formats
        if (openaiApiKey) {
            const keyValidation = validateApiKeyFormat(openaiApiKey, 'openai');
            if (!keyValidation.isValid) {
                logSecurityViolation('invalid_api_key_format', { provider: 'openai' }, userId, 'browser-use-route');
                return NextResponse.json({ error: keyValidation.error }, { status: 400 });
            }
        }
        if (anthropicApiKey) {
            const keyValidation = validateApiKeyFormat(anthropicApiKey, 'anthropic');
            if (!keyValidation.isValid) {
                logSecurityViolation('invalid_api_key_format', { provider: 'anthropic' }, userId, 'browser-use-route');
                return NextResponse.json({ error: keyValidation.error }, { status: 400 });
            }
        }
        if (googleApiKey) {
            const keyValidation = validateApiKeyFormat(googleApiKey, 'google');
            if (!keyValidation.isValid) {
                logSecurityViolation('invalid_api_key_format', { provider: 'google' }, userId, 'browser-use-route');
                return NextResponse.json({ error: keyValidation.error }, { status: 400 });
            }
        }
        if (browserUseApiKey) {
            const keyValidation = validateApiKeyFormat(browserUseApiKey, 'browseruse');
            if (!keyValidation.isValid) {
                logSecurityViolation('invalid_api_key_format', { provider: 'browseruse' }, userId, 'browser-use-route');
                return NextResponse.json({ error: keyValidation.error }, { status: 400 });
            }
        }

        // Validate secrets
        if (secrets) {
            const secretsValidation = validateSecrets(secrets);
            if (!secretsValidation.isValid) {
                logSecurityViolation('invalid_secrets', { error: secretsValidation.error }, userId, 'browser-use-route');
                return NextResponse.json({ error: `Invalid secrets: ${secretsValidation.error}` }, { status: 400 });
            }

            // Check for suspicious secrets (potential attack)
            if (detectSuspiciousSecrets(secrets)) {
                logSecurityViolation('suspicious_secrets', {}, userId, 'browser-use-route');
                return NextResponse.json({ error: 'Suspicious secrets detected. This may indicate an injection attempt.' }, { status: 403 });
            }
        }

        // Create browser profile configuration using user_id
        const browserConfig = {
            browser: {
                profile: {
                    name: `profile-${userId}`,
                    persist: true
                }
            }
        };

        // CRITICAL: Parallelize browser session creation with Convex session creation
        // This saves 3-5 seconds by not blocking on browser session creation
        const [sessionResult, 
            { browserSessionId, cdpUrl, liveViewUrl }
        ] = await Promise.all([
            convex.mutation(api.mutations.createSession, {
                instruction,
            }),
            createBrowserSession(browserConfig),
        ]);


        // This is the Convex sesssion ID (the ID of the agents session, meaning 
        // the id to retrieve the session from the database, the agents activity, what we see in the UI
        // it's different from the browser session id)
        const { sessionId: dbSessionId } = sessionResult;

        if (!liveViewUrl) {
            return NextResponse.json({ error: "Failed to create browser session - no live_view_url" }, { status: 500 });
        }

        if (!cdpUrl) {
            return NextResponse.json({ error: "Failed to create browser session - no cdp_url" }, { status: 500 });
        }

        // Call Python agent server with browser session info (no blocking browser creation!)
        const agentServerApiKey = process.env.AGENT_SERVER_API_KEY;
        if (!agentServerApiKey) {
            return NextResponse.json({ error: "AGENT_SERVER_API_KEY is not configured" }, { status: 500 });
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
                providerModel,
                browserSessionId,
                cdpUrl,
                liveViewUrl,
                ...(secrets ? { secrets } : {}),
                ...(openaiApiKey ? { openaiApiKey } : {}),
                ...(googleApiKey ? { googleApiKey } : {}),
                ...(anthropicApiKey ? { anthropicApiKey } : {}),
                ...(browserUseApiKey ? { browserUseApiKey } : {}),
                userId: userId,
                ...(fileId ? { fileId } : {}),
            }),
        });

        if (!agentResponse.ok) {
            return await mapProviderError(agentResponse, 'python-agent');
        }

        const agentData = await agentResponse.json();

        // Return session info with live URL immediately
        return NextResponse.json({
            session: {
                id: dbSessionId,
            },
            agentId: agentData.agentId,
            liveViewUrl: agentData.liveUrl,
            browserSessionId: agentData.browserSessionId,
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

