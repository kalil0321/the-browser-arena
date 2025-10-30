import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { getToken } from "@/lib/auth/server";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Python agent server URL
const AGENT_SERVER_URL = process.env.AGENT_SERVER_URL || "http://localhost:8080";

export async function POST(request: NextRequest) {
    try {
        const { instruction, model } = await request.json();

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
            // Don't provide browserData yet - Python server will create it
        });

        console.log(`✅ Created Convex session: ${dbSessionId}`);

        // Call Python agent server
        const agentResponse = await fetch(`${AGENT_SERVER_URL}/agent/skyvern`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                sessionId: dbSessionId,
                instruction,
                providerModel: model || "",
            }),
        });

        if (!agentResponse.ok) {
            const errorText = await agentResponse.text();
            console.error(`❌ Agent server error: ${errorText}`);
            return NextResponse.json(
                { error: `Agent server error: ${errorText}` },
                { status: agentResponse.status }
            );
        }

        const agentData = await agentResponse.json();
        console.log(`✅ Skyvern agent started:`, agentData);

        // Return session info with live URL
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

