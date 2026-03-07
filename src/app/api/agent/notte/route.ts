import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";

import { api } from "../../../../../convex/_generated/api";
import { getToken } from "@/lib/auth/server";
import { badRequest, mapProviderError, serverMisconfigured, unauthorized } from "@/lib/http-errors";
import { validateInstruction, logValidationFailure } from "@/lib/instruction-validation";
import { createBrowserSession } from "@/lib/browser";

const AGENT_SERVER_URL = process.env.AGENT_SERVER_URL || "http://localhost:8080";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            instruction,
            isPrivate,
            model,
        } = body as {
            instruction?: string;
            isPrivate?: boolean;
            model?: string;
        };

        if (!instruction || typeof instruction !== "string" || !instruction.trim()) {
            return badRequest("Field 'instruction' is required");
        }

        const validationResult = validateInstruction(instruction);
        if (!validationResult.isValid) {
            logValidationFailure(instruction, validationResult, undefined, "notte-route");
            return badRequest(validationResult.error || "Invalid instruction");
        }

        const token = await getToken();
        if (!token) {
            return unauthorized();
        }

        const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
        convex.setAuth(token);

        const user = await convex.query(api.auth.getCurrentUser, {});
        if (!user) {
            return unauthorized();
        }

        // Create Convex session and Browserbase session in parallel
        const [sessionResult, browserSession] = await Promise.all([
            convex.mutation(api.mutations.createSession, {
                instruction,
                isPrivate: isPrivate ?? false,
            }),
            createBrowserSession(),
        ]);

        const dbSessionId = sessionResult.sessionId;

        const agentServerApiKey = process.env.AGENT_SERVER_API_KEY;
        if (!agentServerApiKey) {
            return serverMisconfigured("AGENT_SERVER_API_KEY is not configured", { provider: "notte" });
        }

        const payload: Record<string, unknown> = {
            sessionId: dbSessionId,
            instruction,
            model: model || undefined,
            cdpUrl: browserSession.cdpUrl,
            browserSessionId: browserSession.browserSessionId,
            liveViewUrl: browserSession.liveViewUrl,
        };

        const agentResponse = await fetch(`${AGENT_SERVER_URL}/agent/notte`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${agentServerApiKey}`,
            },
            body: JSON.stringify(payload),
        });

        if (!agentResponse.ok) {
            return await mapProviderError(agentResponse, "notte");
        }

        const agentData = await agentResponse.json();

        return NextResponse.json({
            session: {
                id: dbSessionId,
            },
            agentId: agentData.agentId,
            liveViewUrl: browserSession.liveViewUrl,
            browserSessionId: browserSession.browserSessionId,
        });
    } catch (error) {
        console.error("❌ Error in Notte POST handler:", error);
        return NextResponse.json(
            {
                error: "Internal server error",
                message: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}


