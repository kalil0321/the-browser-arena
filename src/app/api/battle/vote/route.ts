import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { getToken } from "@/lib/auth/server";
import { badRequest, unauthorized } from "@/lib/http-errors";
import { Id } from "../../../../../convex/_generated/dataModel";

export async function POST(request: NextRequest) {
    try {
        let body;
        try {
            body = await request.json();
        } catch (error) {
            console.error("[api/battle/vote] JSON parse error:", error);
            return badRequest("Invalid JSON in request body");
        }

        const { battleId, winnerId, voteType } = body as {
            battleId: string;
            winnerId?: string;
            voteType: "winner" | "tie" | "both-bad";
        };

        // Validate input
        if (!battleId || typeof battleId !== 'string') {
            console.error("[api/battle/vote] Invalid battleId:", battleId);
            return badRequest("Field 'battleId' is required");
        }
        if (!voteType || !["winner", "tie", "both-bad"].includes(voteType)) {
            console.error("[api/battle/vote] Invalid voteType:", voteType);
            return badRequest("Field 'voteType' must be 'winner', 'tie', or 'both-bad'");
        }
        if (voteType === "winner" && (!winnerId || typeof winnerId !== 'string')) {
            console.error("[api/battle/vote] Missing winnerId for winner vote type");
            return badRequest("Field 'winnerId' is required for 'winner' vote type");
        }

        // Get user token for auth
        const token = await getToken();
        if (!token) {
            return unauthorized();
        }

        // Create Convex client
        const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
        convex.setAuth(token);

        // Call comprehensive mutation that handles everything in one transaction
        const result = await convex.mutation(api.battles.submitBattleVote, {
            battleId: battleId as Id<"battles">,
            winnerId: winnerId ? winnerId as Id<"agents"> : undefined,
            voteType,
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error("[api/battle/vote] Unhandled error:", error);
        console.error("[api/battle/vote] Error stack:", error instanceof Error ? error.stack : "No stack trace");

        // Map common errors to appropriate HTTP status codes
        const errorMessage = error instanceof Error ? error.message : String(error);
        let status = 500;

        if (errorMessage.includes("Not authenticated") || errorMessage.includes("unauthorized")) {
            status = 401;
        } else if (errorMessage.includes("Not authorized") || errorMessage.includes("not authorized")) {
            status = 403;
        } else if (errorMessage.includes("not found") || errorMessage.includes("Not found")) {
            status = 404;
        } else if (errorMessage.includes("already been voted") || errorMessage.includes("already voted")) {
            status = 400;
        } else if (errorMessage.includes("required") || errorMessage.includes("Invalid")) {
            status = 400;
        }

        return NextResponse.json(
            {
                error: status === 500 ? "Internal server error" : errorMessage,
                message: errorMessage
            },
            { status }
        );
    }
}
