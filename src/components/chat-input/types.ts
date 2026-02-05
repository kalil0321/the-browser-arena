export type AgentType = "stagehand" | "smooth" | "browser-use" | "browser-use-cloud" | "notte";

export type ModelType =
    | "google/gemini-2.5-flash"
    | "google/gemini-2.5-pro"
    | "google/gemini-3-pro-preview"
    | "google/gemini-3-flash-preview"
    | "openai/gpt-4.1"
    | "openai/gpt-5.2"
    | "openai/gpt-5-mini"
    | "openai/gpt-5-nano"
    | "anthropic/claude-haiku-4.5"
    | "browser-use/bu-2.0"
    | "browser-use/bu-1.0"
    | "browser-use-llm"
    | "gemini-flash-latest"
    | "gpt-4.1"
    | "o3"
    | "claude-sonnet-4"
    | "openai/computer-use-preview"
    | "anthropic/claude-haiku-4-5-20251001"
    | "anthropic/claude-sonnet-4-5-20250929"
    | "openrouter/moonshotai/kimi-k2-thinking"
    | "vertex_ai/gemini-2.0-flash"
    | "vertex_ai/gemini-2.5-flash"
    | "openai/gpt-4o"
    | "perplexity/sonar-pro"
    | "cerebras/llama-3.3-70b"
    | "groq/llama-3.3-70b-versatile";

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
    "browser-use": "BU",
    "browser-use-cloud": "BU Cloud",
    "notte": "Notte",
};

export const MODEL_OPTIONS: Record<AgentType, ModelType[]> = {
    "browser-use": ["browser-use/bu-2.0", "browser-use/bu-1.0", "google/gemini-2.5-flash", "google/gemini-2.5-pro", "google/gemini-3-pro-preview", "google/gemini-3-flash-preview", "openai/gpt-4.1", "openai/gpt-5.2", "openai/gpt-5-mini", "openai/gpt-5-nano", "anthropic/claude-haiku-4.5", "openrouter/moonshotai/kimi-k2-thinking"],
    "browser-use-cloud": ["browser-use-llm", "gemini-flash-latest", "gpt-4.1", "o3", "claude-sonnet-4"],
    "stagehand": ["google/gemini-2.5-flash", "google/gemini-2.5-pro", "google/gemini-3-pro-preview", "google/gemini-3-flash-preview", "openai/gpt-4.1", "openai/gpt-5.2", "openai/gpt-5-mini", "anthropic/claude-haiku-4-5-20251001", "openai/computer-use-preview", "openrouter/moonshotai/kimi-k2-thinking"],
    "smooth": [], // Smooth uses its own models
    "notte": [
        "vertex_ai/gemini-2.0-flash",
        "vertex_ai/gemini-2.5-flash",
        "openai/gpt-4o",
        "anthropic/claude-sonnet-4-5-20250929",
        "perplexity/sonar-pro",
        "cerebras/llama-3.3-70b",
        "groq/llama-3.3-70b-versatile"
    ],
};

export interface ChatInputState {
    isPrivate: boolean;
    agentConfigs: AgentConfig[];
    hasSmoothApiKey: boolean;
    hasBrowserUseApiKey: boolean;
    clientFingerprint?: string | null;
}

