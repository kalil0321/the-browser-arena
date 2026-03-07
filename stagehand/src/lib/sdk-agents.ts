import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { getConvexBackendClient } from './convex.js'
import { runAgentInSandbox } from './vercel-sandbox.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

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
    const result = await runAgentInSandbox({
      agentType: params.agentType,
      instruction: params.instruction,
      cdpUrl: params.cdpUrl,
      mcpType: params.mcpType,
      requestId: params.requestId,
    })

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
    const message = error instanceof Error ? error.message : (typeof error === 'string' ? error : JSON.stringify(error))
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
