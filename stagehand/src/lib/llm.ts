import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { AISdkClient } from '@browserbasehq/stagehand';

export function openrouter(model: string, apiKey?: string) {
    return createOpenRouter({
        apiKey: apiKey || process.env.OPENROUTER_API_KEY,
    })(model);
}