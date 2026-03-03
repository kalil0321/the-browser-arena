import { Metadata } from "next";
import { notFound } from "next/navigation";
import { AgentProfileContent } from "./agent-profile-content";

const VALID_AGENTS = ["browser-use", "stagehand", "smooth", "notte"] as const;

type AgentType = (typeof VALID_AGENTS)[number];

const AGENT_INFO: Record<
    AgentType,
    { name: string; description: string; website: string | null }
> = {
    "browser-use": {
        name: "Browser-Use",
        description:
            "An open-source Python framework for AI browser automation using LLMs. Browser-Use enables developers to build agents that can navigate websites, fill forms, extract data, and complete complex multi-step web tasks.",
        website: "https://browser-use.com",
    },
    stagehand: {
        name: "Stagehand",
        description:
            "Browserbase's AI web browsing framework for natural language browser automation. Stagehand provides a simple API for building browser agents that can observe, act, and extract information from web pages.",
        website: "https://stagehand.dev",
    },
    smooth: {
        name: "Smooth",
        description:
            "A browser automation agent designed for smooth, reliable AI-powered web task completion. Smooth focuses on efficient task execution with minimal overhead.",
        website: null,
    },
    notte: {
        name: "Notte",
        description:
            "An AI browser agent focused on reliable web task completion. Notte provides robust browser automation with support for complex multi-step workflows and intelligent error recovery.",
        website: "https://notte.cc",
    },
};

function isValidAgent(agent: string): agent is AgentType {
    return VALID_AGENTS.includes(agent as AgentType);
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ agentType: string }>;
}): Promise<Metadata> {
    const { agentType } = await params;
    if (!isValidAgent(agentType)) return { title: "Agent Not Found" };

    const info = AGENT_INFO[agentType];
    return {
        title: `${info.name} - AI Browser Agent Stats & Rankings`,
        description: `${info.name} performance on The Browser Arena. See ELO ratings, win rates, battle history, and model comparisons for this AI browser agent.`,
        openGraph: {
            title: `${info.name} - AI Browser Agent Stats & Rankings`,
            description: `${info.name} performance on The Browser Arena. ELO ratings, win rates, and battle history.`,
        },
    };
}

export function generateStaticParams() {
    return VALID_AGENTS.map((agentType) => ({ agentType }));
}

export default async function AgentProfilePage({
    params,
}: {
    params: Promise<{ agentType: string }>;
}) {
    const { agentType } = await params;
    if (!isValidAgent(agentType)) notFound();

    const info = AGENT_INFO[agentType];
    return (
        <AgentProfileContent
            agentType={agentType}
            name={info.name}
            description={info.description}
            website={info.website}
        />
    );
}
