import { NextRequest } from "next/server";
import { handleSdkAgentRoute } from "@/lib/server/sdk-agent-route";

export async function POST(request: NextRequest) {
    return handleSdkAgentRoute(request, "codex");
}
