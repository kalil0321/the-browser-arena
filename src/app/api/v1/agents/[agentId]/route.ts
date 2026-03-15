import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";
import { authenticateRequest } from "@/lib/auth/api-auth";
import { Id } from "../../../../../../convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ agentId: string }> },
) {
    const auth = await authenticateRequest(request);
    if (!auth) {
        return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Invalid or missing authentication" } }, { status: 401 });
    }

    const { agentId } = await params;

    try {
        const agent = await convex.query(api.queries.getAgentById, {
            agentId: agentId as Id<"agents">,
        });

        if (!agent) {
            return NextResponse.json({ error: { code: "NOT_FOUND", message: "Agent not found" } }, { status: 404 });
        }

        return NextResponse.json({ data: agent });
    } catch {
        return NextResponse.json({ error: { code: "NOT_FOUND", message: "Agent not found" } }, { status: 404 });
    }
}
