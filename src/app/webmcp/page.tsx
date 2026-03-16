"use client";

import { useEffect, useState } from "react";
import { useConvexAuth } from "convex/react";
import Script from "next/script";
import { SidebarInset } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";

const TOOLS = [
    {
        name: "list_available_agents",
        description: "Returns all available agent types, their supported models, and whether they support BYOK.",
        inputSchema: { type: "object", properties: {} },
    },
    {
        name: "create_session",
        description: "Create a new session with one or more agents to complete the given instruction.",
        inputSchema: {
            type: "object",
            properties: {
                instruction: { type: "string", description: "The task for agents to complete" },
                agents: {
                    type: "array",
                    description: "Agents to launch (max 4)",
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
            properties: { sessionId: { type: "string" } },
            required: ["sessionId"],
        },
    },
    {
        name: "get_agent_result",
        description: "Get a single agent's answer, logs, usage, cost, and duration.",
        inputSchema: {
            type: "object",
            properties: { agentId: { type: "string" } },
            required: ["agentId"],
        },
    },
    {
        name: "wait_for_completion",
        description: "Wait for all agents to complete. Polls every 2s, max 120s.",
        inputSchema: {
            type: "object",
            properties: {
                sessionId: { type: "string" },
                timeout: { type: "number", description: "Max wait in seconds (default: 120)" },
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
    let res: Response;
    switch (name) {
        case "list_available_agents":
            res = await fetch("/api/v1/agents");
            break;
        case "create_session":
            res = await fetch("/api/v1/sessions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(args),
            });
            break;
        case "get_session":
            res = await fetch(`/api/v1/sessions/${args.sessionId}`);
            break;
        case "get_agent_result":
            res = await fetch(`/api/v1/agents/${args.agentId}`);
            break;
        case "wait_for_completion": {
            const qs = args.timeout ? `?timeout=${args.timeout}` : "";
            res = await fetch(`/api/v1/sessions/${args.sessionId}/wait${qs}`);
            break;
        }
        case "list_sessions":
            res = await fetch("/api/v1/sessions");
            break;
        default:
            return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }
    return { content: [{ type: "text", text: JSON.stringify(await res.json()) }] };
}

export default function WebMcpPage() {
    const { isAuthenticated, isLoading } = useConvexAuth();
    const [widgetReady, setWidgetReady] = useState(false);
    const [toolsRegistered, setToolsRegistered] = useState(false);

    useEffect(() => {
        if (!widgetReady || !isAuthenticated) return;

        const W = (window as any).WebMCP;
        if (!W) return;

        const mcp = new W({
            color: "transparent",
            position: "bottom-right",
            size: "0px",
            padding: "0px",
        });

        for (const tool of TOOLS) {
            mcp.registerTool(
                tool.name,
                tool.description,
                tool.inputSchema,
                (args: any) => handleToolCall(tool.name, args),
            );
        }

        setToolsRegistered(true);

        // Hide the default widget — we have our own connect UI
        const hideWidget = () => {
            const el = document.querySelector("[data-webmcp-widget]") as HTMLElement;
            if (el) {
                el.style.display = "none";
            }
        };
        hideWidget();
        // Re-check in case it renders after
        const observer = new MutationObserver(hideWidget);
        observer.observe(document.body, { childList: true, subtree: true });

        return () => {
            observer.disconnect();
            const el = document.querySelector("[data-webmcp-widget]") as HTMLElement;
            if (el) el.remove();
        };
    }, [widgetReady, isAuthenticated]);

    // Custom connect handler that programmatically triggers the widget connect
    const handleConnect = () => {
        const el = document.querySelector("[data-webmcp-widget]") as HTMLElement;
        if (el) {
            el.style.display = "flex";
            const trigger = el.querySelector(".webmcp-trigger") as HTMLElement;
            if (trigger) trigger.click();
        }
    };

    if (isLoading) {
        return (
            <SidebarInset className="flex flex-1 flex-col overflow-hidden bg-background text-foreground">
                <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-border border-t-foreground" />
                </div>
            </SidebarInset>
        );
    }

    if (!isAuthenticated) {
        return (
            <SidebarInset className="flex flex-1 flex-col overflow-hidden bg-background text-foreground">
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center space-y-4 max-w-md px-6">
                        <h1 className="text-2xl font-bold">WebMCP</h1>
                        <p className="text-muted-foreground">
                            Sign in to connect external AI agents to The Browser Arena.
                        </p>
                    </div>
                </div>
            </SidebarInset>
        );
    }

    return (
        <SidebarInset className="flex flex-1 flex-col overflow-hidden bg-background text-foreground">
            <Script
                src="/js/webmcp.js"
                strategy="afterInteractive"
                onReady={() => setWidgetReady(true)}
            />

            <div className="flex-1 overflow-y-auto">
                <div className="container py-8 mx-auto max-w-6xl">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold tracking-tight">WebMCP</h1>
                        <p className="text-muted-foreground mt-2">
                            Connect external AI agents to control The Browser Arena via the{" "}
                            <a href="https://github.com/jasonjmcghee/WebMCP" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground transition-colors">
                                WebMCP
                            </a>{" "}
                            protocol.
                        </p>
                    </div>

                    <div className="space-y-16">
                        {/* Status + Connect */}
                        <div className="grid grid-cols-12 gap-8">
                            <div className="col-span-4 space-y-2">
                                <h2 className="text-xl font-semibold">Connection</h2>
                                <p className="text-sm text-muted-foreground">
                                    Status of the WebMCP bridge and tools registration.
                                </p>
                            </div>
                            <div className="col-span-1 flex justify-center">
                                <div className="w-px h-full border-l border-dashed border-border" />
                            </div>
                            <div className="col-span-7 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${toolsRegistered ? "bg-green-500" : "bg-yellow-500 animate-pulse"}`} />
                                    <span className="text-sm">
                                        {toolsRegistered
                                            ? `${TOOLS.length} tools registered`
                                            : "Loading WebMCP widget..."}
                                    </span>
                                </div>
                                {toolsRegistered && (
                                    <Button variant="outline" size="sm" onClick={handleConnect}>
                                        Open connection widget
                                    </Button>
                                )}
                            </div>
                        </div>

                        <Separator />

                        {/* How to connect */}
                        <div className="grid grid-cols-12 gap-8">
                            <div className="col-span-4 space-y-2">
                                <h2 className="text-xl font-semibold">How to connect</h2>
                                <p className="text-sm text-muted-foreground">
                                    Set up the WebMCP bridge in your AI assistant, then paste a token to connect.
                                </p>
                            </div>
                            <div className="col-span-1 flex justify-center">
                                <div className="w-px h-full border-l border-dashed border-border" />
                            </div>
                            <div className="col-span-7 space-y-4">
                                <div className="space-y-3">
                                    <div className="flex items-start gap-3">
                                        <span className="shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">1</span>
                                        <div className="space-y-1.5">
                                            <p className="text-sm">Install the WebMCP bridge in your MCP client</p>
                                            <div className="flex items-center gap-2">
                                                <code className="px-3 py-1.5 bg-muted rounded text-xs font-mono">
                                                    npx -y @jason.today/webmcp@latest --config claude
                                                </code>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 w-7 p-0"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText("npx -y @jason.today/webmcp@latest --config claude");
                                                        toast.success("Copied");
                                                    }}
                                                >
                                                    <Copy className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">2</span>
                                        <p className="text-sm">Ask your AI assistant: <em className="text-muted-foreground">&quot;Generate a WebMCP token&quot;</em></p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">3</span>
                                        <p className="text-sm">Click <strong>Open connection widget</strong> above and paste the token</p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">4</span>
                                        <div className="space-y-1">
                                            <p className="text-sm">Try a prompt:</p>
                                            <p className="text-sm text-muted-foreground italic">
                                                &quot;Run playwright-mcp and chrome-devtools-mcp on &apos;find the top GitHub trending repo&apos; and compare results&quot;
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* Registered tools */}
                        <div className="grid grid-cols-12 gap-8">
                            <div className="col-span-4 space-y-2">
                                <h2 className="text-xl font-semibold">Registered tools</h2>
                                <p className="text-sm text-muted-foreground">
                                    Tools exposed to connected AI agents. These wrap the{" "}
                                    <a href="/api/docs" target="_blank" className="underline hover:text-foreground transition-colors">REST API</a>.
                                </p>
                            </div>
                            <div className="col-span-1 flex justify-center">
                                <div className="w-px h-full border-l border-dashed border-border" />
                            </div>
                            <div className="col-span-7 space-y-2">
                                {TOOLS.map((tool) => (
                                    <div key={tool.name} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                                        <code className="text-sm font-mono font-medium shrink-0 pt-0.5">{tool.name}</code>
                                        <p className="text-xs text-muted-foreground leading-relaxed">{tool.description}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </SidebarInset>
    );
}
