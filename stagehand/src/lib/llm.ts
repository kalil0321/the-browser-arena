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