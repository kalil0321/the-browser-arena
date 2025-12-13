"use client";

import { useEffect, useRef, useState } from "react";
import { SmoothPanel } from "../panels/smooth-panel";
import { BUPanel } from "../panels/bu-panel";
import { StagehandPanel } from "../panels/stagehand-panel";
import { NottePanel } from "../panels/notte-panel";
import { LoadingDino } from "../loading-dino";
import { XCircle, AlertTriangle, ShieldQuestion } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Shared markdown components configuration (same as in StagehandPanel)
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
        <thead className="bg-gray-50 dark:bg-muted">{children}</thead>
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

const extractStagehandOutput = (agentResult: any): string | null => {
    if (!agentResult) return null;

    // If message is a string, use it directly
    if (typeof agentResult.message === "string") {
        return agentResult.message;
    }

    // If message is an object, try to extract the actual output
    if (agentResult.message && typeof agentResult.message === "object") {
        // Check if message has actions/usage - if so, it's likely the entire result object
        const isEntireResult = agentResult.message.actions || agentResult.message.usage;

        // First, try to find nested output fields (in order of preference)
        const nestedOutput =
            agentResult.message?.output ||
            agentResult.message?.value ||
            agentResult.message?.message ||
            agentResult.message?.object?.value ||
            agentResult.message?.object?.extraction ||
            agentResult.message?.extraction;

        if (nestedOutput) {
            // If it's a string, return it; if it's an object, try to extract string value
            if (typeof nestedOutput === "string") {
                return nestedOutput;
            }
            // If it's an object, try to find a string value inside it
            if (typeof nestedOutput === "object") {
                const stringValue = nestedOutput.value || nestedOutput.output || nestedOutput.text;
                if (typeof stringValue === "string") {
                    return stringValue;
                }
            }
        }

        // If message is the entire result object, check extraction fields
        if (isEntireResult) {
            const extraction =
                agentResult.message.extraction ||
                agentResult.extraction ||
                agentResult.message.metadata?.extractionResults ||
                agentResult.metadata?.extractionResults;

            if (extraction) {
                if (typeof extraction === "string") {
                    return extraction;
                }
                // If extraction is an array or object, try to extract meaningful text
                if (Array.isArray(extraction) && extraction.length > 0) {
                    // Try to get the first item's value or string representation
                    const firstItem = extraction[0];
                    if (typeof firstItem === "string") {
                        return firstItem;
                    }
                    if (firstItem && typeof firstItem === "object") {
                        const itemValue = firstItem.value || firstItem.output || firstItem.text || firstItem.result;
                        if (typeof itemValue === "string") {
                            return itemValue;
                        }
                    }
                }
            }
        }
    }

    // Fallback: check extraction at root level
    if (agentResult.extraction) {
        if (typeof agentResult.extraction === "string") {
            return agentResult.extraction;
        }
        // Handle array/object extraction
        if (Array.isArray(agentResult.extraction) && agentResult.extraction.length > 0) {
            const firstItem = agentResult.extraction[0];
            if (typeof firstItem === "string") {
                return firstItem;
            }
        }
    }

    return null;
};

interface BattleAgentPanelProps {
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
    } | null;
    label: string; // "Agent A" or "Agent B"
    hideIdentity: boolean; // Hide agent name and model
    showBrowserView: boolean; // Show live browser view
    showOutput?: boolean; // Show output even if identity is hidden
    sameFramework: boolean; // Whether both agents use the same framework
    anyCompleted: boolean; // Whether any agent has completed
}

// Helper function to get the actual agent type
// When hideIdentity is true, agent.name is "Agent A" or "Agent B"
// So we need to check agentResult.agent first, then fall back to agent.name
const getAgentType = (agent: BattleAgentPanelProps['agent'], agentResult: any): string => {
    if (agentResult?.agent) {
        return agentResult.agent;
    }
    return agent?.name || "";
};

export function BattleAgentPanel({ agent, label, hideIdentity, showBrowserView, showOutput = false, sameFramework, anyCompleted }: BattleAgentPanelProps) {
    const [videoError, setVideoError] = useState(false);
    const [playbackRate, setPlaybackRate] = useState<1 | 4>(1);
    const videoRef = useRef<HTMLVideoElement | null>(null);

    useEffect(() => {
        setVideoError(false);
        setPlaybackRate(1);
    }, [agent?.recordingUrl]);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.playbackRate = playbackRate;
        }
    }, [playbackRate]);

    useEffect(() => {
        if (!videoRef.current) return;
        if (!videoError) {
            videoRef.current.play().catch(() => undefined);
        }
    }, [videoError]);

    if (!agent) {
        return (
            <div className="h-full flex items-center justify-center bg-card border-border">
                <div className="text-center p-6">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-border border-t-foreground mx-auto mb-3"></div>
                    <p className="text-sm text-muted-foreground">Waiting for agent...</p>
                </div>
            </div>
        );
    }

    const isCompleted = agent.status === "completed";
    const isFailed = agent.status === "failed";
    const hasRecording = isCompleted && agent.recordingUrl;
    const displayUrl = showBrowserView ? agent.browser?.url : null;
    const agentResult = agent.result;

    // Status colors
    const getStatusColor = () => {
        switch (agent.status) {
            case "running":
                return "bg-blue-500";
            case "completed":
                return "bg-green-500";
            case "failed":
                return "bg-red-500";
            default:
                return "bg-gray-500";
        }
    };

    return (
        <div className="h-full flex flex-col dark:bg-black bg-white text-foreground overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card min-w-0">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${getStatusColor()}`}></div>
                    {hideIdentity ? (
                        <>
                            <ShieldQuestion className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <h3 className="text-sm font-medium" title="Identity hidden until vote">
                                {label}
                            </h3>
                        </>
                    ) : (
                        <>
                            <h3 className="text-sm font-medium capitalize truncate min-w-0" title={agent.name}>
                                {agent.name}
                            </h3>
                            {agent.model && (
                                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0 max-w-[120px] truncate" title={agent.model}>
                                    {agent.model.replace(/^openrouter\//, '')}
                                </span>
                            )}
                        </>
                    )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs capitalize ${agent.status === "running" ? "text-blue-600" :
                        agent.status === "completed" ? "text-green-600" :
                            agent.status === "failed" ? "text-red-600" :
                                "text-muted-foreground"
                        }`}>
                        {agent.status}
                    </span>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 relative overflow-hidden">
                {agent.status === "pending" && (
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center p-6">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-border border-t-foreground mx-auto mb-3"></div>
                            <p className="text-sm text-muted-foreground">Initializing...</p>
                        </div>
                    </div>
                )}

                {agent.status === "running" && !displayUrl && (
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center p-6">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-border border-t-foreground mx-auto mb-3"></div>
                            <p className="text-sm text-muted-foreground">
                                {showBrowserView ? "Creating session..." : "Running..."}
                            </p>
                        </div>
                    </div>
                )}

                {agent.status === "running" && displayUrl && (
                    <iframe
                        src={displayUrl}
                        className="w-full h-full border-0"
                        allow="camera; microphone"
                    />
                )}

                {agent.status === "running" && !showBrowserView && (
                    <>
                        {!sameFramework && !anyCompleted ? (
                            <div className="h-full flex items-center justify-center">
                                <LoadingDino />
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center">
                                <div className="text-center p-6">
                                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-border border-t-foreground mx-auto mb-3"></div>
                                    <p className="text-sm text-muted-foreground">Agent is working...</p>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {isFailed && (
                    <div className="h-full flex items-center justify-center p-8">
                        <div className="text-center max-w-md">
                            <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-4">
                                <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-foreground mb-2">Task Failed</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                The agent encountered an error while executing the task.
                            </p>
                            {agentResult?.error && (
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mt-4 text-left">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">Error Details</h4>
                                            <p className="text-sm text-red-900 dark:text-red-100 wrap-break-word">
                                                {(typeof agentResult.error === 'string'
                                                    ? agentResult.error
                                                    : JSON.stringify(agentResult.error, null, 2))}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {isCompleted && (
                    <div className="h-full overflow-auto">
                        {hasRecording && agent.recordingUrl && (
                            <div className="border-b border-border bg-card">
                                <div className="relative bg-black">
                                    <div className="aspect-video w-full bg-black">
                                        {!videoError ? (
                                            <video
                                                key={agent.recordingUrl}
                                                src={agent.recordingUrl}
                                                controls
                                                playsInline
                                                className="h-full w-full object-contain bg-black"
                                                ref={videoRef}
                                                onError={() => setVideoError(true)}
                                            />
                                        ) : (
                                            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
                                                <p>Recording preview unavailable.</p>
                                                <a
                                                    href={agent.recordingUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs font-medium text-blue-600 hover:underline"
                                                >
                                                    Open recording in new tab
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                    {!videoError && (
                                        <>
                                            <a
                                                href={agent.recordingUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="absolute right-3 top-3 rounded-md bg-black/70 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-white hover:bg-black/80"
                                            >
                                                Open Externally
                                            </a>
                                            <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                                                <div className="flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-white">
                                                    <span>Speed</span>
                                                    {[1, 4].map((value) => (
                                                        <button
                                                            key={value}
                                                            type="button"
                                                            onClick={() => setPlaybackRate(value as 1 | 4)}
                                                            className={`rounded px-1.5 py-0.5 text-[10px] ${playbackRate === value ? "bg-white/90 text-black" : "bg-white/10 text-white hover:bg-white/20"}`}
                                                        >
                                                            {value}x
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {!hasRecording && !agentResult && (
                            <div className="h-full flex items-center justify-center p-8">
                                <div className="text-center max-w-md">
                                    <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-4">
                                        <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-semibold text-foreground mb-2">Task Completed</h3>
                                    <p className="text-sm text-muted-foreground">
                                        The agent has finished executing the task.
                                    </p>
                                </div>
                            </div>
                        )}

                        {agentResult && showOutput && (() => {
                            const agentType = getAgentType(agent, agentResult);
                            const isStagehand = agentType === "stagehand";
                            const isBrowserUse = agentType === "browser-use" || agentType === "browser_use" || agentType === "browser-use-cloud";
                            const isSmooth = agentType === "smooth";
                            const isNotte = agentType === "notte";

                            return (
                                <div className="p-4 overflow-y-auto max-h-full">
                                    {/* Show agent-specific panels if identity is revealed */}
                                    {!hideIdentity && isSmooth && <SmoothPanel agent={agent} />}
                                    {!hideIdentity && isBrowserUse && <BUPanel agent={agent} />}
                                    {!hideIdentity && isStagehand && <StagehandPanel agent={agent} />}
                                    {!hideIdentity && isNotte && <NottePanel agent={agent} />}

                                    {/* Show simplified output if identity is hidden */}
                                    {hideIdentity && (
                                        <div className="space-y-3">
                                            <div className="bg-card rounded-lg p-4 border border-border">
                                                <h4 className="text-xs font-medium mb-3 uppercase tracking-wide text-muted-foreground">Output</h4>
                                                {/* Stagehand: show actual final output */}
                                                {isStagehand && (() => {
                                                    const output = extractStagehandOutput(agentResult);
                                                    return output ? (
                                                        <div className="font-default prose prose-sm dark:prose-invert max-w-none prose-pre:p-0 prose-pre:m-0 prose-table:m-0 max-h-96 overflow-y-auto">
                                                            <ReactMarkdown
                                                                remarkPlugins={[remarkGfm]}
                                                                components={markdownComponents}
                                                            >
                                                                {output.replace(/\\n/g, "\n")}
                                                            </ReactMarkdown>
                                                        </div>
                                                    ) : null;
                                                })()}

                                                {/* Other agents: check final_result, extracted_content */}
                                                {isBrowserUse && agentResult.finalResult && (
                                                    <div className="font-default prose prose-sm dark:prose-invert max-w-none prose-pre:p-0 prose-pre:m-0 prose-table:m-0 max-h-96 overflow-y-auto">
                                                        <ReactMarkdown
                                                            remarkPlugins={[remarkGfm]}
                                                            components={markdownComponents}
                                                        >
                                                            {String(agentResult.finalResult).replace(/\\n/g, "\n")}
                                                        </ReactMarkdown>
                                                    </div>
                                                )}

                                                {isNotte && agentResult.answer && (
                                                    <div className="font-default prose prose-sm dark:prose-invert max-w-none prose-pre:p-0 prose-pre:m-0 prose-table:m-0 max-h-96 overflow-y-auto">
                                                        <ReactMarkdown
                                                            remarkPlugins={[remarkGfm]}
                                                            components={markdownComponents}
                                                        >
                                                            {String(agentResult.answer).replace(/\\n/g, "\n")}
                                                        </ReactMarkdown>
                                                    </div>
                                                )}

                                                {/* Fallback for other cases */}
                                                {!isStagehand && !isNotte && !isBrowserUse && !agentResult.finalResult && !agentResult.extractedContent && (
                                                    <pre className="text-xs whitespace-pre-wrap wrap-break-word overflow-x-auto max-h-96 overflow-y-auto">
                                                        {JSON.stringify(agentResult, null, 2)}
                                                    </pre>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Fallback for unknown agent types */}
                                    {!hideIdentity && !isSmooth && !isBrowserUse && !isStagehand && !isNotte && (
                                        <div className="space-y-3">
                                            <div className="bg-card rounded-lg p-4">
                                                <h4 className="text-xs font-medium mb-2 uppercase tracking-wide">Result</h4>
                                                <pre className="text-xs whitespace-pre-wrap max-h-96 overflow-y-auto">
                                                    {JSON.stringify(agentResult, null, 2)}
                                                </pre>
                                            </div>
                                        </div>
                                    )}


                                    {agent.status === "completed" && agent.result?.usage?.total_cost !== undefined && (
                                        <div className="mt-4 pt-4 border-t border-border">
                                            <div className="bg-muted/50 rounded-lg p-4">
                                                <div className="text-center">
                                                    <div className="text-xs text-muted-foreground mb-2">Total Cost</div>
                                                    <div className="text-2xl font-bold font-mono text-foreground">
                                                        ${agent.result.usage.total_cost.toFixed(4)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>
        </div>
    );
}
