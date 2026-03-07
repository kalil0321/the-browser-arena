"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const markdownComponents = {
    table: ({ children }: any) => (
        <div className="overflow-x-auto -mx-2 my-4">
            <div className="inline-block min-w-full align-middle px-2">
                <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-border bg-white dark:bg-card">
                        {children}
                    </table>
                </div>
            </div>
        </div>
    ),
    thead: ({ children }: any) => (
        <thead className="bg-gray-50 dark:bg-muted [&_tr]:hover:bg-transparent">{children}</thead>
    ),
    th: ({ children }: any) => (
        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
            {children}
        </th>
    ),
    td: ({ children }: any) => (
        <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200 whitespace-normal border-b border-gray-100 dark:border-gray-800">
            {children}
        </td>
    ),
    tbody: ({ children }: any) => (
        <tbody className="bg-white dark:bg-card divide-y divide-gray-200 dark:divide-border">
            {children}
        </tbody>
    ),
    tr: ({ children }: any) => (
        <tr className="hover:bg-gray-50 dark:hover:bg-muted/50 transition-colors">
            {children}
        </tr>
    ),
    p: ({ children }: any) => (
        <p className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed mb-3 last:mb-0">
            {children}
        </p>
    ),
    ol: ({ children }: any) => (
        <ol className="list-decimal list-inside text-sm text-gray-900 dark:text-gray-100 leading-relaxed mb-3 last:mb-0">
            {children}
        </ol>
    ),
    ul: ({ children }: any) => (
        <ul className="list-disc list-inside text-sm text-gray-900 dark:text-gray-100 leading-relaxed mb-3 last:mb-0">
            {children}
        </ul>
    ),
    li: ({ children }: any) => (
        <li className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed mb-3 last:mb-0">
            {children}
        </li>
    ),
};

interface SdkAgentPanelProps {
    agent: {
        name: string;
        sdkClient?: string;
        sdkVersion?: string;
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
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                <div className="rounded-lg border border-border bg-card p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">MCP</p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                        {result.mcpType === "chrome-devtools" ? "Chrome DevTools" : "Playwright"}
                        {(result.metadata as { mcpVersion?: string })?.mcpVersion && (
                            <span className="ml-1 text-xs text-muted-foreground font-mono">v{(result.metadata as { mcpVersion: string }).mcpVersion}</span>
                        )}
                    </p>
                </div>
                {agent.sdkClient && (
                    <div className="rounded-lg border border-border bg-card p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Client</p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                            {agent.sdkClient === "codex" ? "Codex" : "Claude Code"}
                            {agent.sdkVersion && (
                                <span className="ml-1 text-xs text-muted-foreground font-mono">v{agent.sdkVersion}</span>
                            )}
                        </p>
                    </div>
                )}
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
                <div className="mt-3 font-default prose prose-sm dark:prose-invert max-w-none prose-pre:p-0 prose-pre:m-0 prose-table:m-0 max-h-96 overflow-y-auto">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={markdownComponents}
                    >
                        {String(answer).replace(/\\n/g, "\n")}
                    </ReactMarkdown>
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
