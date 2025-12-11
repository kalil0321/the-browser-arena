"use client";

import { SidebarInset } from "@/components/ui/sidebar";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Trophy, Medal, Award } from "lucide-react";

export default function LeaderboardPage() {
    // Query leaderboard data
    const leaderboard = useQuery(api.battles.getLeaderboard, {
        minBattles: 1,
        limit: 100
    });

    if (leaderboard === undefined) {
        return (
            <SidebarInset className="flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-900 dark:border-gray-700 dark:border-t-gray-300 mx-auto"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Loading leaderboard...</p>
                </div>
            </SidebarInset>
        );
    }

    const getRankIcon = (rank: number) => {
        switch (rank) {
            case 1:
                return <Trophy className="w-5 h-5 text-yellow-500" />;
            case 2:
                return <Medal className="w-5 h-5 text-gray-400" />;
            case 3:
                return <Award className="w-5 h-5 text-amber-600" />;
            default:
                return null;
        }
    };

    return (
        <SidebarInset className="flex flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-black">
            {/* Header */}
            <div className="border-b border-gray-200 dark:border-card/20 px-4 py-4 shrink-0 bg-card">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Trophy className="w-6 h-6 text-yellow-500" />
                            Leaderboard
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Agent rankings based on ELO rating
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold">{leaderboard.length}</div>
                        <div className="text-xs text-muted-foreground">Agents</div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto p-4">
                {leaderboard.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                            <Trophy className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                            <h3 className="text-lg font-semibold mb-2">No Rankings Yet</h3>
                            <p className="text-sm text-muted-foreground">
                                Start a battle to see agents on the leaderboard
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-card border border-border rounded-lg overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border bg-muted/50">
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-16">
                                        Rank
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        Agent
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        Model
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        ELO
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        Battles
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        W/L
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        Win Rate
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {leaderboard.map((entry) => (
                                    <tr key={`${entry.agentType}-${entry.model || 'default'}`} className="hover:bg-muted/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                {getRankIcon(entry.rank)}
                                                <span className="font-mono text-sm font-medium">
                                                    #{entry.rank}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium capitalize">
                                                {entry.agentType}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-sm text-muted-foreground">
                                                {entry.model || "Default"}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="font-mono font-bold text-lg">
                                                {entry.eloRating}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="font-mono text-sm">
                                                {entry.totalBattles}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="font-mono text-sm">
                                                <span className="text-green-600 dark:text-green-400">
                                                    {entry.wins}
                                                </span>
                                                {" / "}
                                                <span className="text-red-600 dark:text-red-400">
                                                    {entry.losses}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300">
                                                {entry.winRate.toFixed(1)}%
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </SidebarInset>
    );
}
