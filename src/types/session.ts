/**
 * Session types for Browser Agent Arena
 */

export interface AgentStatus {
  id: string;
  name: string;
  status: "initializing" | "running" | "completed" | "failed";
  steps: number;
  time: number; // in seconds
  error?: string;
}

export interface Session {
  id: string;
  prompt: string;
  status: "pending" | "active" | "completed" | "failed";
  agents: AgentStatus[];
  createdAt: string;
  completedAt?: string;
  winner?: string; // agent id
}

export interface CreateSessionRequest {
  prompt: string;
}

export interface CreateSessionResponse {
  sessionId: string;
  prompt: string;
  createdAt: string;
}

export interface SessionListItem {
  id: string;
  prompt: string;
  status: Session["status"];
  createdAt: string;
  winner?: string;
}

