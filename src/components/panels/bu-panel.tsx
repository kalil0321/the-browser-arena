"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface BUPanelProps {
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
        createdAt?: number;
        updatedAt?: number;
    };
}

interface Action {
    type?: string;
    name?: string;
    url?: string;
    action?: string;
    reasoning?: string;
    result?: any;
}

export function BUPanel({ agent }: BUPanelProps) {
    const [expandedActions, setExpandedActions] = useState<Set<number>>(new Set());
    const agentResult = agent.result;
    const isCompleted = agent.status === "completed" || agent.status === "failed";
    const actions: Action[] = agentResult?.actions || [];

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
                {agentResult.success ? (
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

            {/* Markdown Result */}
            {(() => {
                const textOutput = agentResult.finalResult || agentResult.message;
                if (!textOutput || typeof textOutput !== "string") return null;

                const normalizedText = textOutput.replace(/\\n/g, "\n");

                return (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Result</h4>
                        <div className="font-default prose prose-sm dark:prose-invert max-w-none prose-pre:p-0 prose-pre:m-0 prose-table:m-0">
                            <ReactMarkdown
                                
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    table: ({ children }) => (
                                        <div className="overflow-x-auto -mx-2 my-4">
                                            <div className="inline-block min-w-full align-middle px-2">
                                                <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                                                        {children}
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    ),
                                    thead: ({ children }) => (
                                        <thead className="bg-gray-50 dark:bg-gray-800">{children}</thead>
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
                                        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                                            {children}
                                        </tbody>
                                    ),
                                    tr: ({ children }) => (
                                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
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
                                {normalizedText}
                            </ReactMarkdown>
                        </div>
                    </div>
                );
            })()}

            {/* Metrics Grid */}
            {(agentResult.duration || agentResult.usage || (agent.createdAt && agent.updatedAt)) && (
                <div className="grid grid-cols-2 gap-2">
                    {/* Our computed duration minus agent duration if available */}
                    {agent.createdAt && agent.updatedAt && (
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                                <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">Duration</h4>
                            </div>
                            {(() => {
                                const ourSeconds = (agent.updatedAt - agent.createdAt) / 1000;
                                const agentSeconds = typeof agentResult.duration === 'number' ? agentResult.duration : undefined;
                                const displaySeconds = agentSeconds !== undefined ? (ourSeconds - agentSeconds) : ourSeconds;
                                return (
                                    <p className="text-sm font-default text-gray-900 dark:text-gray-100">
                                        {displaySeconds.toFixed(1)}s + {agentResult.duration.toFixed(1)}s = {ourSeconds.toFixed(1)}s
                                    </p>
                                );
                            })()}
                        </div>
                    )}
                    {agentResult.usage?.total_cost !== undefined && (
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                                <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">Cost</h4>
                            </div>
                            <p className="text-sm font-default text-gray-900 dark:text-gray-100">
                                ${agentResult.usage.total_cost.toFixed(4)}
                            </p>
                        </div>
                    )}
                    {agentResult.usage?.total_tokens !== undefined && (
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                                <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h10m-7 4h7" />
                                </svg>
                                <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">Tokens</h4>
                            </div>
                            <p className="text-sm font-default text-gray-900 dark:text-gray-100">
                                {agentResult.usage.total_tokens.toLocaleString()}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Actions Tab */}
            {actions.length > 0 && (
                <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                        <h4 className="text-xs text-gray-900 dark:text-gray-100 uppercase tracking-wide">
                            Actions ({actions.length})
                        </h4>
                    </div>
                    <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                        {actions.map((action, index) => (
                            <div
                                key={index}
                                className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                            >
                                <button
                                    onClick={() => toggleAction(index)}
                                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <div className="shrink-0 w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-400">
                                        {getActionIcon(action.type || action.name || "")}
                                    </div>
                                    <div className="flex-1 text-left">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                                                {action.type || action.name || "Action"}
                                            </span>
                                            <span className="text-xs text-gray-500 dark:text-gray-500">
                                                Step {index + 1}
                                            </span>
                                        </div>
                                        {action.name && action.name !== action.type && (
                                            <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">
                                                {action.name}
                                            </p>
                                        )}
                                        {action.url && (
                                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">
                                                {action.url}
                                            </p>
                                        )}
                                    </div>
                                    <svg
                                        className={`w-5 h-5 text-gray-400 transition-transform ${expandedActions.has(index) ? 'rotate-180' : ''}`}
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {expandedActions.has(index) && (
                                    <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 space-y-3">
                                        {action.reasoning && (
                                            <div>
                                                <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">Reasoning</h5>
                                                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                                                    {action.reasoning}
                                                </p>
                                            </div>
                                        )}
                                        {action.result && typeof action.result === 'object' && (
                                            <div>
                                                <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Result</h5>
                                                <pre className="font-mono text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded overflow-auto">
                                                    {JSON.stringify(action.result, null, 2)}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
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

