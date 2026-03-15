"use client";

import { useEffect, useState } from "react";
import { useConvexAuth } from "convex/react";
import Script from "next/script";
import { SidebarInset } from "@/components/ui/sidebar";

const TOOLS = [
    {
        name: "list_available_agents",
        description: "Returns all available agent types, their supported models, and whether they support BYOK (Bring Your Own Key).",
        inputSchema: { type: "object", properties: {} },
    },
    {
        name: "create_session",
        description: "Create a new browser arena session with one or more agents. Launches agents to complete the given instruction. Returns sessionId and agent launch results.",
        inputSchema: {
            type: "object",
            properties: {
                instruction: { type: "string", description: "The task for agents to complete" },
                agents: {
                    type: "array",
                    description: "Agents to launch (max 4). Each needs an 'agent' field and optional 'model'.",
                    items: {
                        type: "object",
                        properties: {
                            agent: { type: "string", description: "Agent type: playwright-mcp, chrome-devtools-mcp, agent-browser-mcp, stagehand, browser-use, notte, etc." },
                            model: { type: "string", description: "For MCP agents: claude-code or codex. For others: provider/model string." },
                        },
                        required: ["agent"],
                    },
                },
                isPrivate: { type: "boolean", description: "Whether the session is private (default: false)" },
            },
            required: ["instruction", "agents"],
        },
    },
    {
        name: "get_session",
        description: "Get session details including all agents and their current status/results.",
        inputSchema: {
            type: "object",
            properties: {
                sessionId: { type: "string", description: "The session ID to retrieve" },
            },
            required: ["sessionId"],
        },
    },
    {
        name: "get_agent_result",
        description: "Get a single agent's details including its answer, logs, usage, cost, and duration.",
        inputSchema: {
            type: "object",
            properties: {
                agentId: { type: "string", description: "The agent ID to retrieve" },
            },
            required: ["agentId"],
        },
    },
    {
        name: "wait_for_completion",
        description: "Wait for all agents in a session to complete. Polls every 2 seconds, max 120 seconds. Returns the full session with results when done.",
        inputSchema: {
            type: "object",
            properties: {
                sessionId: { type: "string", description: "The session ID to wait on" },
                timeout: { type: "number", description: "Max wait in seconds (default: 120, max: 120)" },
            },
            required: ["sessionId"],
        },
    },
    {
        name: "list_sessions",
        description: "List the 50 most recent sessions for the authenticated user.",
        inputSchema: { type: "object", properties: {} },
    },
];

async function handleToolCall(name: string, args: any): Promise<any> {
    switch (name) {
        case "list_available_agents": {
            const res = await fetch("/api/v1/agents");
            return { content: [{ type: "text", text: JSON.stringify(await res.json()) }] };
        }
        case "create_session": {
            const res = await fetch("/api/v1/sessions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(args),
            });
            return { content: [{ type: "text", text: JSON.stringify(await res.json()) }] };
        }
        case "get_session": {
            const res = await fetch(`/api/v1/sessions/${args.sessionId}`);
            return { content: [{ type: "text", text: JSON.stringify(await res.json()) }] };
        }
        case "get_agent_result": {
            const res = await fetch(`/api/v1/agents/${args.agentId}`);
            return { content: [{ type: "text", text: JSON.stringify(await res.json()) }] };
        }
        case "wait_for_completion": {
            const qs = args.timeout ? `?timeout=${args.timeout}` : "";
            const res = await fetch(`/api/v1/sessions/${args.sessionId}/wait${qs}`);
            return { content: [{ type: "text", text: JSON.stringify(await res.json()) }] };
        }
        case "list_sessions": {
            const res = await fetch("/api/v1/sessions");
            return { content: [{ type: "text", text: JSON.stringify(await res.json()) }] };
        }
        default:
            return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }
}

export default function WebMcpPage() {
    const { isAuthenticated, isLoading } = useConvexAuth();
    const [widgetReady, setWidgetReady] = useState(false);
    const [toolsRegistered, setToolsRegistered] = useState(false);

    useEffect(() => {
        if (!widgetReady || !isAuthenticated) return;

        const W = (window as any).WebMCP;
        if (!W) return;

        // Initialize WebMCP widget
        const mcp = new W({
            color: "#10b981",
            position: "bottom-right",
            size: "36px",
            padding: "20px",
        });

        // Register all tools
        for (const tool of TOOLS) {
            mcp.registerTool(
                tool.name,
                tool.description,
                tool.inputSchema,
                (args: any) => handleToolCall(tool.name, args),
            );
        }

        setToolsRegistered(true);

        return () => {
            // Cleanup widget on unmount
            const el = document.querySelector("[data-webmcp-widget]");
            if (el) el.remove();
        };
    }, [widgetReady, isAuthenticated]);

    if (isLoading) {
        return (
            <SidebarInset>
                <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-border border-t-foreground" />
                </div>
            </SidebarInset>
        );
    }

    if (!isAuthenticated) {
        return (
            <SidebarInset>
                <div className="flex items-center justify-center h-full">
                    <div className="text-center space-y-4 max-w-md px-6">
                        <h1 className="text-2xl font-bold">WebMCP</h1>
                        <p className="text-muted-foreground">
                            Sign in to connect external AI agents to The Browser Arena via WebMCP.
                        </p>
                    </div>
                </div>
            </SidebarInset>
        );
    }

    return (
        <SidebarInset>
            <Script
                src="/js/webmcp.js"
                strategy="afterInteractive"
                onReady={() => setWidgetReady(true)}
            />

            <div className="p-6 max-w-3xl mx-auto space-y-8">
                <div>
                    <h1 className="text-2xl font-bold">WebMCP</h1>
                    <p className="text-muted-foreground mt-2">
                        Connect external AI agents (Claude Desktop, Claude Code) to control The Browser Arena
                        using the <a href="https://github.com/jasonjmcghee/WebMCP" target="_blank" rel="noopener noreferrer" className="underline">WebMCP</a> protocol.
                    </p>
                </div>

                {/* Status */}
                <div className="rounded-lg border bg-card p-4 space-y-3">
                    <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Status</h2>
                    <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${toolsRegistered ? "bg-green-500" : "bg-yellow-500 animate-pulse"}`} />
                        <span className="text-sm">
                            {toolsRegistered
                                ? `${TOOLS.length} tools registered — click the green widget in the bottom-right to connect`
                                : "Loading WebMCP widget..."}
                        </span>
                    </div>
                </div>

                {/* How to connect */}
                <div className="rounded-lg border bg-card p-4 space-y-3">
                    <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">How to Connect</h2>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                        <li>
                            Install the WebMCP bridge in your MCP client:
                            <code className="ml-2 px-2 py-0.5 bg-muted rounded text-xs font-mono">
                                npx -y @jason.today/webmcp@latest --config claude
                            </code>
                        </li>
                        <li>Ask your AI assistant: <em>&quot;Generate a WebMCP token&quot;</em></li>
                        <li>Click the green widget (bottom-right) and paste the token</li>
                        <li>
                            Try: <em>&quot;List the available browser agents&quot;</em> or{" "}
                            <em>&quot;Run playwright-mcp and chrome-devtools-mcp on &apos;find the top GitHub trending repo&apos; and compare results&quot;</em>
                        </li>
                    </ol>
                </div>

                {/* Registered tools */}
                <div className="rounded-lg border bg-card p-4 space-y-3">
                    <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Registered Tools</h2>
                    <div className="space-y-2">
                        {TOOLS.map((tool) => (
                            <div key={tool.name} className="rounded border bg-muted/30 p-3">
                                <div className="flex items-center gap-2">
                                    <code className="text-sm font-mono font-medium">{tool.name}</code>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{tool.description}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* API docs link */}
                <div className="text-sm text-muted-foreground">
                    These tools wrap the <a href="/api/docs" target="_blank" className="underline">REST API</a>.
                    You can also use the API directly with an{" "}
                    <a href="/settings" className="underline">API key</a>.
                </div>
            </div>
        </SidebarInset>
    );
}
