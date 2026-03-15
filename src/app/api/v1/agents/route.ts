import { NextResponse } from "next/server";
import { AGENT_LABELS, MODEL_OPTIONS } from "@/components/chat-input/types";

const AVAILABLE_AGENTS = [
    "stagehand",
    "browser-use",
    "browser-use-cloud",
    "notte",
    "playwright-mcp",
    "chrome-devtools-mcp",
    "agent-browser-mcp",
] as const;

const MCP_TYPES: Record<string, string | undefined> = {
    "playwright-mcp": "playwright",
    "chrome-devtools-mcp": "chrome-devtools",
    "agent-browser-mcp": "agent-browser",
};

export async function GET() {
    const agents = AVAILABLE_AGENTS.map((agent) => ({
        id: agent,
        label: AGENT_LABELS[agent] ?? agent,
        models: MODEL_OPTIONS[agent] ?? [],
        mcpType: MCP_TYPES[agent] ?? null,
        supportsByok: ["stagehand", "browser-use", "browser-use-cloud", "smooth", "notte"].includes(agent),
    }));

    return NextResponse.json({ data: agents });
}
