import { Router } from 'express'
import { z } from 'zod'
import { bearerAuth } from '../lib/auth.js'
import { getConvexBackendClient } from '../lib/convex.js'
import { Stagehand } from '@browserbasehq/stagehand'
import { tool } from 'ai'
import { randomUUID } from 'node:crypto'

export const router = Router()

const bodySchema = z.object({
  sessionId: z.string().min(1),
  instruction: z.string().min(1),
  model: z.string().optional(),
  thinkingModel: z.string().optional(),
  executionModel: z.string().optional(),
  cdpUrl: z.string().url().min(1),
  liveViewUrl: z.string().url().optional(),
  userId: z.string().optional(),
  agentId: z.string().optional(),
  keys: z
    .object({ openai: z.string().optional(), google: z.string().optional(), anthropic: z.string().optional() })
    .optional(),
  fileData: z.object({ name: z.string(), mimeType: z.string(), data: z.string() }).optional(),
})

function determineKey(model: string | undefined, keys: { openai?: string; google?: string; anthropic?: string } = {}): string {
  const m = (model || '').toLowerCase()
  if (m.includes('google') || m.includes('gemini')) return (keys.google || process.env.GOOGLE_API_KEY || '').trim()
  if (m.includes('anthropic') || m.includes('claude')) return (keys.anthropic || process.env.ANTHROPIC_API_KEY || '').trim()
  return (keys.openai || process.env.OPENAI_API_KEY || '').trim()
}

// LLM pricing per 1M tokens
const pricing: Record<string, { in: number; out: number; cached: number }> = {
  'google/gemini-2.5-flash': {
    in: 0.3 / 1_000_000,
    out: 2.5 / 1_000_000,
    cached: 0.03 / 1_000_000,
  },
  'google/gemini-2.5-pro': {
    in: 1.25 / 1_000_000,
    out: 10.0 / 1_000_000,
    cached: 0.3125 / 1_000_000,
  },
  'openai/gpt-4.1': {
    in: 2.0 / 1_000_000,
    out: 8.0 / 1_000_000,
    cached: 0.5 / 1_000_000,
  },
  'anthropic/claude-haiku-4.5': {
    in: 1.0 / 1_000_000,
    out: 5.0 / 1_000_000,
    cached: 0.1 / 1_000_000,
  },
}

function computeCost(model: string | undefined, usage: any): number {
  if (!usage) return 0

  const modelKey = model ?? 'google/gemini-2.5-flash'
  const price = pricing[modelKey] || {
    in: 0.5 / 1_000_000,
    out: 3.0 / 1_000_000,
    cached: 0.1 / 1_000_000,
  }

  const inputTokens = usage.input_tokens || 0
  const outputTokens = usage.output_tokens || 0
  const cachedTokens = usage.cached_tokens || usage.input_tokens_cached || 0

  return inputTokens * price.in + outputTokens * price.out + cachedTokens * price.cached
}

router.post('/stagehand', bearerAuth, async (req, res) => {
  const requestId = randomUUID()
  const routeStart = Date.now()
  try {
    const body = req.body || {}
    const safe = {
      ...body,
      keys: body.keys ? Object.fromEntries(Object.entries(body.keys).map(([k, v]: any) => [k, v ? `${String(v).slice(0, 4)}…` : v])) : undefined,
      fileData: body.fileData ? { name: body.fileData.name, mimeType: body.fileData.mimeType, data: `<${body.fileData.data?.length || 0}b>` } : undefined,
    }
    console.log(`[${requestId}] → POST /agent/stagehand`, safe)
  } catch {
    console.log(`[${requestId}] → POST /agent/stagehand (body log failed)`)
  }

  const parse = bodySchema.safeParse(req.body)
  if (!parse.success) {
    console.error(`[${requestId}] ✖ validation`, parse.error.flatten())
    res.status(400).json({ error: 'Invalid request', details: parse.error.flatten(), requestId })
    return
  }

  const {
    sessionId,
    instruction,
    model,
    thinkingModel,
    executionModel,
    cdpUrl,
    liveViewUrl,
    agentId: maybeAgentId,
    keys,
    fileData,
  } = parse.data

  const convex = getConvexBackendClient()
  const startTime = Date.now()

  let agentId = maybeAgentId || ''
  try {
    if (!agentId) {
      const t = Date.now()
      console.log(`[${requestId}] creating agent (session=${sessionId})`)
      agentId = await convex.createAgentFromBackend({
        sessionId,
        name: 'stagehand',
        model,
        browser: { sessionId: 'external', url: liveViewUrl || '' },
      })
      console.log(`[${requestId}] created agent ${agentId} in ${Date.now() - t}ms`)
    }

    await convex.updateAgentStatusRunning(agentId)
    console.log(`[${requestId}] status → running (${agentId})`)
    if (liveViewUrl) {
      await convex.updateAgentBrowserUrl(agentId, liveViewUrl)
      console.log(`[${requestId}] liveViewUrl updated`)
    }

    const modelString = model || 'google/gemini-2.5-flash'
    const apiKey = determineKey(modelString, keys || {})
    if (!apiKey) {
      await convex.updateAgentStatusFailed(agentId, 'Missing model API key')
      console.error(`[${requestId}] ✖ apiKey for model ${modelString}`)
      res.status(500).json({ error: 'Server misconfigured: missing model API key', requestId, step: 'apiKey' })
      return
    }

    console.log(`[${requestId}] stagehand.init (cdpUrl) starting, verbose=${process.env.NODE_ENV === 'production' ? 0 : 1}, disablePino=${process.env.NODE_ENV === 'production'}`)

    const stagehand = new Stagehand({
      env: 'LOCAL',
      verbose: process.env.NODE_ENV === 'production' ? 0 : 1,
      disablePino: process.env.NODE_ENV === 'production',
      model: { modelName: modelString, apiKey },
      localBrowserLaunchOptions: { cdpUrl },
    })

    // Initialize and run
    // @ts-ignore stagehand.init() may return debug/session info depending on env
    console.log(`[${requestId}] stagehand.init (cdpUrl) starting`)
    const initT = Date.now()
    const initResult = await stagehand.init().catch(async (e: any) => {
      console.error(`[${requestId}] ✖ stagehand.init`, { error: e?.message, stack: e?.stack })
      await convex.updateAgentStatusFailed(agentId, `init failed: ${e?.message || String(e)}`)
      throw e
    })
    console.log(`[${requestId}] stagehand.init done in ${Date.now() - initT}ms`)

    const planningModel = thinkingModel || modelString
    const execution = executionModel || planningModel

    console.log(`[${requestId}] creating stagehand agent (plan=${planningModel}, exec=${execution})`)
    const agent = await stagehand.agent({
      model: planningModel,
      executionModel: execution,
      systemPrompt: fileData
        ? `You are a helpful assistant. You also have the ability to upload files to the browser using the uploadFile tool.`
        : undefined,
    })

    console.log(`[${requestId}] agent.execute start (instructionLen=${instruction.length})`)
    const execT = Date.now()
    const result = await agent.execute({
      instruction,
      highlightCursor: true,
    }).catch(async (e: any) => {
      console.error(`[${requestId}] ✖ agent.execute`, { error: e?.message, stack: e?.stack })
      await stagehand.close().catch(() => { })
      await convex.updateAgentStatusFailed(agentId, `execute failed: ${e?.message || String(e)}`)
      throw e
    })
    console.log(`[${requestId}] agent.execute done in ${Date.now() - execT}ms`)
    const endTime = Date.now()
    const duration = (endTime - startTime) / 1000 // Convert to seconds

    // Clean up
    await stagehand.close().catch((e: any) => console.warn(`[${requestId}] stagehand.close warning`, { error: e?.message }))

    // Calculate costs
    const usageData = result?.usage ?? { input_tokens: 0, output_tokens: 0, inference_time_ms: 0 }
    const llmCost = computeCost(modelString, usageData)
    // Anchor Browser pricing: $0.01 base + $0.05 per hour
    const hours = Math.max(duration / 3600, 0)
    const browserCost = 0.01 + 0.05 * hours
    const cost = llmCost + browserCost

    // Format usage with cost breakdown
    const usageWithCost = {
      ...usageData,
      total_cost: cost,
      browser_cost: browserCost,
      llm_cost: llmCost,
    }

    // Build final payload matching original format
    const payload = {
      usage: usageWithCost,
      cost, // Also keep cost field for backward compatibility
      duration,
      message: result?.message ?? result,
      actions: result?.actions ?? [],
      success: result?.success ?? true,
      agent: 'stagehand',
      completed: result?.completed ?? true,
      metadata: {
        durationMs: endTime - startTime,
        init: initResult ?? {},
        ...(result?.metadata || {}),
      },
    }

    // Check if payload is too large (over 1MB)
    const payloadSize = JSON.stringify(payload).length
    if (payloadSize > 1024 * 1024) {
      console.error(`[${requestId}] ❌ payload too large: ${payloadSize}b, trimming actions`)
      // Send a trimmed version without actions
      const trimmedPayload = {
        ...payload,
        actions: [], // Remove actions to save space
      }
      await convex.updateAgentResult(agentId, trimmedPayload, 'completed').catch((e: any) => console.error(`[${requestId}] updateAgentResult (trimmed) failed`, { error: e?.message }))
    } else {
      await convex.updateAgentResult(agentId, payload, 'completed').catch((e: any) => console.error(`[${requestId}] updateAgentResult failed`, { error: e?.message }))
    }

    console.log(`[${requestId}] ✔ success in ${Date.now() - routeStart}ms`)
    res.status(200).json({ agentId, liveUrl: liveViewUrl || '', requestId })
  } catch (e: any) {
    const message = e?.message || String(e)
    try {
      if (agentId) await convex.updateAgentStatusFailed(agentId, message)
    } catch { }
    console.error(`[${requestId}] ❌ failed`, { error: message, stack: e?.stack })
    res.status(500).json({ error: 'Stagehand execution failed', message, requestId })
  }
})


