import { after, NextRequest, NextResponse } from "next/server";
import { Stagehand } from "@browserbasehq/stagehand";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { getToken } from "@/lib/auth/server";
import { computeCost } from "@/lib/pricing";
import { validateInstruction, logValidationFailure } from "@/lib/instruction-validation";
import { badRequest } from "@/lib/http-errors";

// Create a separate Convex client for background tasks (no auth needed - uses backend mutations)
const convexBackend = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Initialize Browserbase client helper
const getBrowserbaseConfig = () => {
    const apiKey = process.env.BROWSERBASE_API_KEY;
    const projectId = process.env.BROWSERBASE_PROJECT_ID;

    if (!apiKey) {
        throw new Error("BROWSERBASE_API_KEY environment variable is required");
    }
    if (!projectId) {
        throw new Error("BROWSERBASE_PROJECT_ID environment variable is required");
    }

    return { apiKey, projectId };
};

const determineKey = (model: string | undefined, userKeys: { openai?: string; google?: string; anthropic?: string; openrouter?: string }) => {
    if (!model) {
        // Default to Google if no model specified
        if (userKeys.google?.trim()) {
            console.log("✅ Using user-provided Google API key");
            return userKeys.google.trim();
        }
        return process.env.GOOGLE_API_KEY;
    }
    const provider = model.split("/")[0];

    // Handle OpenRouter models
    if (provider === "openrouter") {
        if (userKeys.openrouter?.trim()) {
            console.log("✅ Using user-provided OpenRouter API key");
            return userKeys.openrouter.trim();
        }
        return process.env.OPENROUTER_API_KEY || "";
    }

    if (provider === "google") {
        if (userKeys.google?.trim()) {
            console.log("✅ Using user-provided Google API key");
            return userKeys.google.trim();
        }
        return process.env.GOOGLE_API_KEY;
    }
    if (provider === "openai") {
        if (userKeys.openai?.trim()) {
            console.log("✅ Using user-provided OpenAI API key");
            return userKeys.openai.trim();
        }
        return process.env.OPENAI_API_KEY;
    }
    if (provider === "anthropic") {
        if (userKeys.anthropic?.trim()) {
            console.log("✅ Using user-provided Anthropic API key");
            return userKeys.anthropic.trim();
        }
        return process.env.ANTHROPIC_API_KEY;
    }

    // Fallback to OpenAI
    if (userKeys.openai?.trim()) {
        console.log("✅ Using user-provided OpenAI API key");
        return userKeys.openai.trim();
    }
    return process.env.OPENAI_API_KEY;
}

export async function POST(request: NextRequest) {
    try {
        const { instruction, model, sessionId: existingSessionId, openaiApiKey, googleApiKey, anthropicApiKey, openrouterApiKey } = await request.json();

        // Validate instruction
        if (!instruction || typeof instruction !== 'string' || !instruction.trim()) {
            return badRequest("Field 'instruction' is required");
        }

        // Validate instruction for prompt injection attempts
        const validationResult = validateInstruction(instruction);
        if (!validationResult.isValid) {
            logValidationFailure(instruction, validationResult, undefined, "stagehand-cloud-route");
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

        // Get Browserbase config
        const browserbaseConfig = getBrowserbaseConfig();
        const modelString = model ?? "google/gemini-2.5-flash";

        const stagehand = new Stagehand({
            env: "BROWSERBASE",
            apiKey: browserbaseConfig.apiKey,
            projectId: browserbaseConfig.projectId,
            disablePino: true,
            model: {
                modelName: modelString,
                apiKey: determineKey(model, { openai: openaiApiKey, google: googleApiKey, anthropic: anthropicApiKey, openrouter: openrouterApiKey }),
            },
        });

        // Browserbase manages sessions internally, so we don't create a browser session manually
        // The live view URL will be available from Stagehand after init
        let liveViewUrl = "";

        // @ts-ignore
        const result: { debugUrl?: string, sessionUrl?: string, sessionId?: string } = await stagehand.init();
        console.log("Stagehand init result:", result);
        liveViewUrl = result?.debugUrl ?? "";

        if (!liveViewUrl) {
            return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
        }

        // Get current user for authorization checks
        const user = await convex.query(api.auth.getCurrentUser, {});
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
                name: "stagehand-cloud",
                model: modelString,
                browser: {
                    sessionId: "", // Browserbase session ID will be set after init
                    url: liveViewUrl,
                },
            });
            dbSessionId = existingSessionId;
        } else {
            // Create both session and agent in the database at the same time
            const result = await convex.mutation(api.mutations.createSession, {
                instruction,
                browserData: {
                    sessionId: "", // Browserbase session ID will be set after init
                    url: liveViewUrl,
                },
                agentName: "stagehand-cloud",
                model: modelString,
            });
            dbSessionId = result.sessionId;
            agentId = result.agentId!;
        }

        if (!agentId) {
            return NextResponse.json({ error: "Failed to create agent" }, { status: 500 });
        }

        after(async () => {
            const startTime = Date.now();
            try {
                const userKeys = {
                    openai: openaiApiKey,
                    google: googleApiKey,
                    anthropic: anthropicApiKey,
                    openrouter: openrouterApiKey,
                };
                const stagehand = new Stagehand({
                    env: "BROWSERBASE",
                    apiKey: browserbaseConfig.apiKey,
                    projectId: browserbaseConfig.projectId,
                    disablePino: true,
                    model: {
                        modelName: modelString,
                        apiKey: determineKey(model, userKeys),
                    },
                });

                const agent = await stagehand.agent({
                    model: modelString,
                    executionModel: modelString, // TODO: later allow to choose different model for execution
                    // TODO: add tools later
                });

                const { message, actions, usage, success, completed, metadata } = await agent.execute({
                    highlightCursor: false,
                    instruction,
                });

                await stagehand.close();
                const endTime = Date.now();
                const duration = (endTime - startTime) / 1000; // Convert to seconds

                const usageData = usage ?? { input_tokens: 0, output_tokens: 0, inference_time_ms: 0 };
                const llmCost = computeCost(model, usageData);
                // Browserbase pricing: $0.2 per hour
                const hours = Math.max(duration / 3600, 0);
                const browserCost = 0.2 * hours;
                const cost = llmCost + browserCost;

                const payload = {
                    usage: {
                        ...usageData,
                        total_cost: cost,
                        browser_cost: browserCost,
                        llm_cost: llmCost,
                    },
                    cost,
                    duration,
                    message,
                    actions,
                    success: true,
                    agent: "stagehand-cloud",
                    completed: true,
                    metadata: {
                        ...metadata,
                        browserbaseSessionId: result?.sessionId ?? "",
                    },
                }

                // Save result to Convex database using backend mutation (no auth required)
                await convexBackend.mutation(api.mutations.updateAgentResultFromBackend, {
                    agentId,
                    result: payload,
                    status: success ? "completed" as const : "failed" as const,
                });

                console.log(JSON.stringify(payload, null, 2));
            } catch (error) {
                console.error("❌ Error in background execution:", error);
                try {
                    // Update agent status to failed using backend mutation
                    await convexBackend.mutation(api.mutations.updateAgentStatusFromBackend, {
                        agentId,
                        status: "failed",
                    });
                } catch (cleanupError) {
                    console.error("❌ Error updating agent status:", cleanupError);
                }
            }
        });

        // Return session object and live view url (may be empty initially)
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

