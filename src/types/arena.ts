import type { Doc, Id } from "../../convex/_generated/dataModel";

export type SessionDoc = Doc<"sessions">;
export type AgentDoc = Doc<"agents">;

// Agent type with SDK version
export type AgentWithVersion = AgentDoc & {
    sdkVersion?: string;
};

export type AgentsBySessionRecord = Record<string, AgentDoc[]>;
export type AgentsBySessionMap = Map<Id<"sessions">, AgentDoc[]>;

export type ArenaStats = {
    totalSessions: number;
    totalAgents: number;
    models: Record<string, number>;
    agents: Record<string, number>;
    statusCounts: Record<string, number>;
};

export type ArenaDataPayload = {
    sessions: SessionDoc[];
    agentsBySession: AgentsBySessionRecord;
    stats: ArenaStats;
};

export type ArenaDataPaginatedPayload = {
    page: SessionDoc[];
    isDone: boolean;
    continueCursor: string | null;
    agentsBySession: AgentsBySessionRecord;
};
