/**
 * Standalone runner script that executes inside a Vercel sandbox.
 * Reads params from /app/params.json, runs the agent, writes result to /app/result.json.
 *
 * This file is compiled to JS and uploaded to the sandbox at runtime.
 */

import { createRequire } from 'module'
import { readFileSync, writeFileSync } from 'fs'
import { query, type McpServerConfig, type SDKResultMessage } from '@anthropic-ai/claude-agent-sdk'
import { Codex, type ThreadEvent, type ThreadItem } from '@openai/codex-sdk'

const require = createRequire(import.meta.url)

function getMcpVersion(mcpType: McpType): string {
  try {
    const pkg = mcpType === 'playwright'
      ? require('@playwright/mcp/package.json')
      : require('chrome-devtools-mcp/package.json')
    return pkg?.version || '0.0.0'
  } catch {
    return '0.0.0'
  }
}

const TIMEOUT_MS = 14 * 60 * 1000 // 14 min (sandbox timeout is 15 min)
const MAX_LOG_LINES = 250
const MAX_LOG_LINE_LENGTH = 2000

// Base directory for the sandbox environment
const BASE_DIR = process.env.SANDBOX_BASE_DIR || '/vercel/sandbox'

// Use sandbox-local paths for MCP binaries
const PLAYWRIGHT_MCP_BIN = `${BASE_DIR}/node_modules/@playwright/mcp/cli.js`
const CHROME_DEVTOOLS_MCP_BIN = `${BASE_DIR}/node_modules/chrome-devtools-mcp/build/src/index.js`

export interface RunnerParams {
  agentType: 'claude-code' | 'codex'
  instruction: string
  cdpUrl: string
  mcpType: 'playwright' | 'chrome-devtools'
  requestId: string
}

export interface RunnerResult {
  answer: string
  logs: string[]
  success: boolean
  duration: number
  metadata: Record<string, unknown>
  usage: { input_tokens: number; output_tokens: number; cached_tokens: number }
  sdkCostUsd?: number
}

type McpType = 'playwright' | 'chrome-devtools'

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

function buildMcpSystemPrompt(mcpType: McpType): string {
  const toolName = mcpType === 'playwright' ? 'Playwright MCP' : 'Chrome DevTools MCP'
  return `You are a browser automation agent with access to ${toolName} tools. A browser is already open with a page loaded. You operate in a single-tab environment — do not open new tabs. Provide a direct, factual answer based on what you observe on the page.`
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
      cwd: BASE_DIR,
      env: serverConfig.env,
      required: true,
      startup_timeout_ms: 20_000,
      tool_timeout_sec: 180,
    },
  }
}

async function runClaude(params: RunnerParams): Promise<RunnerResult> {
  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), TIMEOUT_MS)
  const startTime = Date.now()
  const logs: string[] = []
  const mcpServerName = params.mcpType === 'playwright' ? 'playwright' : 'chrome-devtools'
  const systemPrompt = buildMcpSystemPrompt(params.mcpType)

  const stream = query({
    prompt: `${systemPrompt}\n\n## Task\n${params.instruction.trim()}\n\nReturn the final answer to the user once the task is complete.`,
    options: {
      cwd: BASE_DIR,
      mcpServers: createStdioMcpConfig(params.mcpType, params.cdpUrl),
      model: 'claude-sonnet-4-6',
      tools: [`mcp__${mcpServerName}__*`],
      disallowedTools: DISALLOWED_TOOLS[params.mcpType],
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      env: {
        ...process.env,
        CLAUDE_AGENT_SDK_CLIENT_APP: 'the-browser-arena/sandbox',
        DEBUG_CLAUDE_AGENT_SDK: '1',
      },
      stderr: (data: string) => {
        console.error(`[claude-cli-stderr] ${data}`)
      },
      abortController,
    },
  })

  let finalResult: SDKResultMessage | undefined
  let answer = ''

  try {
    for await (const message of stream) {
      if (message.type === 'assistant') {
        const text = extractClaudeText(message.message?.content)
        if (text) answer = text
      }
      if (message.type === 'result') {
        finalResult = message
        if (message.subtype === 'success' && message.result) {
          answer = message.result
        }
      }
      // Build log lines
      if (message.type === 'result') {
        pushLog(logs, message.subtype === 'success'
          ? `result success turns=${message.num_turns} cost=${message.total_cost_usd.toFixed(4)}`
          : `result ${message.subtype} ${message.errors.join('; ')}`)
      } else if (message.type === 'assistant') {
        const text = extractClaudeText(message.message?.content)
        if (text) pushLog(logs, `assistant ${text}`)
      } else if (message.type === 'tool_use_summary') {
        pushLog(logs, `tool_use ${message.summary}`)
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

  return {
    answer,
    logs,
    success: finalResult.subtype === 'success' && !finalResult.is_error,
    duration,
    metadata: {
      model: 'claude-sonnet-4-6',
      resultSubtype: finalResult.subtype,
      numTurns: finalResult.num_turns,
      stopReason: finalResult.stop_reason,
      mcpVersion: getMcpVersion(params.mcpType),
    },
    usage: {
      input_tokens: finalResult.usage?.input_tokens || 0,
      output_tokens: finalResult.usage?.output_tokens || 0,
      cached_tokens:
        (finalResult.usage?.cache_creation_input_tokens || 0) +
        (finalResult.usage?.cache_read_input_tokens || 0),
    },
    sdkCostUsd: finalResult.total_cost_usd || 0,
  }
}

async function runCodex(params: RunnerParams): Promise<RunnerResult> {
  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), TIMEOUT_MS)
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
    model: 'gpt-5.4',
    workingDirectory: BASE_DIR,
    skipGitRepoCheck: true,
    sandboxMode: 'read-only',
    approvalPolicy: 'never',
    networkAccessEnabled: true,
  })

  let usage: { input_tokens: number; output_tokens: number; cached_input_tokens: number } | undefined
  let failureMessage = ''

  try {
    const systemPrompt = buildMcpSystemPrompt(params.mcpType)
    const { events } = await thread.runStreamed(
      `${systemPrompt}\n\n## Task\n${params.instruction.trim()}\n\nReturn the final answer to the user once the task is complete.`,
      { signal: abortController.signal },
    )

    for await (const event of events) {
      switch (event.type) {
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

      // Log key events
      if (event.type === 'turn.completed') {
        pushLog(logs, `turn completed input=${event.usage.input_tokens} output=${event.usage.output_tokens}`)
      } else if (event.type === 'turn.failed') {
        pushLog(logs, `turn failed ${event.error.message}`)
      } else if (event.type === 'item.completed' && event.item.type === 'agent_message') {
        pushLog(logs, `assistant ${event.item.text}`)
      }
    }
  } finally {
    clearTimeout(timeout)
  }

  const orderedItems = itemOrder
    .map((id) => itemById.get(id))
    .filter((item): item is ThreadItem => Boolean(item))

  const answer = [...orderedItems]
    .reverse()
    .find((item) => item.type === 'agent_message')
    ?.text || failureMessage

  if (!answer && failureMessage) {
    throw new Error(failureMessage)
  }

  const duration = (Date.now() - startTime) / 1000
  const u = usage || { input_tokens: 0, output_tokens: 0, cached_input_tokens: 0 }

  return {
    answer,
    logs,
    success: Boolean(answer) && !failureMessage,
    duration,
    metadata: {
      model: 'gpt-5.4',
      failureMessage: failureMessage || undefined,
      mcpVersion: getMcpVersion(params.mcpType),
    },
    usage: {
      input_tokens: u.input_tokens,
      output_tokens: u.output_tokens,
      cached_tokens: u.cached_input_tokens,
    },
  }
}

async function main() {
  const paramsRaw = readFileSync(`${BASE_DIR}/params.json`, 'utf-8')
  const params: RunnerParams = JSON.parse(paramsRaw)

  console.log(`[sandbox-runner] Starting ${params.agentType} agent for request ${params.requestId}`)
  console.log(`[sandbox-runner] ANTHROPIC_API_KEY set: ${!!process.env.ANTHROPIC_API_KEY}`)
  console.log(`[sandbox-runner] OPENAI_API_KEY set: ${!!process.env.OPENAI_API_KEY}`)
  console.log(`[sandbox-runner] Node version: ${process.version}`)

  try {
    const result = params.agentType === 'claude-code'
      ? await runClaude(params)
      : await runCodex(params)

    writeFileSync(`${BASE_DIR}/result.json`, JSON.stringify(result, null, 2))
    console.log(`[sandbox-runner] Completed successfully in ${result.duration.toFixed(1)}s`)
    process.exit(0)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    console.error(`[sandbox-runner] Failed: ${message}`)
    if (stack) console.error(`[sandbox-runner] Stack: ${stack}`)

    const failResult: RunnerResult = {
      answer: '',
      logs: [`Error: ${message}`],
      success: false,
      duration: 0,
      metadata: { error: message },
      usage: { input_tokens: 0, output_tokens: 0, cached_tokens: 0 },
    }
    writeFileSync(`${BASE_DIR}/result.json`, JSON.stringify(failResult, null, 2))
    process.exit(1)
  }
}

main()
