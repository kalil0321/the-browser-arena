type Provider = "openai" | "anthropic" | "google" | "smooth" | "anchor";

export function hasEnv(varName: string): boolean {
    return !!process.env[varName] && String(process.env[varName]).trim().length > 0;
}

export function providerDisplayName(provider: Provider): string {
    switch (provider) {
        case "openai":
            return "OpenAI";
        case "anthropic":
            return "Anthropic";
        case "google":
            return "Google AI";
        case "smooth":
            return "Smooth";
        case "anchor":
            return "Anchor Browser";
        default:
            return provider;
    }
}

export function looksLikeOpenAIKey(key: string): boolean {
    return /^sk-[A-Za-z0-9]{20,}/.test(key.trim());
}

export function looksLikeAnthropicKey(key: string): boolean {
    return /^sk-ant-[A-Za-z0-9_-]{10,}/.test(key.trim());
}

export function looksLikeGoogleKey(key: string): boolean {
    return /^AIza[0-9A-Za-z_-]{10,}/.test(key.trim());
}

export function nonEmptyKey(key?: string | null): boolean {
    return !!key && key.trim().length > 0;
}

export function fingerprintKey(key: string): string {
    if (!key) return "";
    const k = key.trim();
    if (k.length <= 8) return k.replace(/./g, "*");
    return `${k.slice(0, 4)}...${k.slice(-4)}`;
}


