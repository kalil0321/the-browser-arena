"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface AgentPropertiesDialogProps {
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
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AgentPropertiesDialog({ agent, open, onOpenChange }: AgentPropertiesDialogProps) {
    const isBrowserUse = agent.name === "browser-use" || agent.name === "browser_use" || agent.name === "browser-use-cloud";
    const isStagehand = agent.name === "stagehand" || agent.name === "stagehand-bb-cloud" || agent.name === "stagehand-cloud";
    const isSmooth = agent.name === "smooth";

    // Don't show dialog for smooth
    if (isSmooth) {
        return null;
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="capitalize">
                        {agent.name} Properties
                    </DialogTitle>
                    <DialogDescription>
                        Configure additional settings for this agent
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {isBrowserUse && (
                        <div className="space-y-3">
                            <div>
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                                    Secrets Support
                                </h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                    Browser Use agent supports secrets for secure credential management. 
                                    Secrets can be configured through environment variables or the Browser Use API.
                                </p>
                                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                                    <p className="text-xs text-blue-900 dark:text-blue-100">
                                        <strong>Note:</strong> Secrets are managed through the Browser Use API or 
                                        environment variables. No secrets are stored in this interface.
                                    </p>
                                </div>
                            </div>
                            {agent.model && (
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                                        Model
                                    </h4>
                                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                                        <code className="text-sm text-gray-900 dark:text-gray-100">
                                            {agent.model}
                                        </code>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {isStagehand && (
                        <div className="space-y-3">
                            <div>
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                                    Model Configuration
                                </h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                    Stagehand uses models for both thinking (planning) and execution (action) phases.
                                </p>
                                <div className="space-y-2">
                                    <div>
                                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                                            Thinking Model
                                        </label>
                                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                                            <code className="text-sm text-gray-900 dark:text-gray-100">
                                                {agent.model || "google/gemini-2.5-flash"}
                                            </code>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                Used for reasoning and planning
                                            </p>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                                            Execution Model
                                        </label>
                                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                                            <code className="text-sm text-gray-900 dark:text-gray-100">
                                                {agent.model || "google/gemini-2.5-flash"}
                                            </code>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                Used for executing actions
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-3">
                                    <p className="text-xs text-blue-900 dark:text-blue-100">
                                        <strong>Note:</strong> Currently, both thinking and execution use the same model. 
                                        Support for separate models is coming soon.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
