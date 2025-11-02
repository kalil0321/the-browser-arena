export type AgentType = "stagehand" | "smooth" | "stagehand-bb-cloud" | "browser-use" | "browser-use-cloud";

export type ModelType = 
    | "google/gemini-2.5-flash" 
    | "google/gemini-2.5-pro" 
    | "openai/gpt-4.1" 
    | "anthropic/claude-haiku-4.5" 
    | "browser-use/bu-1.0" 
    | "browser-use-llm" 
    | "gemini-flash-latest" 
    | "gpt-4.1" 
    | "o3" 
    | "claude-sonnet-4" 
    | "openai/computer-use-preview" 
    | "openai/computer-use-preview-2025-03-11" 
    | "anthropic/claude-3-7-sonnet-latest" 
    | "anthropic/claude-haiku-4-5-20251001" 
    | "anthropic/claude-sonnet-4-20250514" 
    | "anthropic/claude-sonnet-4-5-20250929" 
    | "google/gemini-2.5-computer-use-preview-10-2025";

export interface AgentConfig {
    id?: string; // Unique identifier for this agent instance
    agent: AgentType;
    model: ModelType;
    secrets?: Record<string, string>; // For browser-use: key-value pairs of secrets
    thinkingModel?: ModelType; // For stagehand: model used for thinking/planning
    executionModel?: ModelType; // For stagehand: model used for execution
}

export const AGENT_LABELS: Record<AgentType, string> = {
    "stagehand": "Stagehand",
    "smooth": "Smooth",
    "stagehand-bb-cloud": "Stagehand Cloud", // Commented out in UI for now
    "browser-use": "BU",
    "browser-use-cloud": "BU Cloud"
};

export const MODEL_OPTIONS: Record<AgentType, ModelType[]> = {
    "browser-use": ["browser-use/bu-1.0", "google/gemini-2.5-flash", "google/gemini-2.5-pro", "openai/gpt-4.1", "anthropic/claude-haiku-4.5"],
    "browser-use-cloud": ["browser-use-llm", "gemini-flash-latest", "gpt-4.1", "o3", "claude-sonnet-4"],
    "stagehand": ["google/gemini-2.5-flash", "google/gemini-2.5-pro", "openai/gpt-4.1", "anthropic/claude-haiku-4.5", "openai/computer-use-preview", "openai/computer-use-preview-2025-03-11", "anthropic/claude-3-7-sonnet-latest", "anthropic/claude-haiku-4-5-20251001", "anthropic/claude-sonnet-4-20250514", "anthropic/claude-sonnet-4-5-20250929", "google/gemini-2.5-computer-use-preview-10-2025"],
    "smooth": [], // Smooth uses its own models
    "stagehand-bb-cloud": ["google/gemini-2.5-flash", "google/gemini-2.5-pro", "openai/gpt-4.1", "anthropic/claude-haiku-4.5", "openai/computer-use-preview", "openai/computer-use-preview-2025-03-11", "anthropic/claude-3-7-sonnet-latest", "anthropic/claude-haiku-4-5-20251001", "anthropic/claude-sonnet-4-20250514", "anthropic/claude-sonnet-4-5-20250929", "google/gemini-2.5-computer-use-preview-10-2025"] // Commented out in UI for now
};

export interface ChatInputState {
    isPrivate: boolean;
    agentConfigs: AgentConfig[];
    hasSmoothApiKey: boolean;
    hasBrowserUseApiKey: boolean;
    clientFingerprint?: string | null;
}

