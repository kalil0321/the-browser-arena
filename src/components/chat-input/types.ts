export type AgentType =
    | "stagehand"
    | "smooth"
    | "browser-use"
    | "browser-use-cloud"
    | "notte"
    | "claude-code"
    | "codex"
    | "playwright-mcp"
    | "chrome-devtools-mcp";
export type McpType = "playwright" | "chrome-devtools";

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
    | "claude-sonnet-4-6"
    | "openai/computer-use-preview"
    | "anthropic/claude-haiku-4-5-20251001"
    | "anthropic/claude-sonnet-4-5-20250929"
    | "anthropic/claude-sonnet-4-6"
    | "openrouter/moonshotai/kimi-k2-thinking"
    | "vertex_ai/gemini-2.0-flash"
    | "vertex_ai/gemini-2.5-flash"
    | "openai/gpt-4o"
    | "perplexity/sonar-pro"
    | "cerebras/llama-3.3-70b"
    | "groq/llama-3.3-70b-versatile"
    | "claude-code"
    | "codex";

export interface AgentConfig {
    id?: string; // Unique identifier for this agent instance
    agent: AgentType;
    model: ModelType;
    mcpType?: McpType;
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
    "claude-code": "Claude Code",
    "codex": "Codex",
    "playwright-mcp": "Playwright MCP",
    "chrome-devtools-mcp": "Chrome DevTools MCP",
};

export const MODEL_OPTIONS: Record<AgentType, ModelType[]> = {
    "browser-use": ["browser-use/bu-2.0", "browser-use/bu-1.0", "google/gemini-2.5-flash", "google/gemini-2.5-pro", "google/gemini-3-pro-preview", "google/gemini-3-flash-preview", "openai/gpt-4.1", "openai/gpt-5.2", "openai/gpt-5-mini", "openai/gpt-5-nano", "anthropic/claude-haiku-4.5", "anthropic/claude-sonnet-4-6", "openrouter/moonshotai/kimi-k2-thinking"],
    "browser-use-cloud": ["browser-use-llm", "gemini-flash-latest", "gpt-4.1", "o3", "claude-sonnet-4", "claude-sonnet-4-6"],
    "stagehand": ["google/gemini-2.5-flash", "google/gemini-2.5-pro", "google/gemini-3-pro-preview", "google/gemini-3-flash-preview", "openai/gpt-4.1", "openai/gpt-5.2", "openai/gpt-5-mini", "anthropic/claude-haiku-4-5-20251001", "anthropic/claude-sonnet-4-6", "openai/computer-use-preview", "openrouter/moonshotai/kimi-k2-thinking"],
    "smooth": [], // Smooth uses its own models
    "notte": [
        "google/gemini-2.5-flash",
        "google/gemini-2.5-pro",
        "openai/gpt-4.1",
        "openai/gpt-5.2",
        "anthropic/claude-sonnet-4-6",
        "anthropic/claude-haiku-4.5",
        "perplexity/sonar-pro",
        "groq/llama-3.3-70b-versatile",
    ],
    "claude-code": [],
    "codex": [],
    "playwright-mcp": ["claude-code", "codex"],
    "chrome-devtools-mcp": ["claude-code", "codex"],
};

export interface ChatInputState {
    isPrivate: boolean;
    agentConfigs: AgentConfig[];
    hasSmoothApiKey: boolean;
    hasBrowserUseApiKey: boolean;
    clientFingerprint?: string | null;
}
