export const openapiSpec = {
    openapi: "3.1.0",
    info: {
        title: "The Browser Arena API",
        version: "1.0.0",
        description: "Programmatic access to The Browser Arena — launch browser agents, compare frameworks, and retrieve results.",
    },
    servers: [
        { url: "https://www.thebrowserarena.com", description: "Production" },
        { url: "http://localhost:3000", description: "Local development" },
    ],
    security: [{ BearerAuth: [] }],
    components: {
        securitySchemes: {
            BearerAuth: {
                type: "http",
                scheme: "bearer",
                description: "API key from Settings → Developer API Keys. Format: sk_tba_...",
            },
        },
        schemas: {
            AgentConfig: {
                type: "object",
                required: ["agent"],
                properties: {
                    agent: {
                        type: "string",
                        enum: ["playwright-mcp", "chrome-devtools-mcp", "agent-browser-mcp", "stagehand", "browser-use", "browser-use-cloud", "notte"],
                        description: "Agent framework to use",
                    },
                    model: {
                        type: "string",
                        enum: ["claude-code", "codex"],
                        description: "SDK client for MCP agents. Defaults to claude-code.",
                    },
                },
            },
            Session: {
                type: "object",
                properties: {
                    _id: { type: "string" },
                    userId: { type: "string" },
                    instruction: { type: "string" },
                    isPrivate: { type: "boolean" },
                    createdAt: { type: "number" },
                    updatedAt: { type: "number" },
                },
            },
            Agent: {
                type: "object",
                properties: {
                    _id: { type: "string" },
                    sessionId: { type: "string" },
                    name: { type: "string" },
                    model: { type: "string" },
                    sdkClient: { type: "string", enum: ["claude-code", "codex"] },
                    status: { type: "string", enum: ["pending", "running", "completed", "failed"] },
                    result: { type: "object", description: "Agent result including answer, logs, usage, cost" },
                    browser: {
                        type: "object",
                        properties: {
                            sessionId: { type: "string" },
                            url: { type: "string" },
                        },
                    },
                },
            },
            Error: {
                type: "object",
                properties: {
                    error: {
                        type: "object",
                        properties: {
                            code: { type: "string" },
                            message: { type: "string" },
                        },
                    },
                },
            },
        },
    },
    paths: {
        "/api/v1/agents": {
            get: {
                summary: "List available agents",
                description: "Returns all available agent types, their supported models, and MCP types.",
                tags: ["Agents"],
                security: [],
                responses: {
                    "200": {
                        description: "List of available agents",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        data: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    id: { type: "string" },
                                                    label: { type: "string" },
                                                    models: { type: "array", items: { type: "string" } },
                                                    mcpType: { type: "string", nullable: true },
                                                    requiresApiKey: { type: "boolean" },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        "/api/v1/agents/{agentId}": {
            get: {
                summary: "Get agent details",
                description: "Returns a single agent's details including result, logs, and usage.",
                tags: ["Agents"],
                parameters: [
                    { name: "agentId", in: "path", required: true, schema: { type: "string" } },
                ],
                responses: {
                    "200": {
                        description: "Agent details",
                        content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/Agent" } } } } },
                    },
                    "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                    "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                },
            },
        },
        "/api/v1/sessions": {
            get: {
                summary: "List your sessions",
                description: "Returns the 50 most recent sessions for the authenticated user.",
                tags: ["Sessions"],
                responses: {
                    "200": {
                        description: "List of sessions",
                        content: { "application/json": { schema: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/Session" } } } } } },
                    },
                    "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                },
            },
            post: {
                summary: "Create a session",
                description: "Creates a new session with the given instruction and launches the specified agents. Currently supports MCP agents (playwright-mcp, chrome-devtools-mcp, agent-browser-mcp) which use server-side credentials.",
                tags: ["Sessions"],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["instruction", "agents"],
                                properties: {
                                    instruction: { type: "string", description: "The task for agents to complete", example: "Find the top trending repository on GitHub" },
                                    agents: {
                                        type: "array",
                                        maxItems: 4,
                                        items: { $ref: "#/components/schemas/AgentConfig" },
                                        description: "Agents to launch (max 4)",
                                    },
                                    isPrivate: { type: "boolean", default: false, description: "Whether the session is private" },
                                },
                            },
                            example: {
                                instruction: "Find the top trending repository on GitHub",
                                agents: [
                                    { agent: "playwright-mcp", model: "claude-code" },
                                    { agent: "chrome-devtools-mcp", model: "codex" },
                                ],
                            },
                        },
                    },
                },
                responses: {
                    "201": {
                        description: "Session created",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        data: {
                                            type: "object",
                                            properties: {
                                                sessionId: { type: "string" },
                                                agents: {
                                                    type: "array",
                                                    items: {
                                                        type: "object",
                                                        properties: {
                                                            agent: { type: "string" },
                                                            agentId: { type: "string" },
                                                            success: { type: "boolean" },
                                                            error: { type: "string" },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "400": { description: "Bad request", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                    "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
                },
            },
        },
        "/api/v1/sessions/{sessionId}": {
            get: {
                summary: "Get session details",
                description: "Returns session info with all its agents.",
                tags: ["Sessions"],
                parameters: [
                    { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                ],
                responses: {
                    "200": {
                        description: "Session with agents",
                        content: { "application/json": { schema: { type: "object", properties: { data: { type: "object" } } } } },
                    },
                    "401": { description: "Unauthorized" },
                    "404": { description: "Not found" },
                },
            },
        },
        "/api/v1/sessions/{sessionId}/wait": {
            get: {
                summary: "Wait for session completion",
                description: "Long-polls until all agents in the session have completed or failed. Returns immediately if already done. Max wait: 120 seconds.",
                tags: ["Sessions"],
                parameters: [
                    { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                    { name: "timeout", in: "query", required: false, schema: { type: "integer", default: 120 }, description: "Max wait time in seconds (max 120)" },
                ],
                responses: {
                    "200": {
                        description: "Session with agents (completed field indicates if all done)",
                        content: { "application/json": { schema: { type: "object", properties: { data: { type: "object" } } } } },
                    },
                    "401": { description: "Unauthorized" },
                    "404": { description: "Not found" },
                },
            },
        },
    },
};
