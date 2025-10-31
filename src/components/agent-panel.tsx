"use client";

import { useState } from "react";
import { SmoothPanel } from "./panels/smooth-panel";
import { BUPanel } from "./panels/bu-panel";
import { StagehandPanel } from "./panels/stagehand-panel";

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
            <div className="h-full flex items-center justify-center bg-gray-100 dark:bg-black border-gray-200 dark:border-gray-800">
                <div className="text-center p-6">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-900 dark:border-gray-700 dark:border-t-white mx-auto mb-3"></div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Waiting for agent...</p>
                </div>
            </div>
        );
    }

    const isCompleted = agent.status === "completed" || agent.status === "failed";
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

    return (
        <div className="h-full flex flex-col bg-white dark:bg-black  overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 dark:border-card/20 dark:bg-background">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor()}`}></div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                        {agent.name}
                    </h3>
                    {agent.model && (
                        <span className="text-xs text-gray-500 dark:text-foreground bg-gray-100 dark:bg-card px-2 py-0.5 rounded">
                            {agent.model}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <span className={`text-xs capitalize ${
                        agent.status === "running" ? "text-blue-600 dark:text-blue-400" :
                        agent.status === "completed" ? "text-green-600 dark:text-green-400" :
                        agent.status === "failed" ? "text-red-600 dark:text-red-400" :
                        "text-gray-500 dark:text-gray-400"
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
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-900 dark:border-gray-700 dark:border-t-white mx-auto mb-3"></div>
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
                                        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                                            <h4 className="text-xs font-medium text-gray-700 dark:text-white mb-2 uppercase tracking-wide">Result</h4>
                                            <pre className="text-xs text-gray-700 dark:text-white whitespace-pre-wrap">
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
