import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Battle History",
    description:
        "Watch AI browser agents compete head-to-head. See battle results, vote for winners, and track ELO rating changes.",
};

export default function BattlesLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
