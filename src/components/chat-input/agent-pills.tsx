"use client";

import { AgentConfig, AGENT_LABELS } from "./types";
import { formatModelName, getShortModelName } from "./helpers";
import { cn } from "@/lib/utils";

interface AgentPillsProps {
    agentConfigs: AgentConfig[];
    onConfigClick: (config: AgentConfig) => void;
    isLoading?: boolean;
}

export function AgentPills({
    agentConfigs,
    onConfigClick,
    isLoading = false
}: AgentPillsProps) {
    return (
        <>
            {agentConfigs.filter(c => c.agent !== "smooth").map((config, index) => {
                const hasProperties = config.agent !== "smooth";
                const { provider } = formatModelName(config.model);
                const shortModelName = getShortModelName(config.model);
                const tooltipText = `${AGENT_LABELS[config.agent]} - ${config.model}${hasProperties ? " (Click to configure)" : ""}`;

                return (
                    <button
                        key={`${config.agent}-${index}-${config.model}`}
                        type="button"
                        onClick={() => hasProperties && onConfigClick({ ...config, id: config.id || `agent-${index}-${Date.now()}` })}
                        disabled={isLoading || !hasProperties}
                        className={cn(
                            "h-8 sm:h-6 px-2.5 sm:px-2 py-1.5 sm:py-0 text-[11px] sm:text-[10px] rounded-full flex items-center gap-1.5 sm:gap-1 shrink-0 touch-manipulation min-w-[44px] sm:min-w-0",
                            hasProperties
                                ? "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 active:bg-zinc-300 dark:active:bg-zinc-600"
                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 cursor-default",
                            isLoading && "opacity-50 cursor-not-allowed"
                        )}
                        title={tooltipText}
                    >
                        <span className="capitalize whitespace-nowrap">{AGENT_LABELS[config.agent]}</span>
                        <span className="text-[10px] sm:text-[9px] text-muted-foreground">•</span>
                        <span className="text-[10px] sm:text-[9px] truncate max-w-[80px] sm:max-w-[60px]">{shortModelName}</span>
                        {hasProperties && (
                            <svg className="w-3.5 h-3.5 sm:w-3 sm:h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        )}
                    </button>
                );
            })}
        </>
    );
}

