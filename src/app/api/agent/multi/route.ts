import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { getToken } from "@/lib/auth/server";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Python agent server URL
const AGENT_SERVER_URL = process.env.AGENT_SERVER_URL || "http://localhost:8080";

interface AgentConfig {
    agent: "stagehand" | "smooth" | "skyvern" | "browser-use";
    model: string;
}

export async function POST(request: NextRequest) {
    try {
        const { instruction, agents, smoothApiKey, isPrivate } = await request.json() as {
            instruction: string;
            agents: AgentConfig[];
            smoothApiKey?: string;
            isPrivate?: boolean;
        };

        if (!agents || agents.length === 0) {
            return NextResponse.json({ error: "At least one agent must be selected" }, { status: 400 });
        }

        if (agents.length > 4) {
            return NextResponse.json({ error: "Maximum 4 agents allowed" }, { status: 400 });
        }

        // Get user token for auth
        const token = await getToken();
        console.log("Auth token:", token ? "Present" : "Missing");

        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        convex.setAuth(token);

        // Create session in Convex first
        const { sessionId: dbSessionId } = await convex.mutation(api.mutations.createSession, {
            instruction,
            isPrivate: isPrivate ?? false,
        });

        console.log(`✅ Created Convex session: ${dbSessionId}`);

        // Launch all agents in parallel
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
                        };
                        break;
                    case "skyvern":
                        endpoint = `${AGENT_SERVER_URL}/agent/skyvern`;
                        payload = {
                            sessionId: dbSessionId,
                            instruction,
                            providerModel: agentConfig.model
                        };
                        break;
                    case "browser-use":
                        endpoint = `${AGENT_SERVER_URL}/agent/browser-use`;
                        payload = {
                            sessionId: dbSessionId,
                            instruction,
                            providerModel: agentConfig.model
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
                        };
                        break;
                    default:
                        throw new Error(`Unknown agent: ${agentConfig.agent}`);
                }

                // For local Next.js endpoints, we need to use absolute URL or call directly
                const fetchUrl = isLocalEndpoint
                    ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${endpoint}`
                    : endpoint;

                const response = await fetch(fetchUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        // Forward the authorization cookie for local endpoints
                        ...(isLocalEndpoint && request.headers.get('cookie')
                            ? { 'cookie': request.headers.get('cookie')! }
                            : {}
                        ),
                    },
                    body: JSON.stringify(payload),
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`❌ Error launching ${agentConfig.agent}:`, errorText);
                    throw new Error(`Failed to launch ${agentConfig.agent}: ${errorText}`);
                }

                const agentData = await response.json();
                console.log(`✅ ${agentConfig.agent} agent started:`, agentData);

                return {
                    agent: agentConfig.agent,
                    agentId: agentData.agentId,
                    success: true
                };
            } catch (error) {
                console.error(`❌ Error launching ${agentConfig.agent}:`, error);
                return {
                    agent: agentConfig.agent,
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                };
            }
        });

        // Wait for all agents to launch
        const results = await Promise.all(agentPromises);

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

