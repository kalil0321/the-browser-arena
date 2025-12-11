import { Router } from 'express'
import { bearerAuth } from '../lib/auth.js'
import { getConvexBackendClient } from '../lib/convex.js'
import { AISdkClient, Stagehand } from '@browserbasehq/stagehand'
import { randomUUID } from 'node:crypto'
import { openrouter, AISdkClientWithLanguageModel } from '../lib/llm.js'
// import { startBrowserAgent } from 'magnitude-core'
import { bodySchema, magnitudeBodySchema, validateSecrets } from '../lib/body-validation.js'
import { determineKey, formatModelName, isCUA, isOpenRouter, validateModelName } from '../lib/llm.js'
import { computeBrowserCost } from '../lib/browser.js'
import { computeCost } from '../lib/llm-pricing.js'

export const router = Router()

function createOpenRouterClient(model: string, apiKey?: string): AISdkClient {
  return new AISdkClientWithLanguageModel({
    model: openrouter(model, apiKey),
  })
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
      secrets: body.secrets ? { count: Object.keys(body.secrets).length } : undefined, // Don't log secret keys for security
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

  let { model, thinkingModel, executionModel } = parse.data
  model = validateModelName(model)
  thinkingModel = validateModelName(thinkingModel)
  executionModel = validateModelName(executionModel)

  const {
    sessionId,
    instruction,
    cdpUrl,
    liveViewUrl,
    agentId: maybeAgentId,
    keys,
    fileData,
    secrets,
  } = parse.data

  // Validate secrets (defense in depth - also validated in Next.js routes)
  if (secrets) {
    const secretsValidation = validateSecrets(secrets)
    if (!secretsValidation.isValid) {
      console.warn(`[${requestId}] ✖ secrets validation failed: ${secretsValidation.error}`)
      res.status(400).json({ error: `Invalid secrets: ${secretsValidation.error}`, requestId })
      return
    }

    // Log secrets count without exposing key names for security
    console.log(`[${requestId}] 🔐 Secrets provided`, {
      count: Object.keys(secrets).length,
    })
  }

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

    console.log(`[${requestId}] 🔑 Checking API key for model: ${model}`)
    console.log(`[${requestId}] 🔑 Keys from request:`, keys ? 
      { anthropic: keys.anthropic ? `${keys.anthropic.slice(0, 4)}...` : 'missing', 
      google: keys.google ? `${keys.google.slice(0, 4)}...` : 'missing', 
      openai: keys.openai ? `${keys.openai.slice(0, 4)}...` : 'missing', 
      openrouter: keys.openrouter ? `${keys.openrouter.slice(0, 4)}...` : 'missing', 
      groq: keys.groq ? `${keys.groq.slice(0, 4)}...` : 'missing' } : 'none')
      
    console.log(`[${requestId}] 🔑 Environment keys:`, {
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? `${process.env.ANTHROPIC_API_KEY.slice(0, 4)}...` : 'missing',
      GOOGLE_API_KEY: process.env.GOOGLE_API_KEY ? `${process.env.GOOGLE_API_KEY.slice(0, 4)}...` : 'missing',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? `${process.env.OPENAI_API_KEY.slice(0, 4)}...` : 'missing',
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ? `${process.env.OPENROUTER_API_KEY.slice(0, 4)}...` : 'missing',
      GROQ_API_KEY: process.env.GROQ_API_KEY ? `${process.env.GROQ_API_KEY.slice(0, 4)}...` : 'missing',
    })
    const apiKey = determineKey(model, keys || {})
    console.log(`[${requestId}] 🔑 Determined API key:`, apiKey ? `${apiKey.slice(0, 4)}...` : 'EMPTY')
    if (!apiKey && !isOpenRouter(model)) {
      await convex.updateAgentStatusFailed(agentId, 'Missing model API key')
      console.error(`[${requestId}] ✖ apiKey for model ${model}`)
      res.status(500).json({ error: 'Server misconfigured: missing model API key', requestId, step: 'apiKey' })
      return
    }

    console.log(`[${requestId}] stagehand.init (cdpUrl) starting, verbose=${process.env.NODE_ENV === 'production' ? 0 : 1}, disablePino=${process.env.NODE_ENV === 'production'}`)

    const planning = thinkingModel || model
    const execution = executionModel || planning

    // Check if any model (main, planning, or execution) is OpenRouter
    const hasOpenRouterModel = isOpenRouter(model) || isOpenRouter(planning) || isOpenRouter(execution)
    const openRouterApiKey = hasOpenRouterModel ? determineKey(model, keys || {}) : undefined

    const stagehand = new Stagehand({
      env: 'LOCAL',
      llmClient: isOpenRouter(model) ? createOpenRouterClient(formatModelName(model, "openrouter"), openRouterApiKey) : undefined,
      verbose: process.env.NODE_ENV === 'production' ? 0 : 1,
      disablePino: process.env.NODE_ENV === 'production',
      model: isOpenRouter(model) ? undefined : { modelName: formatModelName(model, "openrouter"), apiKey },
      localBrowserLaunchOptions: { cdpUrl, viewport: { width: 1288, height: 711 } },
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

    console.log(`[${requestId}] creating stagehand agent (plan=${planning}, exec=${execution})`)

    let agent;

    if (isOpenRouter(planning) || isOpenRouter(execution) || isOpenRouter(model)) {
      console.log(`[${requestId}] OPENROUTER: creating stagehand agent (plan=${planning}, exec=${execution}, model=${model})`)
      agent = await stagehand.agent();
    } else {
      console.log(`[${requestId}] NOT OPENROUTER: creating stagehand agent (plan=${planning}, exec=${execution}, model=${model})`)
      agent = await stagehand.agent({
        cua: isCUA(planning),
        model: formatModelName(planning, "openrouter"),
        executionModel: formatModelName(execution, "openrouter"),
        systemPrompt: fileData
          ? `You are a helpful assistant. You also have the ability to upload files to the browser using the uploadFile tool.`
          : undefined,
      })
    }

    console.log(`[${requestId}] agent.execute start (instructionLen=${instruction.length})`)
    if (secrets) {
      // Log secrets count without exposing key names for security
      console.log(`[${requestId}] Forwarding secrets to agent.execute`, {
        count: Object.keys(secrets).length,
      })
    }
    const execT = Date.now()
    const result = await agent.execute({
      instruction: instruction + "Don't forget to include the answer to my query in the final answer.",
      maxSteps: 30,
      highlightCursor: false,
      ...(secrets && { variables: secrets }),
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

    const usageData = result?.usage ?? { input_tokens: 0, output_tokens: 0, inference_time_ms: 0 }
    const llmCost = computeCost(model, usageData)
    const browserCost = computeBrowserCost(duration)
    const cost = llmCost + browserCost

    // Format usage with cost breakdown
    const usageWithCost = {
      ...usageData,
      total_cost: cost,
      browser_cost: browserCost,
      llm_cost: llmCost,
    }

    // Extract structured extraction output (if present) so it is persisted even when actions are trimmed.
    const normalizeExtraction = (raw: any) => {
      if (!raw) return undefined
      if (Array.isArray(raw)) return raw
      if (typeof raw === 'string') {
        try {
          return JSON.parse(raw)
        } catch {
          return raw
        }
      }
      return raw
    }

    const extractionResults = normalizeExtraction(
      result?.message?.object?.extraction ??
      result?.message?.extraction ??
      result?.message?.object?.value ??
      result?.message?.value ??
      result?.message?.output ??
      undefined
    )

    // Build final payload matching original format
    const payload = {
      usage: usageWithCost,
      cost, // Also keep cost field for backward compatibility
      duration,
      message: result?.message ?? result,
      actions: result?.actions ?? [],
      extraction: extractionResults ?? result?.extraction,
      success: result?.success ?? true,
      agent: 'stagehand',
      completed: result?.completed ?? true,
      metadata: {
        durationMs: endTime - startTime,
        init: initResult ?? {},
        ...(result?.metadata || {}),
        ...(extractionResults ? { extractionResults } : {}),
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



// router.post('/magnitude', bearerAuth, async (req, res) => {
//   const requestId = randomUUID()
//   const parse = magnitudeBodySchema.safeParse(req.body)
//   if (!parse.success) {
//     console.error(`[${requestId}] ✖ validation`, parse.error.flatten())
//     res.status(400).json({ error: 'Invalid request', details: parse.error.flatten(), requestId })
//     return;
//   }

//   const { instruction, model, cdpUrl, liveViewUrl, userId } = parse.data;


//   const agent = await startBrowserAgent({
//     // Starting URL for agent
//     url: 'about:blank',
//     // Show thoughts and actions
//     narrate: false,
//     // LLM configuration
//     llm: {
//       provider: 'anthropic',
//       options: {
//         model: model
//       }
//     },
//   });

//   await agent.act(instruction);

//   const result = await agent.query("What is the output for the following task: " + instruction + "?", z.object({
//     result: z.string(),
//   }));

//   return res.status(200).json(result);
// });
