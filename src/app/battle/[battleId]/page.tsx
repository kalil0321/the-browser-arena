"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { SidebarInset } from "@/components/ui/sidebar";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { BattleArena } from "@/components/battle/battle-arena";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Id } from "../../../../convex/_generated/dataModel";

export default function BattlePage() {
    const params = useParams();
    const battleId = params.battleId as string;
    const battleIdConvex = battleId as Id<"battles">;

    const [voteResult, setVoteResult] = useState<any>(null);

    // Query battle data
    const battle = useQuery(api.battles.getBattle, { battleId: battleIdConvex });

    // Loading state
    if (battle === undefined) {
        return (
            <SidebarInset className="flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-900 dark:border-gray-700 dark:border-t-gray-300 mx-auto"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Loading battle...</p>
                </div>
            </SidebarInset>
        );
    }

    // Battle not found
    if (battle === null) {
        return (
            <SidebarInset className="flex items-center justify-center">
                <div className="text-center max-w-md">
                    <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        Battle Not Found
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        This battle doesn't exist or you don't have access to it.
                    </p>
                    <Button asChild>
                        <Link href="/">Go to Home</Link>
                    </Button>
                </div>
            </SidebarInset>
        );
    }

    const handleVote = async (winnerId: string | undefined, voteType: "winner" | "tie" | "both-bad") => {
        try {
            const response = await fetch("/api/battle/vote", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    battleId,
                    winnerId,
                    voteType,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || "Failed to submit vote");
            }

            const result = await response.json();
            setVoteResult(result);

            // No need to reload - Convex query is reactive and will auto-update
        } catch (error) {
            console.error("Vote error:", error);
            throw error;
        }
    };

    return (
        <SidebarInset className="flex flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-black">
            <BattleArena battle={battle} onVote={handleVote} voteResult={voteResult} />
        </SidebarInset>
    );
}
