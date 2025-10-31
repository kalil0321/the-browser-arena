import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { getToken } from "@/lib/auth/server";

// Python agent server URL
const AGENT_SERVER_URL = process.env.AGENT_SERVER_URL || "http://localhost:8080";

export async function POST(request: NextRequest) {
    try {
        const { instruction, model } = await request.json();

        // Get user token for auth
        const token = await getToken();

        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Create Convex client per request for better isolation and set auth
        const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
        convex.setAuth(token);

        // Prepare Python server request data
        const providerModel = model || "";

        // Create session in Convex
        const { sessionId: dbSessionId } = await convex.mutation(api.mutations.createSession, {
            instruction,
        });

        // Call Python agent server immediately after session is created
        const agentResponse = await fetch(`${AGENT_SERVER_URL}/agent/skyvern`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                sessionId: dbSessionId,
                instruction,
                providerModel,
            }),
        });

        if (!agentResponse.ok) {
            const errorText = await agentResponse.text();
            return NextResponse.json(
                { error: `Agent server error: ${errorText}` },
                { status: agentResponse.status }
            );
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

