"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface SmoothPanelProps {
    agent: {
        _id: string;
        name: string;
        model?: string;
        status: "pending" | "running" | "completed" | "failed" | "done";
        browser: {
            sessionId: string;
            url: string;
        };
        result?: any;
        recordingUrl?: string;
    };
}

export function SmoothPanel({ agent }: SmoothPanelProps) {
    const agentResult = agent.result;
    const isCompleted = agent.status === "completed" || agent.status === "failed" || agent.status === "done";

    if (!isCompleted || !agentResult) {
        return null;
    }

    return (
        <div className="space-y-4">
            {/* Status Badge */}
            <div className="flex items-center gap-2">
                {(agentResult.success || agent.status === "completed" || agent.status === "done") ? (
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

            {/* Output Array */}
            {agentResult.output && Array.isArray(agentResult.output) && agentResult.output.length > 0 && (
                <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                        <h4 className="text-xs text-gray-900 dark:text-gray-100 uppercase tracking-wide flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Output ({agentResult.output.length} items)
                        </h4>
                    </div>
                    <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
                        {agentResult.output.map((item: any, index: number) => {
                            const isString = typeof item === 'string';
                            const title = !isString ? (item.title || item.name || 'Result') : undefined;
                            const url = !isString ? item.url : undefined;
                            const description = !isString ? item.description : undefined;
                            return (
                                <div key={index} className="group relative flex items-start gap-3 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all">
                                    <div className="shrink-0 w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-800 dark:text-gray-100">
                                        {index + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        {isString ? (
                                            <p className="text-sm text-gray-900 dark:text-gray-100 leading-tight truncate">
                                                {item}
                                            </p>
                                        ) : (
                                            <>
                                                <p className="text-sm text-gray-900 dark:text-gray-100 mb-1 leading-tight">
                                                    {title}
                                                </p>
                                                {url && (
                                                    <a
                                                        href={url.startsWith('http') ? url : `https://${url}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-gray-700 dark:text-gray-300 hover:underline flex items-center gap-1 truncate"
                                                    >
                                                        <svg className="w-3 h-3 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                                        </svg>
                                                        <span className="truncate">{url}</span>
                                                    </a>
                                                )}
                                                {description && (
                                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                                        {description}
                                                    </p>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    {!isString && url && (
                                        <a
                                            href={url.startsWith('http') ? url : `https://${url}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <svg className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                        </a>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Output Text */}
            {agentResult.output && typeof agentResult.output === 'string' && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Result</h4>
                    <p className="text-sm font-default text-gray-900 dark:text-gray-100">{agentResult.output}</p>
                </div>
            )}

            {/* Output object */}
            {agentResult.output && typeof agentResult.output === 'object' && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Result</h4>
                    <pre className="text-sm font-default text-gray-900 dark:text-gray-100">{JSON.stringify(agentResult.output, null, 2)}</pre>
                </div>
            )}

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-2">
                {/* Duration */}
                {agentResult.metadata?.duration !== undefined && (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">Duration</h4>
                        </div>
                        <p className="text-sm font-default text-gray-900 dark:text-gray-100">
                            {agentResult.metadata.duration.toFixed(1)}s
                        </p>
                    </div>
                )}

                {/* Cost */}
                {agentResult.cost !== undefined && (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">Cost</h4>
                        </div>
                        <p className="text-sm font-default text-gray-900 dark:text-gray-100">
                            ${agentResult.cost.toFixed(4)}
                        </p>
                    </div>
                )}

            </div>

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

