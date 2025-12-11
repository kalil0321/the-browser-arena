import { createOpenAI } from '@ai-sdk/openai';
import { AISdkClient } from '@browserbasehq/stagehand';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

export function openrouter(model: string, apiKey?: string) {
    return createOpenRouter({
        apiKey: apiKey || process.env.OPENROUTER_API_KEY,
    })(model);
}


export class AISdkClientWithLanguageModel extends AISdkClient {
    private modelInstance: any;

    constructor(config: { model: any }) {
        super(config);
        this.modelInstance = config.model;
    }

    getLanguageModel() {
        return this.modelInstance;
    }
}


export function isCUA(model: string): boolean {
    return model.includes('computer-use') || model.includes('claude');
}

export function isOpenRouter(model: string): boolean {
    return model.includes('openrouter')
}



export function determineKey(model: string | undefined, keys: { openai?: string; google?: string; anthropic?: string; openrouter?: string } = {}): string {
    const m = (model || '').toLowerCase()
    if (m.includes('openrouter')) return (keys.openrouter || process.env.OPENROUTER_API_KEY || '').trim()
    if (m.includes('google') || m.includes('gemini')) return (keys.google || process.env.GOOGLE_API_KEY || '').trim()
    if (m.includes('anthropic') || m.includes('claude')) return (keys.anthropic || process.env.ANTHROPIC_API_KEY || '').trim()
    return (keys.openai || process.env.OPENAI_API_KEY || '').trim()
}

export function formatModelName(model: string, provider: string): string {
    return model.includes(provider) ? model.split('/').slice(1).join('/') : model
}

export function validateModelName(model: string): string {
    return model;
}