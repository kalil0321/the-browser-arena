/**
 * Standalone runner script that executes inside a Vercel sandbox.
 * Reads params from /app/params.json, runs the agent, writes result to /app/result.json.
 *
 * This file is compiled to JS and uploaded to the sandbox at runtime.
 */

import { createRequire } from 'module'
import { readFileSync, writeFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { query, type McpServerConfig, type SDKResultMessage } from '@anthropic-ai/claude-agent-sdk'
import { Codex, type ThreadEvent, type ThreadItem } from '@openai/codex-sdk'

const require = createRequire(import.meta.url)

type McpType = 'playwright' | 'chrome-devtools' | 'agent-browser'

function getToolVersion(mcpType: McpType): string {
  try {
    if (mcpType === 'playwright') return require('@playwright/mcp/package.json')?.version || '0.0.0'
    if (mcpType === 'chrome-devtools') return require('chrome-devtools-mcp/package.json')?.version || '0.0.0'
    if (mcpType === 'agent-browser') return require('agent-browser/package.json')?.version || '0.0.0'
    return '0.0.0'
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
const CHROME_DEVTOOLS_MCP_BIN = `${BASE_DIR}/node_modules/chrome-devtools-mcp/build/src/bin/chrome-devtools-mcp.js`
const AGENT_BROWSER_BIN = `${BASE_DIR}/node_modules/.bin/agent-browser`

export interface RunnerParams {
  agentType: 'claude-code' | 'codex'
  instruction: string
  cdpUrl: string
  mcpType: McpType
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

// ── System prompts ──────────────────────────────────────────────────────────

function buildSystemPrompt(mcpType: McpType): string {
  if (mcpType === 'agent-browser') {
    return AGENT_BROWSER_SYSTEM_PROMPT
  }
  const toolName = mcpType === 'playwright' ? 'Playwright MCP' : 'Chrome DevTools MCP'
  return `You are a browser automation agent with access to ${toolName} tools. A browser is already open with a page loaded. You operate in a single-tab environment — do not open new tabs. Provide a direct, factual answer based on what you observe on the page.`
}

const AGENT_BROWSER_SYSTEM_PROMPT = `You are a browser automation agent. A remote browser is already connected via the agent-browser CLI. You control the browser by running agent-browser commands via the Bash tool.

## Available commands
- agent-browser snapshot -i — get interactive elements with refs (@e1, @e2, etc.)
- agent-browser snapshot -i -C — include cursor-interactive elements too
- agent-browser click @e1 — click an element by ref
- agent-browser type @e1 "text" — type into an element
- agent-browser fill @e1 "text" — clear and fill an element
- agent-browser press Enter — press a key
- agent-browser scroll down [px] — scroll the page
- agent-browser open <url> — navigate to a URL
- agent-browser screenshot — take a screenshot (returns base64)
- agent-browser get text — get page text
- agent-browser get url — get current URL
- agent-browser get title — get page title
- agent-browser wait <selector|ms> — wait for element or time
- agent-browser find role button "Submit" click — find and interact with elements
- agent-browser eval "document.title" — run JavaScript

## Workflow
1. Use "agent-browser snapshot -i" to see the page and available interactive elements
2. Use element refs (@e1, @e2) to interact with elements
3. After actions, take another snapshot to verify the result
4. Provide a direct, factual answer based on what you observe

Do not open new tabs. Do not close the browser.`

// ── MCP config (playwright / chrome-devtools only) ──────────────────────────

function createStdioMcpConfig(mcpType: 'playwright' | 'chrome-devtools', cdpUrl: string): Record<string, McpServerConfig> {
  const commonEnv = {
    CI: '1',
    CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS: '1',
  }

  if (mcpType === 'playwright') {
    return {
      playwright: {
        type: 'stdio',
        command: process.execPath,
        args: [PLAYWRIGHT_MCP_BIN, '--cdp-endpoint', cdpUrl],
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

const DISALLOWED_TOOLS: Record<'playwright' | 'chrome-devtools', string[]> = {
  playwright: ['mcp__playwright__browser_close'],
  'chrome-devtools': ['mcp__chrome-devtools__new_page', 'mcp__chrome-devtools__close_page'],
}

function createCodexMcpConfig(mcpType: 'playwright' | 'chrome-devtools', cdpUrl: string) {
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

// ── agent-browser connect helper ────────────────────────────────────────────

// Normalize CDP URL so the path is explicit (some WS servers reject bare `wss://host?query`).
// `new URL(...).toString()` always includes the `/` before `?`, turning
// `wss://host?q` into `wss://host/?q` which is required by agent-browser.
function normalizeCdpUrl(cdpUrl: string): string {
  try {
    return new URL(cdpUrl).toString()
  } catch { /* leave as-is if unparseable */ }
  return cdpUrl
}

function connectAgentBrowser(cdpUrl: string, logs: string[]) {
  const normalizedUrl = normalizeCdpUrl(cdpUrl)
  const MAX_ATTEMPTS = 3
  let lastErr = ''

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      // Brief delay before retry (2s, 4s)
      const { execSync } = require('child_process') as typeof import('child_process')
      execSync(`sleep ${attempt * 2}`)
    }
    try {
      const output = execFileSync(
        AGENT_BROWSER_BIN,
        ['connect', normalizedUrl],
        { cwd: BASE_DIR, timeout: 30_000, encoding: 'utf-8', env: { ...process.env, CI: '1' } },
      )
      pushLog(logs, `connect (attempt ${attempt}): ${output.trim()}`)
      console.log(`[agent-browser] Connected to remote browser (attempt ${attempt})`)
      return
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err)
      console.warn(`[agent-browser] Connect attempt ${attempt} failed: ${lastErr}`)
    }
  }

  throw new Error(`agent-browser connect failed after ${MAX_ATTEMPTS} attempts: ${lastErr}`)
}

// ── Claude runner ───────────────────────────────────────────────────────────

async function runClaude(params: RunnerParams): Promise<RunnerResult> {
  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), TIMEOUT_MS)
  const startTime = Date.now()
  const logs: string[] = []
  const systemPrompt = buildSystemPrompt(params.mcpType)
  const isAgentBrowser = params.mcpType === 'agent-browser'

  // For agent-browser, connect first then give Claude the Bash tool.
  // For MCP types, configure MCP servers.
  if (isAgentBrowser) {
    connectAgentBrowser(params.cdpUrl, logs)
  }

  const mcpServerName = params.mcpType === 'playwright' ? 'playwright' : 'chrome-devtools'

  const stream = query({
    prompt: `${systemPrompt}\n\n## Task\n${params.instruction.trim()}\n\nReturn the final answer to the user once the task is complete.`,
    options: {
      cwd: BASE_DIR,
      model: 'claude-sonnet-4-6',
      ...(isAgentBrowser
        ? { tools: ['Bash'] }
        : {
            mcpServers: createStdioMcpConfig(params.mcpType as 'playwright' | 'chrome-devtools', params.cdpUrl),
            tools: [`mcp__${mcpServerName}__*`],
            disallowedTools: DISALLOWED_TOOLS[params.mcpType as 'playwright' | 'chrome-devtools'],
          }
      ),
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
      toolVersion: getToolVersion(params.mcpType),
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

// ── Codex runner ────────────────────────────────────────────────────────────

async function runCodex(params: RunnerParams): Promise<RunnerResult> {
  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), TIMEOUT_MS)
  const startTime = Date.now()
  const logs: string[] = []
  const itemOrder: string[] = []
  const itemById = new Map<string, ThreadItem>()
  const isAgentBrowser = params.mcpType === 'agent-browser'

  // For agent-browser, connect to the remote browser before starting Codex.
  if (isAgentBrowser) {
    connectAgentBrowser(params.cdpUrl, logs)
  }

  const codex = new Codex({
    apiKey: process.env.OPENAI_API_KEY,
    ...(isAgentBrowser
      ? {}
      : { config: { mcp_servers: createCodexMcpConfig(params.mcpType as 'playwright' | 'chrome-devtools', params.cdpUrl) } }
    ),
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
    const systemPrompt = buildSystemPrompt(params.mcpType)
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

  const agentText = [...orderedItems]
    .reverse()
    .find((item) => item.type === 'agent_message')
    ?.text || ''

  if (!agentText && failureMessage) {
    throw new Error(failureMessage)
  }

  const answer = agentText || failureMessage

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
      toolVersion: getToolVersion(params.mcpType),
    },
    usage: {
      input_tokens: u.input_tokens,
      output_tokens: u.output_tokens,
      cached_tokens: u.cached_input_tokens,
    },
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const paramsRaw = readFileSync(`${BASE_DIR}/params.json`, 'utf-8')
  const params: RunnerParams = JSON.parse(paramsRaw)

  console.log(`[sandbox-runner] Starting ${params.agentType} agent (${params.mcpType}) for request ${params.requestId}`)
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
