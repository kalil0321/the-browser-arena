import { after, NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { getToken } from "@/lib/auth/server";
import { badRequest, serverMisconfigured, unauthorized } from "@/lib/http-errors";
import { validateInstruction, logValidationFailure } from "@/lib/instruction-validation";
import { createBrowserSession, deleteBrowserSession } from "@/lib/browser";

const STAGEHAND_SERVER_URL = process.env.NODE_ENV === "development"
    ? "http://localhost:3001"
    : "https://stagehand.thebrowserarena.com";

const convexBackend = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export type SdkAgentType = "claude-code" | "codex";
export type McpType = "playwright" | "chrome-devtools";

const SDK_AGENT_MODELS: Record<SdkAgentType, string> = {
    "claude-code": "anthropic/claude-sonnet-4-6",
    "codex": "openai/gpt-5.4",
};

const config = {
    browser: {
        headless: {
            active: false
        }
    }
};

function isMcpType(value: unknown): value is McpType {
    return value === "playwright" || value === "chrome-devtools";
}

export async function handleSdkAgentRoute(request: NextRequest, agentType: SdkAgentType) {
    try {
        const body = await request.json();
        const {
            instruction,
            sessionId: existingSessionId,
            mcpType: requestedMcpType,
            agentName: requestedAgentName,
            sdkClient: requestedSdkClient,
        } = body as {
            instruction?: string;
            sessionId?: string;
            mcpType?: McpType;
            agentName?: "playwright-mcp" | "chrome-devtools-mcp";
            sdkClient?: "claude-code" | "codex";
        };

        if (!instruction || typeof instruction !== "string" || !instruction.trim()) {
            return badRequest("Field 'instruction' is required");
        }

        const validationResult = validateInstruction(instruction);
        if (!validationResult.isValid) {
            logValidationFailure(instruction, validationResult, undefined, `${agentType}-route`);
            return badRequest(validationResult.error || "Invalid instruction");
        }

        const mcpType = isMcpType(requestedMcpType) ? requestedMcpType : "playwright";

        const token = await getToken();
        if (!token) {
            return unauthorized();
        }

        if (!process.env.ANCHOR_API_KEY) {
            return serverMisconfigured("Missing ANCHOR_API_KEY", { provider: "anchor" });
        }

        const agentServerApiKey = process.env.AGENT_SERVER_API_KEY;
        if (!agentServerApiKey) {
            return serverMisconfigured("AGENT_SERVER_API_KEY is not configured", { provider: agentType });
        }

        const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
        convex.setAuth(token);

        const user = await convex.query(api.auth.getCurrentUser, {});
        if (!user) {
            return unauthorized();
        }
        const userId = user._id;

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

        let browserSession: { browserSessionId: string; cdpUrl: string; liveViewUrl: string };
        try {
            browserSession = await createBrowserSession(browserProfileConfig);
        } catch (e) {
            console.error(`Failed to create browser session for ${agentType}:`, e);
            return NextResponse.json({ error: "Failed to create browser session" }, { status: 500 });
        }
        const { browserSessionId, cdpUrl, liveViewUrl } = browserSession;

        const model = SDK_AGENT_MODELS[agentType];
        let dbSessionId: string;
        let agentId: string | undefined;

        if (existingSessionId) {
            const session = await convex.query(api.queries.verifySessionOwnership, {
                sessionId: existingSessionId,
            });

            if (!session) {
                await deleteBrowserSession(browserSessionId).catch(() => {});
                return NextResponse.json(
                    { error: "Unauthorized: You can only add agents to your own sessions" },
                    { status: 403 }
                );
            }

            const agentDisplayName = (requestedAgentName === "playwright-mcp" || requestedAgentName === "chrome-devtools-mcp")
                ? requestedAgentName
                : agentType;
            const sdkClient = (requestedAgentName === "playwright-mcp" || requestedAgentName === "chrome-devtools-mcp")
                && requestedSdkClient && (requestedSdkClient === "claude-code" || requestedSdkClient === "codex")
                ? requestedSdkClient
                : undefined;
            agentId = await convex.mutation(api.mutations.createAgent, {
                sessionId: existingSessionId,
                name: agentDisplayName,
                model,
                sdkClient,
                browser: {
                    sessionId: browserSessionId,
                    url: liveViewUrl,
                },
            }) as string;
            dbSessionId = existingSessionId;
        } else {
            const agentDisplayName = (requestedAgentName === "playwright-mcp" || requestedAgentName === "chrome-devtools-mcp")
                ? requestedAgentName
                : agentType;
            const sdkClient = (requestedAgentName === "playwright-mcp" || requestedAgentName === "chrome-devtools-mcp")
                && requestedSdkClient && (requestedSdkClient === "claude-code" || requestedSdkClient === "codex")
                ? requestedSdkClient
                : undefined;
            const result = await convex.mutation(api.mutations.createSession, {
                instruction,
                browserData: {
                    sessionId: browserSessionId,
                    url: liveViewUrl,
                },
                agentName: agentDisplayName,
                model,
                sdkClient,
            });
            dbSessionId = result.sessionId;
            agentId = result.agentId! as string;
        }

        if (!agentId) {
            await deleteBrowserSession(browserSessionId).catch(() => {});
            return NextResponse.json({ error: "Failed to create agent" }, { status: 500 });
        }

        after(async () => {
            try {
                const resp = await fetch(`${STAGEHAND_SERVER_URL}/agent/${agentType}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${agentServerApiKey}`,
                    },
                    body: JSON.stringify({
                        sessionId: dbSessionId,
                        instruction,
                        cdpUrl,
                        liveViewUrl,
                        agentId,
                        mcpType,
                    }),
                });

                if (!resp.ok) {
                    await convexBackend.mutation(api.mutations.updateAgentStatusFromBackend, {
                        agentId,
                        status: "failed",
                    });
                }
            } catch {
                try {
                    await convexBackend.mutation(api.mutations.updateAgentStatusFromBackend, {
                        agentId,
                        status: "failed",
                    });
                } catch { }
            }
        });

        return NextResponse.json({
            session: {
                id: dbSessionId,
            },
            agentId,
            liveViewUrl,
        });
    } catch (error) {
        console.error(`❌ Error in ${agentType} POST handler:`, error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
