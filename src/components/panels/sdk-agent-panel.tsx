"use client";

interface SdkAgentPanelProps {
    agent: {
        name: string;
        result?: Record<string, unknown>;
    };
}

export function SdkAgentPanel({ agent }: SdkAgentPanelProps) {
    const result = agent.result || {};
    const logs = Array.isArray(result.logs) ? result.logs : [];
    const usage = (result.usage as Record<string, number | undefined> | undefined) || {};
    const answer = typeof result.answer === "string" && result.answer.trim()
        ? result.answer
        : typeof result.message === "string"
            ? result.message
            : "No final answer returned.";

    return (
        <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-lg border border-border bg-card p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">MCP</p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                        {result.mcpType === "chrome-devtools" ? "Chrome DevTools" : "Playwright"}
                    </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Duration</p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                        {typeof result.duration === "number" ? `${result.duration.toFixed(1)}s` : "N/A"}
                    </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Tokens</p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                        {usage.total_tokens ?? "N/A"}
                    </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Cost</p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                        {typeof usage.total_cost === "number" ? `$${usage.total_cost.toFixed(4)}` : "N/A"}
                    </p>
                </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Final Answer</h4>
                <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
                    {answer}
                </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Execution Logs</h4>
                {logs.length > 0 ? (
                    <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
                        {logs.join("\n")}
                    </pre>
                ) : (
                    <p className="mt-3 text-sm text-muted-foreground">No logs captured for this run.</p>
                )}
            </div>
        </div>
    );
}
