"use client";

import { useEffect, useState } from "react";
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
    const [widgetReady, setWidgetReady] = useState(false);
    const [toolsRegistered, setToolsRegistered] = useState(false);

    useEffect(() => {
        if (!widgetReady) return;

        const W = (window as any).WebMCP;
        if (!W) return;

        const mcp = new W({
            color: "#10b981",
            position: "bottom-right",
            size: "44px",
            padding: "24px",
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

        // Restyle the widget to match the app's design. Returns true if widget was found.
        const styleWidget = (): boolean => {
            const el = document.querySelector("[data-webmcp-widget]") as HTMLElement;
            if (!el) return false;

            // Read computed CSS variable values for use in inline styles
            const root = document.documentElement;
            const cs = getComputedStyle(root);
            const cardBg = cs.getPropertyValue("--color-card").trim() || "#1c1c1c";
            const borderColor = cs.getPropertyValue("--color-border").trim() || "#333";
            const fgColor = cs.getPropertyValue("--color-foreground").trim() || "#fff";
            const mutedBg = cs.getPropertyValue("--color-muted").trim() || "#2a2a2a";
            const mutedFg = cs.getPropertyValue("--color-muted-foreground").trim() || "#999";
            const destructiveBg = cs.getPropertyValue("--color-destructive").trim() || "#dc2626";

            // Style the trigger button
            const trigger = el.querySelector(".webmcp-trigger") as HTMLElement;
            if (trigger) {
                Object.assign(trigger.style, {
                    width: "44px",
                    height: "44px",
                    borderRadius: "12px",
                    backgroundColor: "#10b981",
                    boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
                    transition: "transform 0.15s ease, box-shadow 0.15s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                });
                // Replace content with a plug icon using DOM methods
                trigger.textContent = "";
                const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                svg.setAttribute("width", "20");
                svg.setAttribute("height", "20");
                svg.setAttribute("viewBox", "0 0 24 24");
                svg.setAttribute("fill", "none");
                svg.setAttribute("stroke", "white");
                svg.setAttribute("stroke-width", "2");
                svg.setAttribute("stroke-linecap", "round");
                svg.setAttribute("stroke-linejoin", "round");
                const path1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
                path1.setAttribute("d", "M12 22v-5");
                const path2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
                path2.setAttribute("d", "M9 8V2");
                const path3 = document.createElementNS("http://www.w3.org/2000/svg", "path");
                path3.setAttribute("d", "M15 8V2");
                const path4 = document.createElementNS("http://www.w3.org/2000/svg", "path");
                path4.setAttribute("d", "M18 8H6a2 2 0 0 0-2 2v2c0 3.3 2.7 6 6 6h4c3.3 0 6-2.7 6-6v-2a2 2 0 0 0-2-2Z");
                svg.appendChild(path1);
                svg.appendChild(path2);
                svg.appendChild(path3);
                svg.appendChild(path4);
                trigger.appendChild(svg);

                trigger.onmouseenter = () => {
                    trigger.style.transform = "scale(1.08)";
                    trigger.style.boxShadow = "0 6px 16px rgba(16, 185, 129, 0.4)";
                };
                trigger.onmouseleave = () => {
                    trigger.style.transform = "scale(1)";
                    trigger.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.3)";
                };
            }

            // Style the content panel
            const content = el.querySelector(".webmcp-content") as HTMLElement;
            if (content) {
                Object.assign(content.style, {
                    backgroundColor: cardBg,
                    border: `1px solid ${borderColor}`,
                    borderRadius: "12px",
                    padding: "16px",
                    boxShadow: "0 8px 30px rgba(0, 0, 0, 0.3)",
                    width: "300px",
                    color: fgColor,
                    fontFamily: "var(--font-sans, system-ui, sans-serif)",
                });
            }

            // Style status bar
            const status = el.querySelector(".webmcp-status") as HTMLElement;
            if (status) {
                Object.assign(status.style, {
                    borderRadius: "8px",
                    fontSize: "12px",
                    padding: "8px 12px",
                    fontFamily: "var(--font-mono, monospace)",
                });
            }

            // Style token input
            const input = el.querySelector(".webmcp-token-input") as HTMLElement;
            if (input) {
                Object.assign(input.style, {
                    backgroundColor: mutedBg,
                    border: `1px solid ${borderColor}`,
                    borderRadius: "8px 0 0 8px",
                    color: fgColor,
                    padding: "8px 12px",
                    fontSize: "12px",
                    fontFamily: "var(--font-mono, monospace)",
                });
            }

            // Style connect button
            const connectBtn = el.querySelector(".webmcp-connect-btn") as HTMLElement;
            if (connectBtn) {
                Object.assign(connectBtn.style, {
                    backgroundColor: "#10b981",
                    borderRadius: "0 8px 8px 0",
                    padding: "8px 16px",
                    fontSize: "12px",
                    fontWeight: "500",
                    cursor: "pointer",
                    transition: "opacity 0.15s ease",
                });
                connectBtn.onmouseenter = () => { connectBtn.style.opacity = "0.85"; };
                connectBtn.onmouseleave = () => { connectBtn.style.opacity = "1"; };
            }

            // Style disconnect button
            const disconnectBtn = el.querySelector(".webmcp-disconnect-btn") as HTMLElement;
            if (disconnectBtn) {
                Object.assign(disconnectBtn.style, {
                    backgroundColor: destructiveBg,
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: "500",
                });
            }

            // Style registered items panel
            const items = el.querySelector(".webmcp-registered-items") as HTMLElement;
            if (items) {
                Object.assign(items.style, {
                    border: `1px solid ${borderColor}`,
                    borderRadius: "8px",
                    backgroundColor: mutedBg,
                    fontSize: "12px",
                });
            }

            // Style close button
            const closeBtn = el.querySelector(".webmcp-close") as HTMLElement;
            if (closeBtn) {
                Object.assign(closeBtn.style, {
                    color: mutedFg,
                    fontSize: "18px",
                });
            }

            return true;
        };

        // Style once, then watch for the widget to appear if it hasn't yet
        if (!styleWidget()) {
            const observer = new MutationObserver(() => {
                if (styleWidget()) observer.disconnect();
            });
            observer.observe(document.body, { childList: true, subtree: true });
            return () => {
                observer.disconnect();
                const el = document.querySelector("[data-webmcp-widget]") as HTMLElement;
                if (el) el.remove();
            };
        }

        return () => {
            const el = document.querySelector("[data-webmcp-widget]") as HTMLElement;
            if (el) el.remove();
        };
    }, [widgetReady]);

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
                                            ? `${TOOLS.length} tools registered — click the green button in the bottom-right to connect`
                                            : "Loading WebMCP widget..."}
                                    </span>
                                </div>
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
