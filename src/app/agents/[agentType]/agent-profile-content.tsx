"use client";

import { SidebarInset } from "@/components/ui/sidebar";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Trophy, Swords, ArrowRight, TrendingUp, Target, ExternalLink } from "lucide-react";
import Link from "next/link";

interface AgentProfileContentProps {
    agentType: string;
    name: string;
    description: string;
    website: string | null;
}

export function AgentProfileContent({ agentType, name, description, website }: AgentProfileContentProps) {
    const leaderboard = useQuery(api.battles.getLeaderboard, { minBattles: 0, limit: 100 });

    const agentEntries = leaderboard?.filter((e) => e.agentType.includes(agentType)) ?? [];
    const overallStats = agentEntries.reduce(
        (acc, e) => ({
            totalBattles: acc.totalBattles + e.totalBattles,
            wins: acc.wins + e.wins,
            losses: acc.losses + e.losses,
            bestElo: Math.max(acc.bestElo, e.eloRating),
        }),
        { totalBattles: 0, wins: 0, losses: 0, bestElo: 0 }
    );
    const overallWinRate =
        overallStats.totalBattles > 0
            ? (overallStats.wins / overallStats.totalBattles) * 100
            : 0;

    if (leaderboard === undefined) {
        return (
            <SidebarInset className="flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-900 dark:border-gray-700 dark:border-t-gray-300 mx-auto" />
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Loading agent profile...</p>
                </div>
            </SidebarInset>
        );
    }

    return (
        <SidebarInset className="flex flex-1 flex-col overflow-auto bg-gray-50 dark:bg-black">
            {/* Header */}
            <div className="border-b border-gray-200 dark:border-card/20 px-4 py-6 shrink-0 bg-card">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                {name}
                            </h1>
                            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                                {description}
                            </p>
                            {website && (
                                <a
                                    href={website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
                                >
                                    Official Website
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 p-4">
                <div className="max-w-4xl mx-auto space-y-6">
                    {/* Overall Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <StatCard
                            label="Best ELO"
                            value={overallStats.bestElo || 800}
                            icon={<TrendingUp className="w-5 h-5 text-yellow-500" />}
                        />
                        <StatCard
                            label="Total Battles"
                            value={overallStats.totalBattles}
                            icon={<Swords className="w-5 h-5 text-blue-500" />}
                        />
                        <StatCard
                            label="Wins"
                            value={overallStats.wins}
                            icon={<Trophy className="w-5 h-5 text-green-500" />}
                        />
                        <StatCard
                            label="Win Rate"
                            value={`${overallWinRate.toFixed(1)}%`}
                            icon={<Target className="w-5 h-5 text-purple-500" />}
                        />
                    </div>

                    {/* Per-Model Breakdown */}
                    {agentEntries.length > 0 && (
                        <div className="bg-card border border-border rounded-lg p-6">
                            <h2 className="text-lg font-semibold mb-4">Performance by Model</h2>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-border">
                                            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                                                Model
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                                                ELO
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                                                Battles
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                                                W/L
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                                                Win Rate
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {agentEntries
                                            .sort((a, b) => b.eloRating - a.eloRating)
                                            .map((entry) => (
                                                <tr
                                                    key={`${entry.agentType}-${entry.model || "default"}`}
                                                    className="hover:bg-muted/50 transition-colors"
                                                >
                                                    <td className="px-4 py-3 text-sm font-medium">
                                                        {entry.model || "Default"}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono font-bold">
                                                        {entry.eloRating}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-sm">
                                                        {entry.totalBattles}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-sm">
                                                        <span className="text-green-600 dark:text-green-400">
                                                            {entry.wins}
                                                        </span>
                                                        {" / "}
                                                        <span className="text-red-600 dark:text-red-400">
                                                            {entry.losses}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300">
                                                            {entry.winRate.toFixed(1)}%
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {agentEntries.length === 0 && (
                        <div className="bg-card border border-border rounded-lg p-6 text-center">
                            <Swords className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                            <h3 className="font-semibold mb-1">No battle data yet</h3>
                            <p className="text-sm text-muted-foreground">
                                {name} hasn't participated in any battles yet. Start one below!
                            </p>
                        </div>
                    )}

                    {/* CTA */}
                    <div className="bg-card border border-border rounded-lg p-6 text-center">
                        <h2 className="text-lg font-semibold mb-2">Test {name} yourself</h2>
                        <p className="text-sm text-muted-foreground mb-4">
                            Start a battle and see how {name} performs against other agents on your task.
                        </p>
                        <Link
                            href="/?mode=battle"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
                        >
                            Start a Battle
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </div>
        </SidebarInset>
    );
}

function StatCard({
    label,
    value,
    icon,
}: {
    label: string;
    value: string | number;
    icon: React.ReactNode;
}) {
    return (
        <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
                {icon}
                <span className="text-xs text-muted-foreground uppercase font-medium">{label}</span>
            </div>
            <div className="text-2xl font-bold font-mono">{value}</div>
        </div>
    );
}
