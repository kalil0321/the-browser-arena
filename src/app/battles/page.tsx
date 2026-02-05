"use client";

import { SidebarInset } from "@/components/ui/sidebar";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";
import { Trophy, Calendar, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import type { Id, Doc } from "../../../convex/_generated/dataModel";

const PAGE_SIZE = 25;

type BattleRow = Doc<"battles">;

export default function BattlesPage() {
    const [cursor, setCursor] = useState<string | null>(null);
    const [allBattles, setAllBattles] = useState<BattleRow[]>([]);

    // Battles-only query for 2-step loading (fast initial render)
    const paginatedData = useQuery(api.battles.getBattlesPaginated, {
        paginationOpts: {
            numItems: PAGE_SIZE,
            cursor: cursor,
        },
    });

    // Query for stats
    const statsData = useQuery(api.battles.getBattleStatsOptimized);

    // Combine paginated results
    const { battles, canLoadMore, isDoneLoading } = useMemo(() => {
        if (!paginatedData) {
            return {
                battles: allBattles,
                canLoadMore: false,
                isDoneLoading: false,
            };
        }

        const currentBattles = cursor === null
            ? paginatedData.page
            : [...allBattles, ...paginatedData.page];

        return {
            battles: currentBattles,
            canLoadMore: !paginatedData.isDone,
            isDoneLoading: paginatedData.isDone,
        };
    }, [paginatedData, allBattles, cursor]);

    // Handle load more
    const handleLoadMore = () => {
        if (paginatedData && paginatedData.continueCursor) {
            setAllBattles(battles);
            setCursor(paginatedData.continueCursor);
        }
    };

    const isLoading = paginatedData === undefined;

    if (isLoading && battles.length === 0) {
        return (
            <SidebarInset className="flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-900 dark:border-gray-700 dark:border-t-gray-300 mx-auto"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Loading battles...</p>
                </div>
            </SidebarInset>
        );
    }

    return (
        <SidebarInset className="flex flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-black">
            {/* Header */}
            <div className="border-b border-gray-200 dark:border-card/20 px-4 py-4 shrink-0 bg-card">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Trophy className="w-6 h-6 text-blue-500" />
                            All Battles
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Browse past agent battles and results
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold">
                            {statsData?.totalVotedBattles ?? battles.length}
                        </div>
                        <div className="text-xs text-muted-foreground">Battles</div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto p-4">
                {battles.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                            <Trophy className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                            <h3 className="text-lg font-semibold mb-2">No Battles Yet</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Start a battle to see results here
                            </p>
                            <Link
                                href="/?mode=battle"
                                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                Start a Battle →
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="bg-card border border-border rounded-lg overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border bg-muted/50">
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        Instruction
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        Agent A
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        Agent B
                                    </th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        Winner
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        Date
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {battles.map((battle: BattleRow) => (
                                    <BattleRowComponent key={battle._id} battle={battle} />
                                ))}
                            </tbody>
                        </table>

                        {/* Load More Button */}
                        {canLoadMore && (
                            <div className="flex justify-center py-4 border-t border-border">
                                <Button
                                    variant="outline"
                                    onClick={handleLoadMore}
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="size-4 animate-spin mr-2" />
                                            Loading...
                                        </>
                                    ) : (
                                        "Load More Battles"
                                    )}
                                </Button>
                            </div>
                        )}

                        {isDoneLoading && battles.length > 0 && (
                            <div className="flex justify-center py-4 border-t border-border text-sm text-muted-foreground">
                                All battles loaded
                            </div>
                        )}
                    </div>
                )}
            </div>
        </SidebarInset>
    );
}

// Battle row with 2-step loading - agents are fetched separately
function BattleRowComponent({ battle }: { battle: BattleRow }) {
    // Fetch agents for this battle (2-step loading)
    const agents = useQuery(api.battles.getBattleAgents, {
        battleId: battle._id,
    });

    return (
        <tr
            className="hover:bg-muted/50 transition-colors cursor-pointer"
            onClick={() => window.location.href = `/battle/${battle._id}`}
        >
            <td className="px-4 py-3">
                <div className="max-w-md">
                    <div className="text-sm font-medium truncate">
                        {battle.instruction}
                    </div>
                </div>
            </td>
            <td className="px-4 py-3">
                {agents === undefined ? (
                    <span className="text-xs text-muted-foreground">Loading...</span>
                ) : (
                    <div className="text-sm">
                        <div className="font-medium capitalize">
                            {agents?.agentA?.name || "Unknown"}
                        </div>
                        {agents?.agentA?.model && (
                            <div className="text-xs text-muted-foreground truncate max-w-[120px]" title={agents.agentA.model}>
                                {agents.agentA.model}
                            </div>
                        )}
                    </div>
                )}
            </td>
            <td className="px-4 py-3">
                {agents === undefined ? (
                    <span className="text-xs text-muted-foreground">Loading...</span>
                ) : (
                    <div className="text-sm">
                        <div className="font-medium capitalize">
                            {agents?.agentB?.name || "Unknown"}
                        </div>
                        {agents?.agentB?.model && (
                            <div className="text-xs text-muted-foreground truncate max-w-[120px]" title={agents.agentB.model}>
                                {agents.agentB.model}
                            </div>
                        )}
                    </div>
                )}
            </td>
            <td className="px-4 py-3 text-center">
                {agents === undefined ? (
                    <span className="text-xs text-muted-foreground">...</span>
                ) : agents?.winner ? (
                    <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300">
                        <Trophy className="w-3 h-3" />
                        {agents.winner.name === agents.agentA?.name ? "Agent A" : "Agent B"}
                    </div>
                ) : (
                    <span className="text-xs text-muted-foreground">No winner</span>
                )}
            </td>
            <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {new Date(battle.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                    })}
                </div>
            </td>
        </tr>
    );
}
