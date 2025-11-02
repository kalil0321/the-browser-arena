import { after, NextRequest, NextResponse } from "next/server";
import { BrowserUseClient } from "browser-use-sdk";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { getToken } from "@/lib/auth/server";

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

export async function POST(request: NextRequest) {
    try {
        const { instruction, model, sessionId: existingSessionId, browserUseApiKey, secrets } = await request.json();

        // Get user token for auth
        const token = await getToken();

        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Create Convex client per request for better isolation
        const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
        convex.setAuth(token);

        // Initialize Browser Use Cloud client with user's API key if provided
        const client = getBrowserUseClient(browserUseApiKey);
        console.log(browserUseApiKey ? "🔑 Using user's Browser-Use API key" : "ℹ️ Using server Browser-Use API key (fallback)");

        // Create task in Browser Use Cloud
        if (secrets) {
            console.log("🔐 Forwarding secrets to Browser-Use Cloud", {
                keys: Object.keys(secrets),
                count: Object.keys(secrets).length,
            });
        }

        const task = await client.tasks.createTask({
            task: instruction,
            llm: model || "browser-use-llm",
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
            agentId = await convex.mutation(api.mutations.createAgent, {
                sessionId: existingSessionId,
                name: "browser-use-cloud",
                model: model || "browser-use-llm",
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

