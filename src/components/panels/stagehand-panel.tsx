"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface StagehandPanelProps {
    agent: {
        _id: string;
        name: string;
        model?: string;
        status: "pending" | "running" | "completed" | "failed";
        browser: {
            sessionId: string;
            url: string;
        };
        result?: any;
        recordingUrl?: string;
    };
}

interface Action {
    type?: string;
    url?: string;
    pageUrl?: string;
    timestamp?: number;
    action?: string;
    reasoning?: string;
    taskCompleted?: boolean;
    selector?: string;
    instruction?: string;
    schema?: string;
    playwrightArguments?: {
        method?: string;
        selector?: string;
        description?: string;
        arguments?: any[];
    };
}

export function StagehandPanel({ agent }: StagehandPanelProps) {
    const [expandedActions, setExpandedActions] = useState<Set<number>>(new Set());
    const agentResult = agent.result;
    const isCompleted = agent.status === "completed" || agent.status === "failed";
    const actions: Action[] = agentResult?.actions || [];
    const extractionResults = agentResult?.metadata?.extractionResults;
    const logsRaw = agentResult?.metadata?.logs ?? agentResult?.logs;
    const logs: any[] = Array.isArray(logsRaw) ? logsRaw : logsRaw ? [logsRaw] : [];

    if (!isCompleted || !agentResult) {
        return null;
    }

    const toggleAction = (index: number) => {
        const newExpanded = new Set(expandedActions);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        } else {
            newExpanded.add(index);
        }
        setExpandedActions(newExpanded);
    };

    const formatTimestamp = (ts?: number) => {
        if (!ts) return "";
        try {
            return new Date(ts).toLocaleString();
        } catch {
            return String(ts);
        }
    };

    const getActionIcon = (type: string) => {
        switch (type?.toLowerCase()) {
            case "goto":
                return "→";
            case "act":
                return "⚡";
            case "ariaTree":
                return "🔍";
            case "navback":
                return "←";
            default:
                return "•";
        }
    };

    return (
        <div className="space-y-4">
            {/* Status Badge */}
            <div className="flex items-center gap-2">
                {(agentResult.success || agent.status === "completed") ? (
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="font-medium text-sm">Success</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span className="font-medium text-sm">Failed</span>
                    </div>
                )}
            </div>

            {/* Message */}
            {agentResult.message && (
                <div className="bg-gray-50 dark:bg-card rounded-lg p-4">
                    <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Result</h4>
                    <div className="font-default prose prose-sm dark:prose-invert max-w-none prose-pre:p-0 prose-pre:m-0 prose-table:m-0">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                table: ({ children }) => (
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
                                thead: ({ children }) => (
                                    <thead className="bg-gray-50 dark:bg-muted">{children}</thead>
                                ),
                                th: ({ children }) => (
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                                        {children}
                                    </th>
                                ),
                                td: ({ children }) => (
                                    <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200 whitespace-normal border-b border-gray-100 dark:border-gray-800">
                                        {children}
                                    </td>
                                ),
                                tbody: ({ children }) => (
                                    <tbody className="bg-white dark:bg-card divide-y divide-gray-200 dark:divide-border">
                                        {children}
                                    </tbody>
                                ),
                                tr: ({ children }) => (
                                    <tr className="hover:bg-gray-50 dark:hover:bg-muted/50 transition-colors">
                                        {children}
                                    </tr>
                                ),
                                p: ({ children }) => (
                                    <p className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed mb-3 last:mb-0">
                                        {children}
                                    </p>
                                ),
                                ol: ({ children }) => (
                                    <ol className="list-decimal list-inside text-sm text-gray-900 dark:text-gray-100 leading-relaxed mb-3 last:mb-0">
                                        {children}
                                    </ol>
                                ),
                                ul: ({ children }) => (
                                    <ul className="list-disc list-inside text-sm text-gray-900 dark:text-gray-100 leading-relaxed mb-3 last:mb-0">
                                        {children}
                                    </ul>
                                ),
                                li: ({ children }) => (
                                    <li className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed mb-3 last:mb-0">
                                        {children}
                                    </li>
                                ),
                            }}
                        >
                            {agentResult.message.replace(/\\n/g, "\n")}
                        </ReactMarkdown>
                    </div>
                </div>
            )}

            {/* Metrics Grid */}
            {(agentResult.duration || agentResult.usage) && (
                <div className="grid grid-cols-2 gap-2">
                    {agentResult.duration !== undefined && (
                        <div className="bg-gray-50 dark:bg-card rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                                <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">Duration</h4>
                            </div>
                            <p className="text-sm font-default text-gray-900 dark:text-gray-100">
                                {agentResult.duration.toFixed(1)}s
                            </p>
                        </div>
                    )}
                    {agentResult.usage && (
                        <div className="bg-gray-50 dark:bg-card rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                                <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                                </svg>
                                <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">Tokens</h4>
                            </div>
                            <p className="text-sm font-default text-gray-900 dark:text-gray-100">
                                {((agentResult.usage.input_tokens ?? 0) + (agentResult.usage.output_tokens ?? 0)).toLocaleString()} (${agentResult.usage.total_cost?.toFixed(4) ?? "0.0000"})
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Extraction Results */}
            {extractionResults && (
                <div className="bg-gray-50 dark:bg-card rounded-lg border border-gray-200 dark:border-border">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-border bg-gray-50 dark:bg-muted">
                        <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide">Extraction</h4>
                    </div>
                    <div className="p-4">
                        {Array.isArray(extractionResults) ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-border text-sm">
                                    <thead className="bg-white dark:bg-card">
                                        <tr>
                                            {Object.keys(extractionResults[0] ?? { result: "Result" }).map((key) => (
                                                <th key={key} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                                                    {key}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-border">
                                        {extractionResults.map((row: any, idx: number) => (
                                            <tr key={idx} className="bg-white dark:bg-card">
                                                {Object.keys(row ?? {}).map((key) => (
                                                    <td key={key} className="px-3 py-2 text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                                                        {typeof row[key] === "object" ? JSON.stringify(row[key], null, 2) : String(row[key])}
                                                    </td>
                                                ))}
                                                {Object.keys(row ?? {}).length === 0 && (
                                                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400 italic">Empty</td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <pre className="text-xs whitespace-pre-wrap text-gray-900 dark:text-gray-100 bg-white dark:bg-card rounded-lg p-3 border border-gray-200 dark:border-border">
                                {typeof extractionResults === "object" ? JSON.stringify(extractionResults, null, 2) : String(extractionResults)}
                            </pre>
                        )}
                    </div>
                </div>
            )}

            {/* Actions */}
            {actions.length > 0 && (
                <div className="border border-gray-200 dark:border-border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 dark:bg-muted px-4 py-3 border-b border-gray-200 dark:border-border">
                        <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
                            Actions ({actions.length})
                        </h4>
                    </div>
                    <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                        {actions.map((action, index) => {
                            const type = (action.type || "").toLowerCase();
                            const isExpandable = type !== "goto" && type !== "ariatree";
                            const isExpanded = isExpandable && expandedActions.has(index);

                            return (
                                <div
                                    key={index}
                                    className="bg-gray-50 dark:bg-card rounded-lg border border-gray-200 dark:border-border overflow-hidden"
                                >
                                    <button
                                        onClick={isExpandable ? () => toggleAction(index) : undefined}
                                        className={`w-full px-4 py-3 flex items-center gap-3 transition-colors ${isExpandable ? "hover:bg-gray-100 dark:hover:bg-muted" : "cursor-default"}`}
                                    >
                                        <div className="shrink-0 w-8 h-8 rounded-lg bg-gray-200 dark:bg-muted flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-400">
                                            {getActionIcon(action.type || "")}
                                        </div>
                                        <div className="flex-1 text-left">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                                                    {action.type || "Action"}
                                                </span>
                                                <span className="text-xs text-gray-500 dark:text-gray-500">
                                                    Step {index + 1}{action.timestamp ? ` • ${formatTimestamp(action.timestamp)}` : ""}
                                                </span>
                                            </div>
                                            {action.action && (
                                                <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">
                                                    {action.action}
                                                </p>
                                            )}
                                            {action.instruction && (
                                                <p className="text-xs text-gray-700 dark:text-gray-300 mt-1 line-clamp-2">
                                                    {action.instruction}
                                                </p>
                                            )}
                                            {action.url && (
                                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">
                                                    {action.url}
                                                </p>
                                            )}
                                            {action.pageUrl && (
                                                <p className="text-[11px] text-gray-500 dark:text-gray-500 truncate">
                                                    Page: {action.pageUrl}
                                                </p>
                                            )}
                                        </div>
                                        {isExpandable && (
                                            <svg
                                                className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        )}
                                    </button>

                                    {isExpanded && (
                                        <div className="px-4 py-3 border-t border-gray-200 dark:border-border bg-white dark:bg-card space-y-3">
                                            {action.reasoning && (
                                                <div>
                                                    <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">Reasoning</h5>
                                                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                                                        {action.reasoning}
                                                    </p>
                                                </div>
                                            )}
                                            {action.schema && (
                                                <div>
                                                    <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">Schema</h5>
                                                    <pre className="text-[11px] bg-gray-100 dark:bg-muted px-3 py-2 rounded border border-gray-200 dark:border-border whitespace-pre-wrap">
                                                        {action.schema}
                                                    </pre>
                                                </div>
                                            )}
                                            {action.selector && (
                                                <div>
                                                    <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">Selector</h5>
                                                    <code className="text-[11px] bg-gray-100 dark:bg-muted px-2 py-1 rounded border border-gray-200 dark:border-border break-all">
                                                        {action.selector}
                                                    </code>
                                                </div>
                                            )}
                                            {action.playwrightArguments && (
                                                <div>
                                                    <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Playwright Details</h5>
                                                    <div className="space-y-2">
                                                        {action.playwrightArguments.method && (
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[80px]">Method:</span>
                                                                <code className="text-xs bg-gray-100 dark:bg-muted px-2 py-1 rounded font-mono text-gray-900 dark:text-gray-100">
                                                                    {action.playwrightArguments.method}
                                                                </code>
                                                            </div>
                                                        )}
                                                        {action.playwrightArguments.description && (
                                                            <div className="flex items-start gap-2">
                                                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[80px]">Description:</span>
                                                                <span className="text-xs text-gray-700 dark:text-gray-300">
                                                                    {action.playwrightArguments.description}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {action.playwrightArguments.selector && (
                                                            <div className="flex items-start gap-2">
                                                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[80px]">Selector:</span>
                                                                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono text-gray-700 dark:text-gray-300 break-all">
                                                                    {action.playwrightArguments.selector}
                                                                </code>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Logs */}
            {logs.length > 0 && (
                <div className="border border-gray-200 dark:border-border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 dark:bg-muted px-4 py-3 border-b border-gray-200 dark:border-border">
                        <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
                            Logs
                        </h4>
                    </div>
                    <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
                        {logs.map((log, idx) => (
                            <pre
                                key={idx}
                                className="text-xs bg-white dark:bg-card border border-gray-200 dark:border-border rounded-lg p-3 whitespace-pre-wrap text-gray-900 dark:text-gray-100"
                            >
                                {typeof log === "string" ? log : JSON.stringify(log, null, 2)}
                            </pre>
                        ))}
                    </div>
                </div>
            )}

            {/* Error Message */}
            {agentResult.error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <h4 className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">Error</h4>
                    <p className="text-sm text-red-900 dark:text-red-100">{agentResult.error}</p>
                </div>
            )}
        </div>
    );
}

