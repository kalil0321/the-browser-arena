import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { query, type McpServerConfig, type SDKMessage, type SDKResultMessage } from '@anthropic-ai/claude-agent-sdk'
import { Codex, type ThreadEvent, type ThreadItem } from '@openai/codex-sdk'
import { computeBrowserCost } from './browser.js'
import { computeCost } from './llm-pricing.js'
import { getConvexBackendClient } from './convex.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const STAGEHAND_ROOT = join(__dirname, '../..')
const REPO_ROOT = join(STAGEHAND_ROOT, '..')
const PLAYWRIGHT_MCP_BIN = join(STAGEHAND_ROOT, 'node_modules/@playwright/mcp/cli.js')
const CHROME_DEVTOOLS_MCP_BIN = join(STAGEHAND_ROOT, 'node_modules/chrome-devtools-mcp/build/src/index.js')

const SDK_TIMEOUT_MS = 15 * 60 * 1000
const MAX_LOG_LINES = 250
const MAX_LOG_LINE_LENGTH = 2000

export type SdkAgentType = 'claude-code' | 'codex'
export type McpType = 'playwright' | 'chrome-devtools'

export const SDK_AGENT_MODELS: Record<SdkAgentType, { record: string; runtime: string }> = {
  'claude-code': {
    record: 'anthropic/claude-sonnet-4-6',
    runtime: 'claude-sonnet-4-6',
  },
  codex: {
    record: 'openai/gpt-5.4',
    runtime: 'gpt-5.4',
  },
}

const SDK_PACKAGE_PATHS: Record<SdkAgentType, string> = {
  'claude-code': '../../node_modules/@anthropic-ai/claude-agent-sdk/package.json',
  codex: '../../node_modules/@openai/codex-sdk/package.json',
}

function readInstalledVersion(relativePackageJson: string, fallback: string): string {
  try {
    const packageJsonPath = join(__dirname, relativePackageJson)
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
    if (packageJson.version) {
      return packageJson.version
    }
  } catch (error) {
    console.warn(`Failed to read package version from ${relativePackageJson}:`, error)
  }
  return fallback
}

export const SDK_AGENT_VERSIONS: Record<SdkAgentType, string> = {
  'claude-code': readInstalledVersion(SDK_PACKAGE_PATHS['claude-code'], '0.0.0'),
  codex: readInstalledVersion(SDK_PACKAGE_PATHS.codex, '0.0.0'),
}

interface RunSdkAgentParams {
  agentType: SdkAgentType
  sessionId: string
  instruction: string
  cdpUrl: string
  liveViewUrl?: string
  mcpType: McpType
  requestId: string
  agentId?: string
}

interface AgentExecutionResult {
  usage: Record<string, number>
  cost: number
  duration: number
  answer: string
  logs: string[]
  success: boolean
  metadata: Record<string, unknown>
}

function pushLog(logs: string[], line: string | undefined | null) {
  if (!line) return
  const sanitized = line.replace(/\s+/g, ' ').trim()
  if (!sanitized) return
  const trimmed = sanitized.length > MAX_LOG_LINE_LENGTH
    ? `${sanitized.slice(0, MAX_LOG_LINE_LENGTH)}...`
    : sanitized
  logs.push(trimmed)
  if (logs.length > MAX_LOG_LINES) {
    logs.shift()
  }
}

function extractClaudeText(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content
    .map((block) => {
      if (block?.type === 'text') return String(block.text || '')
      if (block?.type === 'thinking') return String(block.thinking || '')
      return ''
    })
    .filter(Boolean)
    .join('\n')
    .trim()
}

function formatClaudeEvent(message: SDKMessage): string | undefined {
  switch (message.type) {
    case 'system':
      if (message.subtype === 'init') {
        return `init model=${message.model} cwd=${message.cwd} mcp=${message.mcp_servers.map((server) => `${server.name}:${server.status}`).join(',')}`
      }
      if (message.subtype === 'status') {
        return `status ${message.status}`
      }
      if (message.subtype === 'task_started') {
        return `task_started ${message.description}`
      }
      if (message.subtype === 'task_progress') {
        return `task_progress ${message.description}`
      }
      if (message.subtype === 'task_notification') {
        return `task_${message.status} ${message.summary}`
      }
      if (message.subtype === 'local_command_output') {
        return `local_output ${message.content}`
      }
      if (message.subtype === 'hook_progress') {
        return `hook_progress ${message.hook_name} ${message.output || message.stdout || message.stderr}`
      }
      if (message.subtype === 'hook_response') {
        return `hook_response ${message.hook_name} ${message.outcome}`
      }
      return `${message.type}:${message.subtype}`
    case 'tool_progress':
      return `tool_progress ${message.tool_name} ${message.elapsed_time_seconds}s`
    case 'tool_use_summary':
      return `tool_use ${message.summary}`
    case 'assistant': {
      const text = extractClaudeText(message.message?.content)
      return text ? `assistant ${text}` : 'assistant response'
    }
    case 'result':
      return message.subtype === 'success'
        ? `result success turns=${message.num_turns} cost=${message.total_cost_usd.toFixed(4)}`
        : `result ${message.subtype} ${message.errors.join('; ')}`
    case 'auth_status':
      return message.error ? `auth_status ${message.error}` : `auth_status authenticating=${message.isAuthenticating}`
    case 'prompt_suggestion':
      return `prompt_suggestion ${message.suggestion}`
    default:
      return message.type
  }
}

function summarizeClaudeMessage(message: SDKMessage): Record<string, unknown> {
  switch (message.type) {
    case 'assistant':
      return {
        type: message.type,
        text: extractClaudeText(message.message?.content),
        error: message.error,
      }
    case 'result':
      return message.subtype === 'success'
        ? {
            type: message.type,
            subtype: message.subtype,
            result: message.result,
            cost: message.total_cost_usd,
            numTurns: message.num_turns,
          }
        : {
            type: message.type,
            subtype: message.subtype,
            errors: message.errors,
            numTurns: message.num_turns,
          }
    case 'system':
      return {
        type: message.type,
        subtype: message.subtype,
      }
    case 'tool_progress':
      return {
        type: message.type,
        tool: message.tool_name,
        elapsed: message.elapsed_time_seconds,
      }
    case 'tool_use_summary':
      return {
        type: message.type,
        summary: message.summary,
      }
    default:
      return { type: message.type }
  }
}

function summarizeCodexItem(item: ThreadItem): Record<string, unknown> {
  switch (item.type) {
    case 'agent_message':
      return { type: item.type, text: item.text }
    case 'reasoning':
      return { type: item.type, text: item.text }
    case 'command_execution':
      return {
        type: item.type,
        command: item.command,
        status: item.status,
        exitCode: item.exit_code,
      }
    case 'mcp_tool_call':
      return {
        type: item.type,
        server: item.server,
        tool: item.tool,
        status: item.status,
        error: item.error?.message,
      }
    case 'file_change':
      return {
        type: item.type,
        status: item.status,
        changes: item.changes,
      }
    case 'todo_list':
      return {
        type: item.type,
        items: item.items,
      }
    case 'web_search':
      return {
        type: item.type,
        query: item.query,
      }
    case 'error':
      return {
        type: item.type,
        message: item.message,
      }
  }
}

function formatCodexItem(item: ThreadItem): string | undefined {
  switch (item.type) {
    case 'agent_message':
      return `assistant ${item.text}`
    case 'reasoning':
      return `reasoning ${item.text}`
    case 'command_execution':
      return `command ${item.command} status=${item.status}${item.exit_code !== undefined ? ` exit=${item.exit_code}` : ''}`
    case 'mcp_tool_call':
      return `mcp ${item.server}.${item.tool} status=${item.status}${item.error?.message ? ` error=${item.error.message}` : ''}`
    case 'file_change':
      return `file_change status=${item.status} files=${item.changes.map((change) => change.path).join(',')}`
    case 'todo_list':
      return `todo ${item.items.map((item) => `${item.completed ? '[x]' : '[ ]'} ${item.text}`).join(' | ')}`
    case 'web_search':
      return `web_search ${item.query}`
    case 'error':
      return `error ${item.message}`
  }
}

function formatCodexEvent(event: ThreadEvent): string | undefined {
  switch (event.type) {
    case 'thread.started':
      return `thread started ${event.thread_id}`
    case 'turn.started':
      return 'turn started'
    case 'turn.completed':
      return `turn completed input=${event.usage.input_tokens} output=${event.usage.output_tokens}`
    case 'turn.failed':
      return `turn failed ${event.error.message}`
    case 'item.started':
    case 'item.updated':
    case 'item.completed':
      return formatCodexItem(event.item)
    case 'error':
      return `error ${event.message}`
  }
}

function createStdioMcpConfig(mcpType: McpType, cdpUrl: string): Record<string, McpServerConfig> {
  const commonEnv = {
    CI: '1',
    CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS: '1',
  }

  if (mcpType === 'playwright') {
    return {
      playwright: {
        type: 'stdio',
        command: process.execPath,
        args: [PLAYWRIGHT_MCP_BIN, '--cdp-endpoint', cdpUrl, '--isolated'],
        env: commonEnv,
      },
    }
  }

  const connectionFlag = cdpUrl.startsWith('ws://') || cdpUrl.startsWith('wss://')
    ? '--wsEndpoint'
    : '--browserUrl'

  return {
    'chrome-devtools': {
      type: 'stdio',
      command: process.execPath,
      args: [CHROME_DEVTOOLS_MCP_BIN, connectionFlag, cdpUrl, '--no-usage-statistics'],
      env: commonEnv,
    },
  }
}

function buildMcpSystemPrompt(mcpType: McpType): string {
  const toolName = mcpType === 'playwright' ? 'Playwright MCP' : 'Chrome DevTools MCP'
  return `You are a browser automation agent with access to ${toolName} tools. A browser is already open with a page loaded. You operate in a single-tab environment — do not open new tabs. Provide a direct, factual answer based on what you observe on the page.`
}

// Tools that open or close tabs/pages — excluded to keep agents in a single tab
const DISALLOWED_TOOLS: Record<McpType, string[]> = {
  playwright: ['mcp__playwright__browser_close'],
  'chrome-devtools': ['mcp__chrome-devtools__new_page', 'mcp__chrome-devtools__close_page'],
}

function createCodexMcpConfig(mcpType: McpType, cdpUrl: string) {
  const [serverName, serverConfig] = Object.entries(createStdioMcpConfig(mcpType, cdpUrl))[0]
  if (serverConfig.type !== 'stdio') {
    throw new Error(`Unexpected MCP transport for ${serverName}`)
  }
  return {
    [serverName]: {
      command: serverConfig.command,
      args: serverConfig.args,
      cwd: STAGEHAND_ROOT,
      env: serverConfig.env,
      required: true,
      startup_timeout_ms: 20_000,
      tool_timeout_sec: 180,
    },
  }
}

async function runClaudeAgent(params: Omit<RunSdkAgentParams, 'sessionId' | 'liveViewUrl' | 'agentId'>): Promise<AgentExecutionResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Missing ANTHROPIC_API_KEY')
  }

  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), SDK_TIMEOUT_MS)
  const startTime = Date.now()
  const logs: string[] = []
  const mcpServerName = params.mcpType === 'playwright' ? 'playwright' : 'chrome-devtools'
  const systemPrompt = buildMcpSystemPrompt(params.mcpType)
  const stream = query({
    prompt: `${systemPrompt}\n\n## Task\n${params.instruction.trim()}\n\nReturn the final answer to the user once the task is complete.`,
    options: {
      cwd: REPO_ROOT,
      mcpServers: createStdioMcpConfig(params.mcpType, params.cdpUrl),
      model: SDK_AGENT_MODELS['claude-code'].runtime,
      tools: [`mcp__${mcpServerName}__*`],
      disallowedTools: DISALLOWED_TOOLS[params.mcpType],
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      env: {
        ...process.env,
        CLAUDE_AGENT_SDK_CLIENT_APP: 'the-browser-arena/stagehand',
      },
      abortController,
    },
  })

  let finalResult: SDKResultMessage | undefined
  let answer = ''
  const events: Record<string, unknown>[] = []

  try {
    for await (const message of stream) {
      console.log('[claude-agent] message:', JSON.stringify(message, null, 2))
      events.push(summarizeClaudeMessage(message))
      pushLog(logs, formatClaudeEvent(message))
      if (message.type === 'assistant') {
        const text = extractClaudeText(message.message?.content)
        if (text) {
          answer = text
        }
      }
      if (message.type === 'result') {
        finalResult = message
        if (message.subtype === 'success' && message.result) {
          answer = message.result
        }
      }
    }
  } finally {
    clearTimeout(timeout)
    stream.close()
  }

  if (!finalResult) {
    throw new Error('Claude agent completed without a final result')
  }

  const duration = (Date.now() - startTime) / 1000
  const browserCost = computeBrowserCost(duration)
  const llmCost = finalResult.total_cost_usd || 0
  const cost = llmCost + browserCost
  const usage = {
    input_tokens: finalResult.usage?.input_tokens || 0,
    output_tokens: finalResult.usage?.output_tokens || 0,
    cached_tokens:
      (finalResult.usage?.cache_creation_input_tokens || 0) +
      (finalResult.usage?.cache_read_input_tokens || 0),
    total_tokens:
      (finalResult.usage?.input_tokens || 0) +
      (finalResult.usage?.output_tokens || 0),
    total_cost: cost,
    llm_cost: llmCost,
    browser_cost: browserCost,
  }

  return {
    usage,
    cost,
    duration,
    answer,
    logs,
    success: finalResult.subtype === 'success' && !finalResult.is_error,
    metadata: {
      events,
      model: SDK_AGENT_MODELS['claude-code'].runtime,
      resultSubtype: finalResult.subtype,
      totalCostUsd: finalResult.total_cost_usd,
      numTurns: finalResult.num_turns,
      stopReason: finalResult.stop_reason,
      errors: finalResult.subtype === 'success' ? [] : finalResult.errors,
    },
  }
}

async function runCodexAgent(params: Omit<RunSdkAgentParams, 'sessionId' | 'liveViewUrl' | 'agentId'>): Promise<AgentExecutionResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY')
  }

  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), SDK_TIMEOUT_MS)
  const startTime = Date.now()
  const logs: string[] = []
  const itemOrder: string[] = []
  const itemById = new Map<string, ThreadItem>()
  const codex = new Codex({
    apiKey: process.env.OPENAI_API_KEY,
    config: {
      mcp_servers: createCodexMcpConfig(params.mcpType, params.cdpUrl),
    },
  })

  const thread = codex.startThread({
    model: SDK_AGENT_MODELS.codex.runtime,
    workingDirectory: REPO_ROOT,
    skipGitRepoCheck: true,
    sandboxMode: 'read-only',
    approvalPolicy: 'never',
    networkAccessEnabled: true,
    additionalDirectories: [STAGEHAND_ROOT],
  })

  let usage:
    | {
        input_tokens: number
        output_tokens: number
        cached_input_tokens: number
      }
    | undefined
  let threadId: string | null = null
  let failureMessage = ''

  try {
    const systemPrompt = buildMcpSystemPrompt(params.mcpType)
    const { events } = await thread.runStreamed(
      `${systemPrompt}\n\n## Task\n${params.instruction.trim()}\n\nReturn the final answer to the user once the task is complete.`,
      { signal: abortController.signal },
    )

    for await (const event of events) {
      pushLog(logs, formatCodexEvent(event))
      switch (event.type) {
        case 'thread.started':
          threadId = event.thread_id
          break
        case 'turn.completed':
          usage = {
            input_tokens: event.usage.input_tokens,
            output_tokens: event.usage.output_tokens,
            cached_input_tokens: event.usage.cached_input_tokens,
          }
          break
        case 'turn.failed':
          failureMessage = event.error.message
          break
        case 'error':
          failureMessage = event.message
          break
        case 'item.started':
        case 'item.updated':
        case 'item.completed':
          if (!itemById.has(event.item.id)) {
            itemOrder.push(event.item.id)
          }
          itemById.set(event.item.id, event.item)
          break
      }
    }
  } finally {
    clearTimeout(timeout)
  }

  const orderedItems = itemOrder
    .map((id) => itemById.get(id))
    .filter((item): item is ThreadItem => Boolean(item))
  const answer =
    [...orderedItems]
      .reverse()
      .find((item) => item.type === 'agent_message')
      ?.text ||
    failureMessage

  if (!answer && failureMessage) {
    throw new Error(failureMessage)
  }

  const duration = (Date.now() - startTime) / 1000
  const llmUsage = usage || {
    input_tokens: 0,
    output_tokens: 0,
    cached_input_tokens: 0,
  }
  const llmCost = computeCost(SDK_AGENT_MODELS.codex.record, {
    input_tokens: llmUsage.input_tokens,
    output_tokens: llmUsage.output_tokens,
    cached_tokens: llmUsage.cached_input_tokens,
  })
  const browserCost = computeBrowserCost(duration)
  const cost = llmCost + browserCost
  const summarizedItems = orderedItems.map((item) => summarizeCodexItem(item))

  return {
    usage: {
      input_tokens: llmUsage.input_tokens,
      output_tokens: llmUsage.output_tokens,
      cached_tokens: llmUsage.cached_input_tokens,
      total_tokens: llmUsage.input_tokens + llmUsage.output_tokens,
      total_cost: cost,
      llm_cost: llmCost,
      browser_cost: browserCost,
    },
    cost,
    duration,
    answer,
    logs,
    success: Boolean(answer) && !failureMessage,
    metadata: {
      threadId,
      items: summarizedItems,
      model: SDK_AGENT_MODELS.codex.runtime,
      failureMessage: failureMessage || undefined,
    },
  }
}

export async function runSdkAgentAndPersist(params: RunSdkAgentParams): Promise<{ agentId: string }> {
  const convex = getConvexBackendClient()
  let agentId = params.agentId || ''
  const model = SDK_AGENT_MODELS[params.agentType].record
  const sdkVersion = SDK_AGENT_VERSIONS[params.agentType]

  if (!agentId) {
    agentId = await convex.createAgentFromBackend({
      sessionId: params.sessionId,
      name: params.agentType,
      model,
      sdkVersion,
      browser: { sessionId: 'external', url: params.liveViewUrl || '' },
    })
  }

  await convex.updateAgentStatusRunning(agentId)
  await convex.updateAgentSDKVersion(agentId, sdkVersion)
  if (params.liveViewUrl) {
    await convex.updateAgentBrowserUrl(agentId, params.liveViewUrl)
  }

  try {
    const result = params.agentType === 'claude-code'
      ? await runClaudeAgent(params)
      : await runCodexAgent(params)

    const payload = {
      usage: result.usage,
      cost: result.cost,
      duration: result.duration,
      answer: result.answer,
      logs: result.logs,
      message: result.answer,
      success: result.success,
      completed: true,
      agent: params.agentType,
      mcpType: params.mcpType,
      metadata: {
        ...result.metadata,
        mcpType: params.mcpType,
        requestId: params.requestId,
      },
    }

    await convex.updateAgentResult(agentId, payload, 'completed')
    return { agentId }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    await convex.updateAgentResult(
      agentId,
      {
        agent: params.agentType,
        mcpType: params.mcpType,
        error: message,
        success: false,
        completed: false,
        logs: [],
        metadata: {
          requestId: params.requestId,
        },
      },
      'failed',
    )
    await convex.updateAgentStatusFailed(agentId, message)
    throw error
  }
}
