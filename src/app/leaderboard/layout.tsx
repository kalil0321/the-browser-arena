import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Browser Agent Leaderboard - ELO Rankings",
    description:
        "Live ELO rankings of AI browser agents. Compare Browser-Use, Stagehand, Notte, and Smooth performance in head-to-head battles.",
};

export default function LeaderboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
