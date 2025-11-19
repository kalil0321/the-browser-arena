import type {
    AgentDoc,
    AgentsBySessionRecord,
    ArenaStats,
    SessionDoc,
} from "../../src/types/arena";

export const filterPublicSessions = (sessions: SessionDoc[]): SessionDoc[] =>
    sessions.filter((session) => !(session.isPrivate ?? false));

export const filterPublicAgents = (
    agents: AgentDoc[],
    publicSessionIds: Set<SessionDoc["_id"]>
): AgentDoc[] => agents.filter((agent) => publicSessionIds.has(agent.sessionId));

export const buildArenaStats = (
    publicSessions: SessionDoc[],
    publicAgents: AgentDoc[]
): ArenaStats => {
    const models: Record<string, number> = {};
    const agentCounts: Record<string, number> = {};
    const statusCounts: Record<string, number> = {};

    for (const agent of publicAgents) {
        if (agent.model) {
            models[agent.model] = (models[agent.model] || 0) + 1;
        }

        agentCounts[agent.name] = (agentCounts[agent.name] || 0) + 1;
        statusCounts[agent.status] = (statusCounts[agent.status] || 0) + 1;
    }

    return {
        totalSessions: publicSessions.length,
        totalAgents: publicAgents.length,
        models,
        agents: agentCounts,
        statusCounts,
    };
};

export const buildAgentsBySessionRecord = (
    publicAgents: AgentDoc[]
): AgentsBySessionRecord => {
    return publicAgents.reduce<AgentsBySessionRecord>((acc, agent) => {
        const sessionId = agent.sessionId as string;
        if (!acc[sessionId]) {
            acc[sessionId] = [];
        }
        acc[sessionId].push(agent);
        return acc;
    }, {});
};

