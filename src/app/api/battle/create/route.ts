import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { getToken } from "@/lib/auth/server";
import { badRequest, unauthorized } from "@/lib/http-errors";
import { validateInstruction, logValidationFailure } from "@/lib/instruction-validation";
import { hasSameFramework } from "@/lib/battle/framework";
import { BrowserSession, createBrowserSession } from "@/lib/browser";

// Python agent server URL
const AGENT_SERVER_URL = process.env.AGENT_SERVER_URL || "http://localhost:8080";

interface AgentConfig {
    type: string;
    model?: string;
}

export async function POST(request: NextRequest) {
    try {
        console.log("[api/battle/create] POST request received");

        const { instruction } = await request.json() as {
            instruction: string;
        };

        // Validate instruction
        if (!instruction || typeof instruction !== 'string' || !instruction.trim()) {
            return badRequest("Field 'instruction' is required");
        }

        const validationResult = validateInstruction(instruction);
        if (!validationResult.isValid) {
            logValidationFailure(instruction, validationResult, undefined, "battle-create");
            return badRequest(validationResult.error || "Invalid instruction");
        }

        // Get user token for auth
        const token = await getToken();
        console.log("[api/battle/create] Token fetched:", !!token);

        if (!token) {
            return unauthorized();
        }

        // Create Convex client
        const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
        convex.setAuth(token);

        // Get current user
        const user = await convex.query(api.auth.getCurrentUser, {});
        if (!user) {
            return unauthorized();
        }
        const userId = user._id;
        console.log("[api/battle/create] User ID:", userId);

        // Find matching agents
        let matchedAgents;
        try {
            matchedAgents = await convex.query(api.battles.findMatchingAgents, {});
            console.log("[api/battle/create] Matchmaking complete");
        } catch (error) {
            console.error("[api/battle/create] Matchmaking error:", error);
            return NextResponse.json(
                {
                    error: "Matchmaking failed",
                    message: error instanceof Error ? error.message : String(error)
                },
                { status: 500 }
            );
        }

        const { agentA, agentB } = matchedAgents;
        console.log("[api/battle/create] Matched agents:", agentA.type, "vs", agentB.type);

        // Detect if same framework
        const sameFramework = hasSameFramework(agentA.type, agentB.type);
        console.log("[api/battle/create] Same framework:", sameFramework);

        // Create browser profile configuration
        const browserConfig = {
            browser: {
                profile: {
                    name: `profile-${userId}`,
                    persist: true
                }
            }
        };

        // Determine if we need browser sessions
        const needsBrowserSessions = agentA.type === "browser-use" || agentB.type === "browser-use";

        // Create session in Convex and browser sessions in parallel
        const parallelPromises: Promise<{ sessionId: string } | BrowserSession>[] = [
            convex.mutation(api.mutations.createSession, {
                instruction,
                isPrivate: false,
            })
        ];

        // Create browser sessions if needed
        if (needsBrowserSessions) {
            if (agentA.type === "browser-use") {
                parallelPromises.push(createBrowserSession(browserConfig));
            }
            if (agentB.type === "browser-use") {
                parallelPromises.push(createBrowserSession(browserConfig));
            }
        }

        const parallelResults = await Promise.all(parallelPromises);
        const { sessionId: dbSessionId } = parallelResults[0] as { sessionId: string };
        const browserSessions = needsBrowserSessions
            ? parallelResults.slice(1) as BrowserSession[]
            : [];

        console.log("[api/battle/create] Session created:", dbSessionId, "browser sessions:", browserSessions.length);

        // Launch both agents in parallel
        const agentConfigs: Array<{ agent: AgentConfig; browserSession?: BrowserSession }> = [];

        let browserSessionIndex = 0;
        if (agentA.type === "browser-use" && browserSessions.length > browserSessionIndex) {
            agentConfigs.push({
                agent: { type: agentA.type, model: agentA.model },
                browserSession: browserSessions[browserSessionIndex++]
            });
        } else {
            agentConfigs.push({
                agent: { type: agentA.type, model: agentA.model }
            });
        }

        if (agentB.type === "browser-use" && browserSessions.length > browserSessionIndex) {
            agentConfigs.push({
                agent: { type: agentB.type, model: agentB.model },
                browserSession: browserSessions[browserSessionIndex++]
            });
        } else {
            agentConfigs.push({
                agent: { type: agentB.type, model: agentB.model }
            });
        }

        // Launch agents
        const agentPromises = agentConfigs.map(async ({ agent, browserSession }) => {
            try {
                let endpoint: string;
                let payload: any;
                let isLocalEndpoint = false;

                switch (agent.type) {
                    case "browser-use":
                        endpoint = `${AGENT_SERVER_URL}/agent/browser-use`;
                        if (!browserSession) {
                            throw new Error("Browser session required for browser-use agent");
                        }
                        payload = {
                            sessionId: dbSessionId,
                            instruction,
                            providerModel: agent.model,
                            userId: userId,
                            browserSessionId: browserSession.browserSessionId,
                            cdpUrl: browserSession.cdpUrl,
                            liveViewUrl: browserSession.liveViewUrl,
                        };
                        break;
                    case "stagehand":
                        endpoint = `/api/agent/${agent.type}`;
                        isLocalEndpoint = true;
                        payload = {
                            instruction,
                            model: agent.model,
                            sessionId: dbSessionId,
                        };
                        break;
                    case "smooth":
                        endpoint = `/api/agent/smooth`;
                        isLocalEndpoint = true;
                        payload = {
                            task: instruction,
                            sessionId: dbSessionId,
                            model: agent.model,
                        };
                        break;
                    case "notte":
                        endpoint = `${AGENT_SERVER_URL}/agent/notte`;
                        payload = {
                            sessionId: dbSessionId,
                            instruction,
                            model: agent.model,
                        };
                        break;
                    default:
                        throw new Error(`Unknown agent type: ${agent.type}`);
                }

                const fetchUrl = isLocalEndpoint
                    ? `${process.env.NODE_ENV === 'production' ? 'https://www.thebrowserarena.com' : 'http://localhost:3000'}${endpoint}`
                    : endpoint;

                console.log("[api/battle/create] Launching agent:", agent.type, "endpoint:", fetchUrl);

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000);

                try {
                    const agentServerApiKey = process.env.AGENT_SERVER_API_KEY;
                    const headers: HeadersInit = {
                        "Content-Type": "application/json",
                    };

                    if (!isLocalEndpoint && agentServerApiKey) {
                        headers["Authorization"] = `Bearer ${agentServerApiKey}`;
                    }

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
                        const text = await response.text();
                        return Promise.reject(new Error(text || `Failed with status ${response.status}`));
                    }

                    const agentData = await response.json();
                    console.log("[api/battle/create] Agent launched:", agent.type, "agentId:", agentData?.agentId);

                    return {
                        type: agent.type,
                        agentId: agentData.agentId,
                        success: true
                    };
                } catch (fetchError: any) {
                    clearTimeout(timeoutId);
                    console.error("[api/battle/create] Agent fetch error:", agent.type, fetchError);
                    throw fetchError;
                }
            } catch (error) {
                console.error("[api/battle/create] Agent failed:", agent.type, error);
                return {
                    type: agent.type,
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                };
            }
        });

        const results = await Promise.all(agentPromises);
        const [agentAResult, agentBResult] = results;

        console.log("[api/battle/create] Agent results:", results);

        // Check if both agents launched successfully
        if (!agentAResult.success || !agentBResult.success) {
            return NextResponse.json(
                {
                    error: "Failed to launch one or both agents",
                    details: results
                },
                { status: 500 }
            );
        }

        // Create battle record
        const battleResult = await convex.mutation(api.battles.createBattle, {
            instruction,
            agentAId: agentAResult.agentId,
            agentBId: agentBResult.agentId,
            sameFramework,
        });

        console.log("[api/battle/create] Battle created:", battleResult.battleId);

        // Return battle info
        return NextResponse.json({
            battleId: battleResult.battleId,
            sessionId: dbSessionId,
            sameFramework,
            agents: {
                agentA: { type: agentA.type, agentId: agentAResult.agentId },
                agentB: { type: agentB.type, agentId: agentBResult.agentId }
            }
        });
    } catch (error) {
        console.error("[api/battle/create] Unhandled error:", error);
        return NextResponse.json(
            {
                error: "Internal server error",
                message: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}
