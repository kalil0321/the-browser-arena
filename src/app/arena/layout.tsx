import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Arena - Live Browser Agent Sessions",
    description:
        "Watch AI browser agents complete tasks in real-time. Compare performance, speed, and cost across Browser-Use, Stagehand, Notte, and Smooth.",
};

export default function ArenaLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
