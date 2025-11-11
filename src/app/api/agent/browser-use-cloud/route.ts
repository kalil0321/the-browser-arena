import { after, NextRequest, NextResponse } from "next/server";
import { BrowserUseClient } from "browser-use-sdk";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { getToken } from "@/lib/auth/server";
import { validateInstruction, logValidationFailure } from "@/lib/instruction-validation";
import { badRequest } from "@/lib/http-errors";
import { validateSecrets, validateApiKeyFormat, validateModelName, detectSuspiciousSecrets, logSecurityViolation } from "@/lib/security/validation";

// Create a separate Convex client for background tasks (no auth needed - uses backend mutations)
const convexBackend = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Initialize Browser Use Cloud client
const getBrowserUseClient = (userApiKey?: string) => {
    const apiKey = userApiKey || process.env.BROWSER_USE_API_KEY;
    if (!apiKey) {
        throw new Error("BROWSER_USE_API_KEY is required. Please provide your API key in Settings or set the environment variable.");
    }
    return new BrowserUseClient({ apiKey });
};

// Map UI model names to Browser Use Cloud API model names
const mapModelToApiModel = (model: string): string => {
    const modelMap: Record<string, string> = {
        "claude-sonnet-4": "claude-sonnet-4-20250514",
        // Add other mappings as needed
    };
    return modelMap[model] || model;
};

export async function POST(request: NextRequest) {
    try {
        const { instruction, model, sessionId: existingSessionId, browserUseApiKey, secrets } = await request.json();

        // Validate instruction
        if (!instruction || typeof instruction !== 'string' || !instruction.trim()) {
            return badRequest("Field 'instruction' is required");
        }

        // Validate instruction for prompt injection attempts
        const validationResult = validateInstruction(instruction);
        if (!validationResult.isValid) {
            logValidationFailure(instruction, validationResult, undefined, "browser-use-cloud-route");
            return badRequest(validationResult.error || "Invalid instruction");
        }

        // Get user token for auth
        const token = await getToken();

        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Create Convex client per request for better isolation
        const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
        convex.setAuth(token);

        // Get current user for security logging
        const user = await convex.query(api.auth.getCurrentUser, {});
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const userId = user._id;

        // Validate API key format if provided
        if (browserUseApiKey) {
            const keyValidation = validateApiKeyFormat(browserUseApiKey, 'browseruse');
            if (!keyValidation.isValid) {
                logSecurityViolation('invalid_api_key_format', { provider: 'browseruse' }, userId, 'browser-use-cloud-route');
                return NextResponse.json({ error: keyValidation.error }, { status: 400 });
            }
        }

        // Map model name to API-expected format
        const apiModel = (model ? mapModelToApiModel(model) : "browser-use-llm") as any;

        // Validate model name
        const modelValidation = validateModelName(apiModel);
        if (!modelValidation.isValid) {
            logSecurityViolation('invalid_model_name', { model: apiModel }, userId, 'browser-use-cloud-route');
            return NextResponse.json({ error: `Invalid model: ${modelValidation.error}` }, { status: 400 });
        }

        // Validate secrets
        if (secrets) {
            const secretsValidation = validateSecrets(secrets);
            if (!secretsValidation.isValid) {
                logSecurityViolation('invalid_secrets', { error: secretsValidation.error }, userId, 'browser-use-cloud-route');
                return NextResponse.json({ error: `Invalid secrets: ${secretsValidation.error}` }, { status: 400 });
            }

            // Check for suspicious secrets (potential attack)
            if (detectSuspiciousSecrets(secrets)) {
                logSecurityViolation('suspicious_secrets', {}, userId, 'browser-use-cloud-route');
                return NextResponse.json({ error: 'Suspicious secrets detected. This may indicate an injection attempt.' }, { status: 403 });
            }

            // Log secrets count without exposing key names for security
            console.log("🔐 Forwarding secrets to Browser-Use Cloud", {
                count: Object.keys(secrets).length,
            });
        }

        // Initialize Browser Use Cloud client with user's API key if provided
        const client = getBrowserUseClient(browserUseApiKey);
        console.log(browserUseApiKey ? "🔑 Using user's Browser-Use API key" : "ℹ️ Using server Browser-Use API key (fallback)");

        const task = await client.tasks.createTask({
            task: instruction,
            llm: apiModel,
            ...(secrets ? { secrets } : {}),
            // sessionId is optional - will auto-create if not provided
        });

        const taskId = task.id;
        const taskSessionId = (task as any).sessionId;
        // Live URL may not be available immediately, will be updated via streaming
        // We'll need to fetch session info or get it from streaming updates
        const liveViewUrl = "";

        let dbSessionId: string;
        let agentId: any;

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
                name: "browser-use-cloud",
                model: model || "browser-use-llm", // Keep original model name for DB
                browser: {
                    sessionId: taskId,
                    url: liveViewUrl,
                },
            });
            dbSessionId = existingSessionId;
        } else {
            // Create both session and agent in the database at the same time
            const result = await convex.mutation(api.mutations.createSession, {
                instruction,
                browserData: {
                    sessionId: taskId,
                    url: liveViewUrl,
                },
                agentName: "browser-use-cloud",
                model: model || "browser-use-llm",
            });
            dbSessionId = result.sessionId;
            agentId = result.agentId!;
        }

        if (!agentId) {
            return NextResponse.json({ error: "Failed to create agent" }, { status: 500 });
        }

        // Execute task in background and update Convex when complete
        // Capture taskId and API key for use in background execution
        const backgroundTaskId = taskId;
        const backgroundTask = task;
        const backgroundApiKey = browserUseApiKey;

        after(async () => {
            try {
                // Poll for live URL availability instead of streaming
                const pollForLiveUrl = async () => {
                    const bgClient = getBrowserUseClient(backgroundApiKey);
                    const maxAttempts = 30; // ~30s
                    const delayMs = 1000;
                    const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

                    for (let attempt = 0; attempt < maxAttempts; attempt++) {
                        try {
                            // Prefer session lookup if we have it
                            if (taskSessionId) {
                                const session = await bgClient.sessions.getSession(taskSessionId);
                                const sessionLiveUrl = (session as any).liveUrl || (session as any).live_view_url || "";
                                if (sessionLiveUrl) {
                                    await convexBackend.mutation(api.mutations.updateAgentBrowserUrlFromBackend, {
                                        agentId,
                                        url: sessionLiveUrl,
                                    });
                                    console.log("Browser Use Cloud: Live URL found via polling:", sessionLiveUrl);
                                    return;
                                }
                            }

                            // Fallback: check task details for embedded session/liveUrl
                            const taskView = await bgClient.tasks.getTask(backgroundTaskId);
                            const taskLiveUrl = (taskView as any).session?.liveUrl || (taskView as any).liveUrl || (taskView as any).live_view_url || "";
                            if (taskLiveUrl) {
                                await convexBackend.mutation(api.mutations.updateAgentBrowserUrlFromBackend, {
                                    agentId,
                                    url: taskLiveUrl,
                                });
                                console.log("Browser Use Cloud: Live URL found via task polling:", taskLiveUrl);
                                return;
                            }
                        } catch (e) {
                            // Non-fatal; continue polling
                            if (attempt % 5 === 0) {
                                console.log("Polling live URL...", { attempt: attempt + 1 });
                            }
                        }
                        await sleep(delayMs);
                    }
                };

                // Start live URL polling in background while we wait for completion
                const pollPromise = pollForLiveUrl();

                // Wait for task to complete (this internally waits, but we stream in parallel for live URL updates)
                const result = await backgroundTask.complete();

                // Ensure polling finishes (or times out) before proceeding
                await pollPromise.catch(() => { });

                // Prepare result payload based on Browser Use Cloud API TaskView structure
                // See: https://docs.cloud.browser-use.com/api-reference/v-2-api-current/tasks/get-task-tasks-task-id-get
                const resultStatus = (result as any).status || "finished";
                const resultOutput = (result as any).output || null;
                const resultSteps = (result as any).steps || [];
                const resultOutputFiles = (result as any).outputFiles || [];
                const resultMetadata = (result as any).metadata || {};
                const resultIsSuccess = (result as any).isSuccess;
                const resultStartedAt = (result as any).startedAt;
                const resultFinishedAt = (result as any).finishedAt;
                const resultSessionId = (result as any).sessionId || backgroundTaskId;

                // Calculate duration if both timestamps are available
                let duration: number | undefined;
                if (resultStartedAt && resultFinishedAt) {
                    const start = new Date(resultStartedAt).getTime();
                    const end = new Date(resultFinishedAt).getTime();
                    duration = (end - start) / 1000; // Convert to seconds
                }

                // Try to get session info for live URL
                let finalLiveUrl = liveViewUrl;
                try {
                    if (resultSessionId) {
                        const bgClient = getBrowserUseClient(backgroundApiKey);
                        const session = await bgClient.sessions.getSession(resultSessionId);
                        finalLiveUrl = (session as any).liveUrl || (session as any).live_view_url || "";
                    }
                } catch (sessionError) {
                    console.error("Failed to get session info for live URL:", sessionError);
                }

                // Map Browser Use Cloud status to our status
                // Browser Use: started, paused, finished, stopped
                // Our system: pending, running, completed, failed
                const isCompleted = resultStatus === "finished";
                const isFailed = resultStatus === "stopped" || (resultIsSuccess === false);
                const isSuccess = isCompleted && (resultIsSuccess !== false);

                // Calculate cost: $0.01 per step
                const numberOfSteps = resultSteps.length;
                const cost = numberOfSteps * 0.01;

                const payload = {
                    agent: "browser-use-cloud",
                    taskId: taskId,
                    sessionId: resultSessionId,
                    status: resultStatus,
                    output: resultOutput,
                    steps: resultSteps.map((step: any) => ({
                        number: step.number,
                        url: step.url,
                        screenshotUrl: step.screenshotUrl,
                        actions: step.actions,
                        memory: step.memory,
                        evaluationPreviousGoal: step.evaluationPreviousGoal,
                        nextGoal: step.nextGoal,
                    })),
                    outputFiles: resultOutputFiles.map((file: any) => ({
                        id: file.id,
                        fileName: file.fileName,
                    })),
                    completed: isCompleted,
                    success: isSuccess,
                    message: isSuccess
                        ? "Task completed successfully"
                        : isFailed
                            ? "Task failed or was stopped"
                            : "Task completed",
                    metadata: {
                        ...resultMetadata,
                        ...(duration !== undefined && { duration }),
                        startedAt: resultStartedAt,
                        finishedAt: resultFinishedAt,
                        browserUseVersion: (result as any).browserUseVersion,
                    },
                    liveUrl: finalLiveUrl,
                    cost: cost,
                    usage: {
                        total_cost: cost,
                        total_tokens: 0, // Browser Use Cloud doesn't provide token count
                        steps: numberOfSteps,
                    },
                };

                // Save result to Convex database using backend mutation (no auth required)
                const finalStatus = isCompleted && isSuccess ? ("completed" as const) :
                    isFailed ? ("failed" as const) :
                        ("completed" as const);

                await convexBackend.mutation(api.mutations.updateAgentResultFromBackend, {
                    agentId,
                    result: payload,
                    status: finalStatus,
                });

                // Update live URL in browser data if different
                if (finalLiveUrl && finalLiveUrl !== liveViewUrl) {
                    try {
                        await convexBackend.mutation(api.mutations.updateAgentBrowserUrlFromBackend, {
                            agentId,
                            url: finalLiveUrl,
                        });
                    } catch (e) {
                        console.error("Failed to update agent live URL:", e);
                    }
                }

                // Save recording URL if available
                // Browser Use Cloud might provide recording URL in metadata or we need to fetch from session
                let recordingUrl = (result as any).recordingUrl ||
                    resultMetadata.recordingUrl ||
                    resultMetadata.recording_url ||
                    "";

                // Try to get recording from session if not in result
                if (!recordingUrl && resultSessionId) {
                    try {
                        const bgClient = getBrowserUseClient(backgroundApiKey);
                        const session = await bgClient.sessions.getSession(resultSessionId);
                        recordingUrl = (session as any).recordingUrl ||
                            (session as any).recording_url ||
                            (session as any).recording?.url ||
                            "";
                    } catch (sessionError) {
                        console.error("Failed to get recording URL from session:", sessionError);
                    }
                }

                if (recordingUrl) {
                    await convexBackend.mutation(api.mutations.updateAgentRecordingUrlFromBackend, {
                        agentId,
                        recordingUrl: recordingUrl,
                    });
                }

                console.log("Browser Use Cloud task completed:", JSON.stringify(payload, null, 2));
            } catch (error) {
                console.error("❌ Error in background execution:", error);
                try {
                    // Update agent status to failed using backend mutation
                    await convexBackend.mutation(api.mutations.updateAgentStatusFromBackend, {
                        agentId,
                        status: "failed",
                        error: error instanceof Error ? error.message : String(error),
                    });
                } catch (cleanupError) {
                    console.error("❌ Error updating agent status:", cleanupError);
                }
            }
        });

        // Return session object and live view url immediately
        return NextResponse.json({
            session: {
                id: dbSessionId,
            },
            agentId,
            liveViewUrl: liveViewUrl,
            taskId: taskId,
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

