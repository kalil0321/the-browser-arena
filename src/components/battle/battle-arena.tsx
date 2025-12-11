"use client";

import { useState, useEffect } from "react";
import { BattleAgentPanel } from "./battle-agent-panel";
import { Button } from "@/components/ui/button";
import { Trophy, ArrowUp, ArrowDown, Copy, Check } from "lucide-react";

interface Agent {
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
}

interface Battle {
    _id: string;
    userId: string;
    instruction: string;
    status: "pending" | "running" | "completed" | "voted" | "failed";
    agentAId: string;
    agentBId: string;
    sameFramework: boolean;
    winnerId?: string;
    votedAt?: number;
    agentAEloChange?: number;
    agentBEloChange?: number;
    createdAt: number;
    updatedAt: number;
    completedAt?: number;
    agentA?: Agent;
    agentB?: Agent;
    isOwner?: boolean;
}

interface BattleArenaProps {
    battle: Battle;
    onVote: (winnerId: string | undefined, voteType: "winner" | "tie" | "both-bad") => Promise<void>;
    voteResult?: {
        voteType?: "winner" | "tie" | "both-bad";
        agentA: {
            name: string;
            model?: string;
            oldRating: number;
            newRating: number;
            eloChange: number;
            won: boolean;
        };
        agentB: {
            name: string;
            model?: string;
            oldRating: number;
            newRating: number;
            eloChange: number;
            won: boolean;
        };
    };
}

export function BattleArena({ battle, onVote, voteResult }: BattleArenaProps) {
    const [selectedVote, setSelectedVote] = useState<{
        type: "winner" | "tie" | "both-bad";
        winnerId?: string;
    } | null>(null);
    const [isVoting, setIsVoting] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [votingEnabled, setVotingEnabled] = useState(false);

    // Determine battle state
    const hasVoted = battle.status === "voted" || !!battle.winnerId;
    const agentACompleted = battle.agentA?.status === "completed";
    const agentBCompleted = battle.agentB?.status === "completed";
    const anyCompleted = agentACompleted || agentBCompleted;
    const bothCompleted = agentACompleted && agentBCompleted;
    const hideIdentities = !hasVoted;

    // Show outputs as soon as each agent completes (first come first served)
    const showAgentAOutput = battle.agentA?.status === "completed";
    const showAgentBOutput = battle.agentB?.status === "completed";

    // Start countdown when first agent completes, skip if both completed
    useEffect(() => {
        if (!anyCompleted || hasVoted) {
            return;
        }

        // If both completed, enable voting immediately
        if (bothCompleted) {
            setVotingEnabled(true);
            setCountdown(null);
            return;
        }

        // If only one completed, start countdown
        if (countdown === null && !votingEnabled) {
            setCountdown(5);
        }
    }, [anyCompleted, bothCompleted, hasVoted, countdown, votingEnabled]);

    // Countdown timer - also checks if both agents complete during countdown
    useEffect(() => {
        // If both completed, immediately enable voting and stop countdown
        if (bothCompleted && !hasVoted) {
            setVotingEnabled(true);
            setCountdown(null);
            return;
        }

        if (countdown === null || countdown <= 0) {
            return;
        }

        const timer = setTimeout(() => {
            const newCount = countdown - 1;
            if (newCount <= 0) {
                setCountdown(null);
                setVotingEnabled(true);
            } else {
                setCountdown(newCount);
            }
        }, 1000);

        return () => clearTimeout(timer);
    }, [countdown, bothCompleted, hasVoted]);

    // Reset voting state when battle changes
    useEffect(() => {
        if (!anyCompleted) {
            setCountdown(null);
            setVotingEnabled(false);
        }
    }, [anyCompleted]);

    const canVote = anyCompleted && !hasVoted && battle.isOwner && votingEnabled;

    const handleVote = async () => {
        if (!selectedVote || isVoting) return;

        setIsVoting(true);
        try {
            await onVote(selectedVote.winnerId, selectedVote.type);
        } catch (error) {
            console.error("Vote failed:", error);
            alert("Failed to submit vote. Please try again.");
        } finally {
            setIsVoting(false);
        }
    };

    const handleCopyInstruction = () => {
        if (battle?.instruction) {
            navigator.clipboard.writeText(battle.instruction);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }
    };

    const agents = [battle.agentA, battle.agentB].filter(Boolean);
    const completedCount = agents.filter(a => a?.status === "completed").length;

    return (
        <div className="h-full flex flex-col">
            {/* Header - matches session page style */}
            <div className="border-b border-gray-200 dark:border-card/20 px-3 py-3 sm:px-4 sm:py-4 shrink-0">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <div className="flex items-start gap-2 group">
                            <h1 className="text-base sm:text-lg font-default font-medium text-gray-900 dark:text-gray-100 break-words flex-1" title={battle.instruction}>
                                {battle.instruction && battle.instruction.length > 100
                                    ? battle.instruction.substring(0, 100) + '...'
                                    : battle.instruction}
                            </h1>
                            <button
                                onClick={handleCopyInstruction}
                                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                                title={isCopied ? "Copied!" : "Copy instruction"}
                            >
                                {isCopied ? (
                                    <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                                ) : (
                                    <Copy className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                )}
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">
                                Created {new Date(battle.createdAt).toLocaleDateString(undefined, {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </p>
                            {battle.status === "voted" && (
                                <span className="text-[11px] sm:text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300">
                                    Voted
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                        {agents.length > 0 && (
                            <div className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                {completedCount} / {agents.length} completed
                            </div>
                        )}
                        {battle.status === "running" && (
                            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-blue-600 dark:text-blue-400">
                                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                                <span className="hidden sm:inline">Battle in progress</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Agent Panels - Grid layout matching session page */}
            <div className="flex-1 overflow-auto">
                <div className="h-full">
                    <div className="grid grid-cols-1 md:grid-cols-2 h-full">
                        {/* Agent A */}
                        <div className="min-h-[400px]">
                            <BattleAgentPanel
                                agent={battle.agentA || null}
                                label="Agent A"
                                hideIdentity={hideIdentities}
                                showBrowserView={battle.sameFramework && (battle.agentA?.status === "running")}
                                showOutput={showAgentAOutput}
                                sameFramework={battle.sameFramework}
                                anyCompleted={anyCompleted}
                            />
                        </div>

                        {/* Agent B */}
                        <div className="min-h-[400px]">
                            <BattleAgentPanel
                                agent={battle.agentB || null}
                                label="Agent B"
                                hideIdentity={hideIdentities}
                                showBrowserView={battle.sameFramework && (battle.agentB?.status === "running")}
                                showOutput={showAgentBOutput}
                                sameFramework={battle.sameFramework}
                                anyCompleted={anyCompleted}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Countdown Indicator */}
            {anyCompleted && !hasVoted && battle.isOwner && countdown !== null && countdown > 0 && (
                <div className="border-t border-gray-200 dark:border-card/20 px-3 py-3 sm:px-4 sm:py-4 shrink-0 bg-blue-50/50 dark:bg-blue-900/10">
                    <div className="max-w-3xl mx-auto">
                        <div className="flex items-center justify-center gap-3 text-blue-700 dark:text-blue-300">
                            <div className="flex items-center gap-2">
                                <div className="relative w-8 h-8">
                                    <svg className="w-8 h-8 transform -rotate-90">
                                        <circle
                                            cx="16"
                                            cy="16"
                                            r="14"
                                            stroke="currentColor"
                                            strokeWidth="3"
                                            fill="none"
                                            className="opacity-20"
                                        />
                                        <circle
                                            cx="16"
                                            cy="16"
                                            r="14"
                                            stroke="currentColor"
                                            strokeWidth="3"
                                            fill="none"
                                            strokeDasharray={`${(countdown / 5) * 88} 88`}
                                            className="transition-all duration-1000"
                                        />
                                    </svg>
                                    <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
                                        {countdown}
                                    </span>
                                </div>
                                <span className="text-sm font-medium">
                                    {!bothCompleted ? "One agent completed. " : "Both agents completed. "}
                                    Voting enabled in {countdown}s...
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Voting Section - only shows when can vote */}
            {canVote && (
                <div className="border-t border-gray-200 dark:border-card/20 px-3 py-3 sm:px-4 sm:py-4 shrink-0 bg-muted/30">
                    <div className="max-w-3xl mx-auto">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="text-sm font-medium text-muted-foreground flex-shrink-0">Vote:</div>
                            <div className="flex-1 flex items-center gap-2">
                                <button
                                    onClick={() => setSelectedVote({ type: "winner", winnerId: battle.agentAId })}
                                    className={`flex-1 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                                        selectedVote?.type === "winner" && selectedVote?.winnerId === battle.agentAId
                                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                                            : "border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600"
                                    }`}
                                >
                                    Agent A
                                </button>
                                <button
                                    onClick={() => setSelectedVote({ type: "winner", winnerId: battle.agentBId })}
                                    className={`flex-1 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                                        selectedVote?.type === "winner" && selectedVote?.winnerId === battle.agentBId
                                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                                            : "border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600"
                                    }`}
                                >
                                    Agent B
                                </button>
                                <button
                                    onClick={() => setSelectedVote({ type: "tie" })}
                                    className={`px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                                        selectedVote?.type === "tie"
                                            ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                                            : "border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600"
                                    }`}
                                >
                                    Tie
                                </button>
                                <button
                                    onClick={() => setSelectedVote({ type: "both-bad" })}
                                    className={`px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                                        selectedVote?.type === "both-bad"
                                            ? "border-gray-500 bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300"
                                            : "border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600"
                                    }`}
                                >
                                    Pass
                                </button>
                            </div>
                            <Button
                                onClick={handleVote}
                                disabled={!selectedVote || isVoting}
                                size="sm"
                                className="flex-shrink-0"
                            >
                                {isVoting ? "..." : "Submit"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Vote Results - compact version matching session page style */}
            {hasVoted && voteResult && (
                <div className="border-t border-gray-200 dark:border-card/20 px-3 py-3 sm:px-4 sm:py-4 shrink-0 bg-muted/30">
                    <div className="max-w-3xl mx-auto">
                        <h3 className="text-sm sm:text-base font-semibold mb-3 text-center">
                            {voteResult.voteType === "tie" && "Battle Results - Tie 🤝"}
                            {voteResult.voteType === "both-bad" && "Battle Results - Passed ⏭️"}
                            {voteResult.voteType === "winner" && "Battle Results 🏆"}
                        </h3>
                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                            {/* Agent A Results */}
                            <div className={`p-3 sm:p-4 rounded-lg border-2 ${
                                voteResult.voteType === "both-bad"
                                    ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                                    : voteResult.agentA.won
                                        ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                                        : "border-gray-300 dark:border-gray-700"
                                }`}>
                                <div className="text-center">
                                    {voteResult.agentA.won && voteResult.voteType !== "both-bad" && (
                                        <div className="mb-2">
                                            <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500 mx-auto" />
                                        </div>
                                    )}
                                    <div className="text-sm sm:text-base font-bold mb-1">{voteResult.agentA.name}</div>
                                    {voteResult.agentA.model && (
                                        <div className="text-[10px] sm:text-xs text-muted-foreground mb-2 truncate">{voteResult.agentA.model}</div>
                                    )}
                                    <div className="text-xs sm:text-sm space-y-1">
                                        <div className="flex items-center justify-center gap-1">
                                            <span className="text-muted-foreground">ELO:</span>
                                            <span className="font-mono">{voteResult.agentA.oldRating}</span>
                                            <span className="mx-0.5">→</span>
                                            <span className="font-mono font-bold">{voteResult.agentA.newRating}</span>
                                        </div>
                                        <div className={`flex items-center justify-center gap-1 ${voteResult.agentA.eloChange >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                            {voteResult.agentA.eloChange >= 0 ? <ArrowUp className="w-3 h-3 sm:w-4 sm:h-4" /> : <ArrowDown className="w-3 h-3 sm:w-4 sm:h-4" />}
                                            <span className="font-mono font-bold">
                                                {voteResult.agentA.eloChange >= 0 ? "+" : ""}{voteResult.agentA.eloChange}
                                            </span>
                                        </div>
                                        {battle.agentA?.result?.usage?.total_cost !== undefined && (
                                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                                <div className="flex items-center justify-center gap-1 text-muted-foreground">
                                                    <span className="text-[10px] sm:text-xs">Cost:</span>
                                                    <span className="font-mono text-[10px] sm:text-xs font-semibold">${battle.agentA.result.usage.total_cost.toFixed(4)}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Agent B Results */}
                            <div className={`p-3 sm:p-4 rounded-lg border-2 ${
                                voteResult.voteType === "both-bad"
                                    ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                                    : voteResult.agentB.won
                                        ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                                        : "border-gray-300 dark:border-gray-700"
                                }`}>
                                <div className="text-center">
                                    {voteResult.agentB.won && voteResult.voteType !== "both-bad" && (
                                        <div className="mb-2">
                                            <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500 mx-auto" />
                                        </div>
                                    )}
                                    <div className="text-sm sm:text-base font-bold mb-1">{voteResult.agentB.name}</div>
                                    {voteResult.agentB.model && (
                                        <div className="text-[10px] sm:text-xs text-muted-foreground mb-2 truncate">{voteResult.agentB.model}</div>
                                    )}
                                    <div className="text-xs sm:text-sm space-y-1">
                                        <div className="flex items-center justify-center gap-1">
                                            <span className="text-muted-foreground">ELO:</span>
                                            <span className="font-mono">{voteResult.agentB.oldRating}</span>
                                            <span className="mx-0.5">→</span>
                                            <span className="font-mono font-bold">{voteResult.agentB.newRating}</span>
                                        </div>
                                        <div className={`flex items-center justify-center gap-1 ${voteResult.agentB.eloChange >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                            {voteResult.agentB.eloChange >= 0 ? <ArrowUp className="w-3 h-3 sm:w-4 sm:h-4" /> : <ArrowDown className="w-3 h-3 sm:w-4 sm:h-4" />}
                                            <span className="font-mono font-bold">
                                                {voteResult.agentB.eloChange >= 0 ? "+" : ""}{voteResult.agentB.eloChange}
                                            </span>
                                        </div>
                                        {battle.agentB?.result?.usage?.total_cost !== undefined && (
                                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                                <div className="flex items-center justify-center gap-1 text-muted-foreground">
                                                    <span className="text-[10px] sm:text-xs">Cost:</span>
                                                    <span className="font-mono text-[10px] sm:text-xs font-semibold">${battle.agentB.result.usage.total_cost.toFixed(4)}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Total Cost Summary */}
                        {(battle.agentA?.result?.usage?.total_cost !== undefined || battle.agentB?.result?.usage?.total_cost !== undefined) && (
                            <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 text-center">
                                <div className="text-[10px] sm:text-xs text-muted-foreground mb-1">Total Cost</div>
                                <div className="text-sm sm:text-base font-bold font-mono text-foreground">
                                    ${((battle.agentA?.result?.usage?.total_cost || 0) + (battle.agentB?.result?.usage?.total_cost || 0)).toFixed(4)}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
