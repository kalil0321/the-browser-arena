import { CheckCircle2, XCircle, Globe, Eye, Brain, Play, Square, AlertCircle, ExternalLink } from "lucide-react";

interface NottePanelProps {
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

const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
});

const formatCurrency = (value?: number) => {
    if (typeof value !== "number" || Number.isNaN(value)) {
        return "—";
    }
    return currencyFormatter.format(value);
};

const formatDuration = (seconds?: number) => {
    if (typeof seconds !== "number" || Number.isNaN(seconds)) {
        return "—";
    }
    if (seconds < 1) {
        return `${(seconds * 1000).toFixed(0)}ms`;
    }
    return `${seconds.toFixed(1)}s`;
};

interface StepComponentProps {
    step: Record<string, any>;
    index: number;
}

function StepComponent({ step, index }: StepComponentProps) {
    const stepType = step.type;
    const value = step.value || {};

    if (stepType === "agent_step_start") {
        const stepNumber = value.step_number ?? index;
        return (
            <div className="border-l-2 border-border pl-3 py-2">
                <div className="flex items-center gap-2">
                    <Play className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs font-semibold text-foreground">
                        Step {stepNumber} Started
                    </span>
                </div>
            </div>
        );
    }

    if (stepType === "agent_step_stop") {
        const stepNumber = value.step_number ?? index;
        return (
            <div className="border-l-2 border-border pl-3 py-2">
                <div className="flex items-center gap-2">
                    <Square className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground">
                        Step {stepNumber} Completed
                    </span>
                </div>
            </div>
        );
    }

    if (stepType === "observation") {
        const metadata = value.metadata || {};
        const space = value.space || {};
        const url = metadata.url;
        const title = metadata.title;
        const viewport = metadata.viewport || {};

        return (
            <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
                <div className="flex items-center gap-2">
                    <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-foreground">Observation</span>
                </div>
                {url && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Globe className="w-3 h-3" />
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline flex items-center gap-1"
                        >
                            {title || url}
                            <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                    </div>
                )}
                {viewport.viewport_width && (
                    <div className="text-xs text-muted-foreground">
                        Viewport: {viewport.viewport_width} × {viewport.viewport_height}
                        {viewport.total_width > 0 && (
                            <span className="ml-2">
                                (Page: {viewport.total_width} × {viewport.total_height})
                            </span>
                        )}
                    </div>
                )}
                {space.description && (
                    <div className="mt-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded max-h-32 overflow-y-auto">
                        <div className="whitespace-pre-wrap font-mono text-[10px] leading-relaxed">
                            {space.description.substring(0, 500)}
                            {space.description.length > 500 && "..."}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (stepType === "agent_completion") {
        const action = value.action || {};
        const state = value.state || {};
        const actionType = action.type;

        return (
            <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
                <div className="flex items-center gap-2">
                    <Brain className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-foreground">Agent Decision</span>
                </div>

                {actionType === "goto" && action.url && (
                    <div className="text-xs">
                        <span className="font-medium">Action:</span> Navigate to{" "}
                        <a
                            href={action.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-foreground hover:underline inline-flex items-center gap-1"
                        >
                            {action.url}
                            <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                    </div>
                )}

                {actionType === "scrape" && (
                    <div className="text-xs space-y-1">
                        <div>
                            <span className="font-medium">Action:</span> Scrape page content
                        </div>
                        {action.instructions && (
                            <div className="text-muted-foreground italic">
                                "{action.instructions}"
                            </div>
                        )}
                        {action.only_main_content && (
                            <div className="text-muted-foreground text-[10px]">
                                (Main content only)
                            </div>
                        )}
                    </div>
                )}

                {actionType === "completion" && (
                    <div className="text-xs space-y-1">
                        <div>
                            <span className="font-medium">Action:</span> Complete task
                        </div>
                        {action.answer && (
                            <div className="bg-white dark:bg-black/30 p-2 rounded mt-1 text-xs">
                                {action.answer}
                            </div>
                        )}
                        {typeof action.success === "boolean" && (
                            <div className="flex items-center gap-1.5 mt-1">
                                {action.success ? (
                                    <CheckCircle2 className="w-3 h-3 text-muted-foreground" />
                                ) : (
                                    <XCircle className="w-3 h-3 text-muted-foreground" />
                                )}
                                <span className="text-muted-foreground">
                                    {action.success ? "Success" : "Failed"}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {state.next_goal && (
                    <div className="mt-2 pt-2 border-t border-border">
                        <div className="text-[10px] font-medium text-muted-foreground mb-1">Next Goal:</div>
                        <div className="text-xs text-foreground">{state.next_goal}</div>
                    </div>
                )}

                {state.memory && (
                    <div className="mt-2 pt-2 border-t border-border">
                        <div className="text-[10px] font-medium text-muted-foreground mb-1">Memory:</div>
                        <div className="text-xs text-muted-foreground">{state.memory}</div>
                    </div>
                )}

                {state.page_summary && state.page_summary !== "No page content available yet." && (
                    <div className="mt-2 pt-2 border-t border-border">
                        <div className="text-[10px] font-medium text-muted-foreground mb-1">Page Summary:</div>
                        <div className="text-xs text-muted-foreground">{state.page_summary}</div>
                    </div>
                )}
            </div>
        );
    }

    if (stepType === "execution_result") {
        const action = value.action || {};
        const success = value.success;
        const message = value.message;
        const exception = value.exception;
        const data = value.data;

        return (
            <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {success ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                            <XCircle className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                        <span className="text-xs font-semibold text-foreground">
                            Execution Result
                        </span>
                    </div>
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                        {success ? "Success" : "Failed"}
                    </span>
                </div>

                {message && (
                    <div className="text-xs text-foreground">{message}</div>
                )}

                {exception && (
                    <div className="text-xs text-foreground bg-muted/50 p-2 rounded">
                        {typeof exception === "string" ? exception : JSON.stringify(exception, null, 2)}
                    </div>
                )}

                {data && action.type === "scrape" && data.structured && (
                    <div className="mt-2 pt-2 border-t space-y-2">
                        {data.structured.success && data.structured.data && (
                            <div className="space-y-1">
                                {data.structured.data.description && (
                                    <div className="text-xs">
                                        <span className="font-medium">Description:</span>{" "}
                                        <span className="text-muted-foreground">{data.structured.data.description}</span>
                                    </div>
                                )}
                                {data.structured.data.features && Array.isArray(data.structured.data.features) && (
                                    <div className="text-xs">
                                        <span className="font-medium">Features:</span>
                                        <ul className="list-disc list-inside ml-2 mt-1 text-muted-foreground space-y-0.5">
                                            {data.structured.data.features.slice(0, 5).map((feature: string, idx: number) => (
                                                <li key={idx} className="text-[10px]">{feature}</li>
                                            ))}
                                            {data.structured.data.features.length > 5 && (
                                                <li className="text-[10px] italic">... and {data.structured.data.features.length - 5} more</li>
                                            )}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                        {data.markdown && (
                            <details className="mt-2">
                                <summary className="text-[10px] font-medium text-muted-foreground cursor-pointer hover:text-foreground">
                                    View Markdown Content
                                </summary>
                                <div className="mt-2 text-xs bg-muted/50 p-2 rounded max-h-40 overflow-y-auto">
                                    <pre className="whitespace-pre-wrap font-mono text-[10px] leading-relaxed">
                                        {data.markdown.substring(0, 1000)}
                                        {data.markdown.length > 1000 && "..."}
                                    </pre>
                                </div>
                            </details>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // Fallback for unknown step types
    return (
        <div className="border rounded-lg p-3 bg-muted/30">
            <div className="flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">
                    {stepType || "Unknown Step"}
                </span>
            </div>
            <pre className="text-[10px] text-muted-foreground mt-2 overflow-x-auto">
                {JSON.stringify(value, null, 2).substring(0, 200)}
                {JSON.stringify(value, null, 2).length > 200 && "..."}
            </pre>
        </div>
    );
}

export function NottePanel({ agent }: NottePanelProps) {
    const result = (agent.result as Record<string, any>) ?? {};
    const usage = (result.usage as Record<string, any>) ?? {};
    const steps = Array.isArray(result.steps) ? result.steps : [];
    const success = typeof result.success === "boolean" ? result.success : undefined;
    const answer = typeof result.answer === "string" ? result.answer : null;
    const duration = typeof result.duration === "number" ? result.duration : null;
    const task = typeof result.task === "string" ? result.task : null;
    const metadata = result.metadata || {};
    const status = result.status || "unknown";

    // Calculate actual step count (excluding start/stop markers)
    const actualSteps = steps.filter((step: any) => {
        const stepType = step?.type;
        return stepType && !["agent_step_start", "agent_step_stop"].includes(stepType);
    });

    // Group steps by agent step number
    const groupedSteps: Array<{ stepNumber: number; steps: any[] }> = [];
    let currentStep: any[] = [];
    let currentStepNumber = -1;

    steps.forEach((step: any) => {
        if (step?.type === "agent_step_start") {
            if (currentStep.length > 0) {
                groupedSteps.push({ stepNumber: currentStepNumber, steps: currentStep });
            }
            currentStep = [];
            currentStepNumber = step?.value?.step_number ?? groupedSteps.length;
        } else if (step?.type === "agent_step_stop") {
            if (currentStep.length > 0) {
                groupedSteps.push({ stepNumber: currentStepNumber, steps: currentStep });
                currentStep = [];
            }
        } else {
            currentStep.push(step);
        }
    });
    if (currentStep.length > 0) {
        groupedSteps.push({ stepNumber: currentStepNumber, steps: currentStep });
    }

    return (
        <div className="space-y-4">
            {/* Task */}
            {task && (
                <div className="bg-card rounded-lg border p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                        Task
                    </p>
                    <p className="text-sm text-foreground">{task}</p>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid gap-3 sm:grid-cols-3">
                <div className="bg-card rounded-lg border p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Cost
                    </p>
                    <p className="text-base font-medium mt-1">
                        {usage.total_cost !== undefined ? formatCurrency(usage.total_cost) : "—"}
                    </p>
                </div>
                <div className="bg-card rounded-lg border p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Steps
                    </p>
                    <p className="text-base font-medium mt-1">
                        {usage.steps ?? actualSteps.length}
                    </p>
                </div>
                {duration !== null && (
                    <div className="bg-card rounded-lg border p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Duration
                        </p>
                        <p className="text-base font-medium mt-1">
                            {formatDuration(duration)}
                        </p>
                    </div>
                )}
            </div>

            {/* Final Answer */}
            {answer && (
                <div className="bg-card rounded-lg border p-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        Final Answer
                    </h4>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground">{answer}</p>
                </div>
            )}

            {/* Steps */}
            {groupedSteps.length > 0 && (
                <div className="bg-card rounded-lg border p-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                        Execution Steps ({groupedSteps.length})
                    </h4>
                    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                        {groupedSteps.map((group, groupIndex) => (
                            <div key={groupIndex} className="space-y-2">
                                {groupedSteps.length > 1 && (
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="h-px flex-1 bg-border" />
                                        <span className="text-xs font-semibold text-muted-foreground px-2">
                                            Agent Step {group.stepNumber}
                                        </span>
                                        <div className="h-px flex-1 bg-border" />
                                    </div>
                                )}
                                <div className="space-y-2">
                                    {group.steps.map((step, stepIndex) => (
                                        <StepComponent key={stepIndex} step={step} index={stepIndex} />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Metadata */}
            {(metadata.sessionId || metadata.agentId) && (
                <div className="bg-card rounded-lg border p-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        Metadata
                    </h4>
                    <div className="space-y-1 text-xs">
                        {metadata.sessionId && (
                            <div>
                                <span className="text-muted-foreground">Session ID:</span>{" "}
                                <span className="font-mono text-[10px]">{metadata.sessionId}</span>
                            </div>
                        )}
                        {metadata.agentId && (
                            <div>
                                <span className="text-muted-foreground">Agent ID:</span>{" "}
                                <span className="font-mono text-[10px]">{metadata.agentId}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}


