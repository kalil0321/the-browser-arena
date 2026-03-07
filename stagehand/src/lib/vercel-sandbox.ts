import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { Sandbox } from '@vercel/sandbox'
import { computeBrowserCost } from './browser.js'
import { computeCost } from './llm-pricing.js'
import { SDK_AGENT_MODELS, type McpType, type SdkAgentType } from './sdk-agents.js'
import type { RunnerParams, RunnerResult } from './sandbox-runner.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const STAGEHAND_ROOT = join(__dirname, '../..')
const RUNNER_SCRIPT_PATH = join(STAGEHAND_ROOT, 'dist/lib/sandbox-runner.js')

const SANDBOX_TIMEOUT_MS = 15 * 60 * 1000

export interface SandboxAgentParams {
  agentType: SdkAgentType
  instruction: string
  cdpUrl: string
  mcpType: McpType
  requestId: string
}

export interface SandboxAgentResult {
  usage: Record<string, number>
  cost: number
  duration: number
  answer: string
  logs: string[]
  success: boolean
  metadata: Record<string, unknown>
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try { return JSON.stringify(err) } catch { return String(err) }
}

function buildSandboxEnv(agentType: SdkAgentType): Record<string, string> {
  const env: Record<string, string> = {}
  if (agentType === 'claude-code' && process.env.ANTHROPIC_API_KEY) {
    env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
  }
  if (agentType === 'codex' && process.env.OPENAI_API_KEY) {
    env.OPENAI_API_KEY = process.env.OPENAI_API_KEY
  }
  return env
}

export async function runAgentInSandbox(params: SandboxAgentParams): Promise<SandboxAgentResult> {
  let sandbox: Sandbox | undefined

  try {
    // 1. Create sandbox
    console.log(`[vercel-sandbox] Creating sandbox for request ${params.requestId}`)
    try {
      sandbox = await Sandbox.create({
        runtime: 'node22',
        timeout: SANDBOX_TIMEOUT_MS,
        env: buildSandboxEnv(params.agentType),
        resources: { vcpus: 2 },
      })
    } catch (createErr) {
      throw new Error(`Sandbox create failed: ${formatError(createErr)}`)
    }
    console.log(`[vercel-sandbox] Sandbox created: ${sandbox.sandboxId}`)

    // 2. Install agent SDK dependencies + set ESM mode
    console.log(`[vercel-sandbox] Installing dependencies...`)
    const installResult = await sandbox.runCommand({
      cmd: 'bash',
      args: ['-c', [
        'cd /vercel/sandbox',
        'npm init -y',
        'node -e "const p=require(\'./package.json\'); p.type=\'module\'; require(\'fs\').writeFileSync(\'package.json\', JSON.stringify(p,null,2))"',
        'npm install @anthropic-ai/claude-agent-sdk @openai/codex-sdk @playwright/mcp chrome-devtools-mcp 2>&1',
      ].join(' && ')],
      stdout: process.stdout,
      stderr: process.stderr,
    })

    if (installResult.exitCode !== 0) {
      const stderr = await installResult.stderr()
      throw new Error(`npm install failed (exit ${installResult.exitCode}): ${stderr.slice(-500)}`)
    }
    console.log(`[vercel-sandbox] Dependencies installed`)

    // 3. Upload runner script + params
    const runnerCode = readFileSync(RUNNER_SCRIPT_PATH, 'utf-8')
    const runnerParams: RunnerParams = {
      agentType: params.agentType,
      instruction: params.instruction,
      cdpUrl: params.cdpUrl,
      mcpType: params.mcpType,
      requestId: params.requestId,
    }

    await sandbox.writeFiles([
      { path: '/vercel/sandbox/agent-runner.js', content: Buffer.from(runnerCode) },
      { path: '/vercel/sandbox/params.json', content: Buffer.from(JSON.stringify(runnerParams)) },
    ])

    // 4. Run agent
    console.log(`[vercel-sandbox] Running ${params.agentType} agent`)
    const agentCmd = await sandbox.runCommand({
      cmd: 'node',
      args: ['/vercel/sandbox/agent-runner.js'],
      cwd: '/vercel/sandbox',
      stdout: process.stdout,
      stderr: process.stderr,
    })

    const exitCode = agentCmd.exitCode
    console.log(`[vercel-sandbox] Agent process exited with code ${exitCode}`)

    // 5. Read result
    const resultBuffer = await sandbox.readFileToBuffer({ path: '/vercel/sandbox/result.json' })
    if (!resultBuffer) {
      const agentStderr = await agentCmd.stderr()
      throw new Error(`Agent runner did not produce result.json (exit ${exitCode}). Stderr: ${agentStderr.slice(-1000)}`)
    }

    const result: RunnerResult = JSON.parse(resultBuffer.toString('utf-8'))
    console.log(`[vercel-sandbox] Runner result: success=${result.success}, answer=${result.answer.slice(0, 100)}, duration=${result.duration}s`)

    // 6. Compute costs server-side
    const browserCost = computeBrowserCost(result.duration)
    let llmCost: number

    if (params.agentType === 'claude-code' && result.sdkCostUsd != null) {
      llmCost = result.sdkCostUsd
    } else {
      llmCost = computeCost(SDK_AGENT_MODELS[params.agentType].record, result.usage)
    }

    const totalCost = llmCost + browserCost

    return {
      usage: {
        input_tokens: result.usage.input_tokens,
        output_tokens: result.usage.output_tokens,
        cached_tokens: result.usage.cached_tokens,
        total_tokens: result.usage.input_tokens + result.usage.output_tokens,
        total_cost: totalCost,
        llm_cost: llmCost,
        browser_cost: browserCost,
      },
      cost: totalCost,
      duration: result.duration,
      answer: result.answer,
      logs: result.logs,
      success: result.success,
      metadata: {
        ...result.metadata,
        sandboxId: sandbox.sandboxId,
      },
    }
  } finally {
    if (sandbox) {
      try {
        console.log(`[vercel-sandbox] Stopping sandbox ${sandbox.sandboxId}`)
        await sandbox.stop()
      } catch (err) {
        console.warn(`[vercel-sandbox] Failed to stop sandbox:`, err)
      }
    }
  }
}
