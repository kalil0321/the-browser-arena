import { z } from "zod";

export const bodySchema = z.object({
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
    .object({ openai: z.string().optional(), google: z.string().optional(), anthropic: z.string().optional(), openrouter: z.string().optional(), groq: z.string().optional() })
    .optional(),
  fileData: z.object({ name: z.string(), mimeType: z.string(), data: z.string() }).optional(),
  secrets: z.record(z.string(), z.string()).optional(),
})


export const magnitudeBodySchema = z.object({
  instruction: z.string().min(1),
  model: z.string().min(1),
  cdpUrl: z.string().url().min(1),
  liveViewUrl: z.string().url().optional(),
  userId: z.string().optional(),
})

// Security validation functions
const ALLOWED_SECRET_KEYS = new Set([
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GOOGLE_API_KEY',
  'OPENROUTER_API_KEY',
  'BROWSER_USE_API_KEY',
  'GROQ_API_KEY',
])

const MAX_SECRET_VALUE_LENGTH = 500
const MAX_SECRET_KEY_LENGTH = 100

export function validateSecrets(secrets: Record<string, string> | undefined): { isValid: boolean; error?: string } {
  if (!secrets) {
    return { isValid: true }
  }

  if (typeof secrets !== 'object' || Array.isArray(secrets)) {
    return {
      isValid: false,
      error: 'Secrets must be an object with string keys and values',
    }
  }

  const secretKeys = Object.keys(secrets)

  // Validate against whitelist
  for (const key of secretKeys) {
    if (!ALLOWED_SECRET_KEYS.has(key)) {
      return {
        isValid: false,
        error: `Invalid secret key: ${key}. Only allowed secret keys are permitted.`,
      }
    }
  }

  // Validate key and value lengths
  for (const [key, value] of Object.entries(secrets)) {
    if (typeof key !== 'string' || key.length === 0) {
      return {
        isValid: false,
        error: 'Secret keys must be non-empty strings',
      }
    }

    if (key.length > MAX_SECRET_KEY_LENGTH) {
      return {
        isValid: false,
        error: `Secret key too long: ${key.length} characters (max: ${MAX_SECRET_KEY_LENGTH})`,
      }
    }

    if (typeof value !== 'string') {
      return {
        isValid: false,
        error: `Secret value for ${key} must be a string`,
      }
    }

    if (value.length > MAX_SECRET_VALUE_LENGTH) {
      return {
        isValid: false,
        error: `Secret value for ${key} too long: ${value.length} characters (max: ${MAX_SECRET_VALUE_LENGTH})`,
      }
    }
  }

  return { isValid: true }
}

