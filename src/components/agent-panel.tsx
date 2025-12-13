"use client";

import { useEffect, useRef, useState } from "react";
import { SmoothPanel } from "./panels/smooth-panel";
import { BUPanel } from "./panels/bu-panel";
import { StagehandPanel } from "./panels/stagehand-panel";
import { NottePanel } from "./panels/notte-panel";
import { BrowserUseLogo } from "./logos/bu";
import { SmoothLogo } from "./logos/smooth";
import { StagehandLogo } from "./logos/stagehand";
import { NotteLogo } from "./logos/notte";
import { XCircle, AlertTriangle } from "lucide-react";

const truncateText = (text: string, maxLength: number = 100): string => {
    if (typeof text !== 'string') return text;
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
};

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
                    {agent.name === "stagehand" && (
                        <StagehandLogo className="h-4 w-4 shrink-0" />
                    )}
                    {agent.name === "notte" && (
                        <NotteLogo className="h-4 w-4 shrink-0" />
                    )}
                    <h3 className="text-sm font-medium capitalize truncate min-w-0" title={agent.name}>
                        {getDisplayName(agent.name)}
                    </h3>
                    {agent.model && (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0 max-w-[120px] truncate" title={agent.model}>
                            {agent.model.replace(/^openrouter\//, '')}
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

                {agent.status === "running" && !displayUrl && (
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center p-6">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-border border-t-foreground mx-auto mb-3"></div>
                            <p className="text-sm text-muted-foreground">Creating session...</p>
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
                                            <p className="text-sm text-red-900 dark:text-red-100 wrap-break-word">
                                                {truncateText(typeof agentResult.error === 'string'
                                                    ? agentResult.error
                                                    : JSON.stringify(agentResult.error, null, 2))}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {agentResult?.message && !agentResult?.error && (
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mt-4 text-left">
                                    <p className="text-sm text-red-900 dark:text-red-100">
                                        {truncateText(agentResult.message)}
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
                                        <a
                                            href={agent.recordingUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="absolute right-3 top-3 rounded-md bg-black/70 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-white hover:bg-black/80"
                                        >
                                            Open Externally
                                        </a>
                                    )}
                                    {!videoError && (
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

                        {agentResult && (
                            <div className="p-4">
                                {agent.name === "smooth" && <SmoothPanel agent={agent} />}
                                {(agent.name === "browser-use" || agent.name === "browser_use" || agent.name === "browser-use-cloud") && <BUPanel agent={agent} />}
                                {agent.name === "stagehand" && <StagehandPanel agent={agent} />}
                                {agent.name === "notte" && <NottePanel agent={agent} />}

                                {!["smooth", "browser-use", "browser_use", "browser-use-cloud", "stagehand", "notte"].includes(agent.name) && (
                                    <div className="space-y-3">
                                        <div className="bg-card rounded-lg p-4">
                                            <h4 className="text-xs font-medium mb-2 uppercase tracking-wide">Result</h4>
                                            <pre className="text-xs whitespace-pre-wrap">
                                                {truncateText(JSON.stringify(agentResult, null, 2))}
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
