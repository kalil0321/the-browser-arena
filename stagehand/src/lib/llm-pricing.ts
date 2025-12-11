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
    "google/gemini-3-pro-preview": {
        "in": 2 / 1_000_000,
        "out": 12.0 / 1_000_000,
        "cached": 0.2 / 1_000_000,
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
    'openrouter/moonshotai/kimi-k2-thinking': {
        in: 0.6 / 1_000_000,
        out: 2.5 / 1_000_000,
        cached: 0.06 / 1_000_000,
    },
}


export function computeCost(model: string | undefined, usage: any): number {
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