"use client";

import { useState } from "react";
import { SmoothPanel } from "./panels/smooth-panel";
import { BUPanel } from "./panels/bu-panel";
import { StagehandPanel } from "./panels/stagehand-panel";
import { BrowserUseLogo } from "./logos/bu";
import { SmoothLogo } from "./logos/smooth";
import { StagehandLogo } from "./logos/stagehand";
import { XCircle, AlertTriangle } from "lucide-react";

interface AgentPanelProps {
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
}

export function AgentPanel({ agent }: AgentPanelProps) {
    const [showFullResult, setShowFullResult] = useState(false);

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
    const displayUrl = agent.browser?.url;
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

    // Get display name - use shorter names for long agent names
    const getDisplayName = (name: string) => {
        if (name === "browser-use-cloud") {
            return "BU Cloud";
        }
        if (name === "stagehand-bb-cloud") {
            return "SH BB Cloud";
        }
        if (name === "stagehand-cloud") {
            return "SH Cloud";
        }
        return name;
    };

    return (
        <div className="h-full flex flex-col dark:bg-black bg-white text-foreground overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card min-w-0">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${getStatusColor()}`}></div>
                    {(agent.name === "browser-use" || agent.name === "browser_use" || agent.name === "browser-use-cloud") && (
                        <BrowserUseLogo className="h-4 w-4 shrink-0" />
                    )}
                    {agent.name === "smooth" && (
                        <SmoothLogo className="h-4 w-4 shrink-0" />
                    )}
                    {(agent.name === "stagehand" || agent.name === "stagehand-bb-cloud" || agent.name === "stagehand-cloud") && (
                        <StagehandLogo className="h-4 w-4 shrink-0" />
                    )}
                    <h3 className="text-sm font-medium capitalize truncate min-w-0" title={agent.name}>
                        {getDisplayName(agent.name)}
                    </h3>
                    {agent.model && (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0 max-w-[120px] truncate" title={agent.model}>
                            {agent.model}
                        </span>
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

                {agent.status === "running" && displayUrl && (
                    <iframe
                        src={displayUrl}
                        className="w-full h-full border-0"
                        allow="camera; microphone"
                    />
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
                                            <p className="text-sm text-red-900 dark:text-red-100 break-words">
                                                {typeof agentResult.error === 'string'
                                                    ? agentResult.error
                                                    : JSON.stringify(agentResult.error, null, 2)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {agentResult?.message && !agentResult?.error && (
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mt-4 text-left">
                                    <p className="text-sm text-red-900 dark:text-red-100">
                                        {agentResult.message}
                                    </p>
                                </div>
                            )}
                            {!agentResult?.error && !agentResult?.message && (
                                <p className="text-xs text-muted-foreground italic">
                                    No additional error details available.
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {isCompleted && (
                    <div className="h-full overflow-auto">
                        {/* {hasRecording && agent.recordingUrl ? (
                            <video
                                src={agent.recordingUrl}
                                controls
                                className="w-full h-auto"
                                autoPlay
                            />
                        ) :  */}

                        {displayUrl && !agentResult && (
                            <iframe
                                src={displayUrl}
                                className="w-full h-full border-0"
                                allow="camera; microphone"
                            />
                        )}

                        {/* : null} */}

                        {/* Results Section - Route to specific panel based on agent name */}
                        {agentResult && (
                            <div className="p-4">
                                {agent.name === "smooth" && <SmoothPanel agent={agent} />}
                                {(agent.name === "browser-use" || agent.name === "browser_use" || agent.name === "browser-use-cloud") && <BUPanel agent={agent} />}
                                {(agent.name === "stagehand" || agent.name === "stagehand-bb-cloud" || agent.name === "stagehand-cloud") && <StagehandPanel agent={agent} />}

                                {/* Fallback for unknown agents */}
                                {!["smooth", "browser-use", "browser_use", "browser-use-cloud", "stagehand", "stagehand-bb-cloud", "stagehand-cloud"].includes(agent.name) && (
                                    <div className="space-y-3">
                                        <div className="bg-card rounded-lg p-4">
                                            <h4 className="text-xs font-medium mb-2 uppercase tracking-wide">Result</h4>
                                            <pre className="text-xs whitespace-pre-wrap">
                                                {JSON.stringify(agentResult, null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
