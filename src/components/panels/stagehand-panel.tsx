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
    action?: string;
    reasoning?: string;
    taskCompleted?: boolean;
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
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Message</h4>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {agentResult.message.replace(/\\n/g, "\n")}
                        </ReactMarkdown>
                    </div>
                </div>
            )}

            {/* Metrics Grid */}
            {(agentResult.duration || agentResult.usage) && (
                <div className="grid grid-cols-2 gap-2">
                    {agentResult.duration !== undefined && (
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                                <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">Duration</h4>
                            </div>
                            <p className="text-sm font-default text-gray-900 dark:text-gray-100">
                                {(agentResult.duration.toFixed(1) - agentResult.usage.inference_time_ms / 1000).toFixed(1)}s + {(agentResult.usage.inference_time_ms / 1000).toFixed(1)}s = {agentResult.duration.toFixed(1)}s
                            </p>
                        </div>
                    )}
                    {(
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                                <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                                </svg>
                                <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">Tokens</h4>
                            </div>
                            <p className="text-sm font-default text-gray-900 dark:text-gray-100">
                                {((agentResult.usage.input_tokens ?? 0) + (agentResult.usage.output_tokens ?? 0)).toLocaleString()}
                            </p>
                        </div>
                    )}
                    {agentResult.usage?.output_tokens !== undefined && agentResult.usage.output_tokens > 0 && (
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                                <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">Output Tokens</h4>
                            </div>
                            <p className="text-sm font-default font-semibold text-gray-900 dark:text-gray-100">
                                {agentResult.usage.output_tokens.toLocaleString()}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Actions */}
            {actions.length > 0 && (
                <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                        <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
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
                                        {getActionIcon(action.type || "")}
                                    </div>
                                    <div className="flex-1 text-left">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                                                {action.type || "Action"}
                                            </span>
                                            <span className="text-xs text-gray-500 dark:text-gray-500">
                                                Step {index + 1}
                                            </span>
                                        </div>
                                        {action.action && (
                                            <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">
                                                {action.action}
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
                                        {action.playwrightArguments && (
                                            <div>
                                                <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Playwright Details</h5>
                                                <div className="space-y-2">
                                                    {action.playwrightArguments.method && (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[80px]">Method:</span>
                                                            <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono text-gray-900 dark:text-gray-100">
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

