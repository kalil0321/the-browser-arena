"use client";

import { useState } from "react";
import { SmoothPanel } from "./panels/smooth-panel";
import { BUPanel } from "./panels/bu-panel";
import { StagehandPanel } from "./panels/stagehand-panel";
import { AgentPropertiesDialog } from "./agent-properties-dialog";

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
    const [showPropertiesDialog, setShowPropertiesDialog] = useState(false);

    if (!agent) {
        return (
            <div className="h-full flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
                <div className="text-center p-6">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-900 dark:border-gray-700 dark:border-t-gray-300 mx-auto mb-3"></div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Waiting for agent...</p>
                </div>
            </div>
        );
    }

    const isCompleted = agent.status === "completed" || agent.status === "failed";
    const hasRecording = isCompleted && agent.recordingUrl;
    const displayUrl = agent.browser?.url;
    const agentResult = agent.result;

    // Determine if agent has properties to show (not smooth)
    const hasProperties = agent.name !== "smooth";

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
        <div className="h-full flex flex-col bg-white dark:bg-gray-900 rounded-lg  overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor()}`}></div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">
                        {agent.name}
                    </h3>
                    {agent.model && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                            {agent.model}
                        </span>
                    )}
                    {hasProperties && (
                        <button
                            onClick={() => setShowPropertiesDialog(true)}
                            className="ml-1 px-2 py-0.5 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-full transition-colors"
                            title="View agent properties"
                        >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                        {agent.status}
                    </span>
                </div>
            </div>

            {/* Agent Properties Dialog */}
            {hasProperties && (
                <AgentPropertiesDialog
                    agent={agent}
                    open={showPropertiesDialog}
                    onOpenChange={setShowPropertiesDialog}
                />
            )}

            {/* Content */}
            <div className="flex-1 relative overflow-hidden">
                {agent.status === "pending" && (
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center p-6">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-900 dark:border-gray-700 dark:border-t-gray-300 mx-auto mb-3"></div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Initializing...</p>
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

                {isCompleted && (
                    <div className="h-full overflow-auto">
                        {hasRecording && agent.recordingUrl ? (
                            <video
                                src={agent.recordingUrl}
                                controls
                                className="w-full h-auto"
                                autoPlay
                            />
                        ) : displayUrl && !agentResult ? (
                            <iframe
                                src={displayUrl}
                                className="w-full h-full border-0"
                                allow="camera; microphone"
                            />
                        ) : null}

                        {/* Results Section - Route to specific panel based on agent name */}
                        {agentResult && (
                            <div className="p-4">
                                {agent.name === "smooth" && <SmoothPanel agent={agent} />}
                                {(agent.name === "browser-use" || agent.name === "browser_use" || agent.name === "browser-use-cloud") && <BUPanel agent={agent} />}
                                {(agent.name === "stagehand" || agent.name === "stagehand-bb-cloud" || agent.name === "stagehand-cloud") && <StagehandPanel agent={agent} />}

                                {/* Fallback for unknown agents */}
                                {!["smooth", "browser-use", "browser_use", "browser-use-cloud", "stagehand", "stagehand-bb-cloud", "stagehand-cloud"].includes(agent.name) && (
                                    <div className="space-y-3">
                                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                                            <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Result</h4>
                                            <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
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

