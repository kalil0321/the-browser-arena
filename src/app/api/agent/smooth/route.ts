import { after, NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { getToken } from "@/lib/auth/server";

const smoothUrl = 'https://api.smooth.sh/api/v1/task';
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Get the API key to use - prioritize user key, fallback to server key
 */
function getSmoothApiKey(userApiKey?: string): string {
    if (userApiKey && userApiKey.trim()) {
        console.log("✅ Using user-provided Smooth API key (length:", userApiKey.trim().length, "characters)");
        return userApiKey.trim();
    }

    // Fallback to server key
    const serverKey = process.env.SMOOTH_API_KEY;
    if (!serverKey) {
        throw new Error("No Smooth API key available. Please provide your API key in settings.");
    }
    console.log("ℹ️ Using server Smooth API key (fallback)");
    return serverKey;
}

async function runTask(task: string, apiKey: string) {
    try {
        const payload = {
            task,
            device: 'desktop',
        };

        const response = await fetch(smoothUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apiKey
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Task submitted:', data);
        // The API returns the task object directly
        return data.r;
    } catch (error) {
        console.error('Error running task:', error);
        throw error;
    }
}

async function getTaskStatus(taskId: string, apiKey: string): Promise<TaskStatus> {
    try {
        const response = await fetch(`${smoothUrl}/${taskId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apiKey
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.r as TaskStatus;
    } catch (error) {
        console.error('Error getting task status:', error);
        throw error;
    }
}

type TaskStatus = {
    id: string;
    status: string;
    output: any;
    credits_used: number | null;
    device: string;
    recording_url: string | null;
    created_at: number;
    credits_balance: number;
    duration: number;
    live_url: string | null;
}

async function pollTaskUntilComplete(
    taskId: string,
    apiKey: string,
    onUpdate?: (status: TaskStatus) => Promise<void>,
    maxAttempts: number = 100_000,
    intervalMs: number = 3_000
): Promise<TaskStatus> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const taskStatus = await getTaskStatus(taskId, apiKey);

        // Invoke update callback so callers can react to intermediate updates (e.g., live_url)
        if (onUpdate) {
            await onUpdate(taskStatus);
        }

        // Check if task is complete based on Smooth API status values
        // Available statuses: waiting, running, done, failed, cancelled
        if (taskStatus.status === 'done' || taskStatus.status === 'failed' || taskStatus.status === 'cancelled') {
            return taskStatus;
        }

        // Wait before next poll
        if (attempt < maxAttempts - 1) {
            await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
    }

    throw new Error('Task polling timeout');
}

export async function POST(request: NextRequest) {
    try {
        const { task, sessionId: existingSessionId, apiKey: userApiKey } = await request.json();

        // Get user token for auth
        const token = await getToken();
        console.log("Auth token:", token ? "Present" : "Missing");

        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        convex.setAuth(token);

        // Get API key to use (user key or fallback to server key)
        const apiKey = getSmoothApiKey(userApiKey);

        // Submit task to Smooth API
        console.log("🚀 Submitting task to Smooth API...");
        const taskData = await runTask(task, apiKey);
        const { id: smoothTaskId, live_url } = taskData;

        if (!smoothTaskId) {
            console.error("❌ Failed to create task - missing id");
            return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
        }

        // live_url might be null initially, use it if available
        const liveViewUrl = live_url || "";

        let dbSessionId: string;
        let agentId: any; // Use any to avoid type conflicts with Convex ID types

        // If sessionId is provided, add agent to existing session
        // Otherwise, create a new session
        if (existingSessionId) {
            agentId = await convex.mutation(api.mutations.createAgent, {
                sessionId: existingSessionId,
                name: "smooth",
                model: "smooth", // Smooth doesn't support model selection
                browser: {
                    sessionId: smoothTaskId,
                    url: liveViewUrl,
                },
            });
            dbSessionId = existingSessionId;
        } else {
            // Create both session and agent in the database at the same time
            const result = await convex.mutation(api.mutations.createSession, {
                instruction: task,
                browserData: {
                    sessionId: smoothTaskId,
                    url: liveViewUrl,
                },
                agentName: "smooth",
                model: "smooth", // Smooth doesn't support model selection
            });
            dbSessionId = result.sessionId;
            agentId = result.agentId!;
        }

        if (!agentId) {
            return NextResponse.json({ error: "Failed to create agent" }, { status: 500 });
        }

        after(async () => {
            try {
                // Poll for task completion and update DB as soon as live_url becomes available
                // Note: apiKey is captured from outer scope
                let liveUrlUpdated = !!liveViewUrl;
                const taskResult = await pollTaskUntilComplete(
                    smoothTaskId,
                    apiKey,
                    async (status) => {
                        if (!liveUrlUpdated && status.live_url) {
                            console.log("Smooth: Updating agent live URL:", status.live_url);
                            try {
                                await convex.mutation(api.mutations.updateAgentBrowserUrl, {
                                    agentId,
                                    url: status.live_url,
                                });
                                liveUrlUpdated = true;
                            } catch (e) {
                                console.error("Failed to update agent live URL:", e);
                            }
                        }
                    }
                );

                // Prepare result payload based on Smooth API response format
                // Compute duration using server time - created_at (seconds)
                const durationSeconds = taskResult.duration;
                const payload = {
                    agent: "smooth",
                    taskId: smoothTaskId,
                    status: taskResult.status,
                    output: taskResult.output,
                    credits_used: taskResult.credits_used ?? -1,
                    cost: 0.01 * (taskResult.credits_used ?? -1),
                    device: taskResult.device,
                    created_at: taskResult.created_at ?? -1,
                    metadata: {
                        duration: durationSeconds,
                    },
                    completed: taskResult.status === 'done',
                    success: taskResult.status === 'done',
                    message: taskResult.status === 'done'
                        ? "Task completed successfully"
                        : taskResult.status === 'failed'
                            ? "Task failed"
                            : taskResult.status === 'cancelled'
                                ? "Task was cancelled"
                                : "Task completed",
                };

                // Save result to Convex database
                // Note: token is already set from initial request
                await convex.mutation(api.mutations.updateAgentResult, {
                    agentId,
                    result: payload,
                });

                // Save recording URL if available
                if (taskResult.recording_url) {
                    await convex.mutation(api.mutations.updateAgentRecordingUrl, {
                        agentId,
                        recordingUrl: taskResult.recording_url,
                    });
                }

                console.log(JSON.stringify(payload, null, 2));
            } catch (error) {
                console.error("❌ Error in background execution:", error);
                try {
                    // Update agent status to failed
                    // Note: token is already set from initial request
                    await convex.mutation(api.mutations.updateAgentStatus, {
                        agentId,
                        status: "failed",
                    });
                } catch (cleanupError) {
                    console.error("❌ Error updating agent status:", cleanupError);
                }
            }
        });

        // Return session object and live view url
        return NextResponse.json({
            session: {
                id: dbSessionId,
            },
            agentId,
            liveViewUrl: liveViewUrl,
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