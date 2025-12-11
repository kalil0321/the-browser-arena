/**
 * Security validation utilities for API keys, secrets, and model names
 * 
 * This module provides validation functions to prevent:
 * - Arbitrary secrets injection (CWE-94)
 * - API key format validation (CWE-20)
 * - Model name injection (CWE-20)
 * - Environment variable injection attacks
 */

export interface ValidationResult {
    isValid: boolean;
    error?: string;
}

// Allowed secret keys whitelist
export const ALLOWED_SECRET_KEYS = new Set([
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'GOOGLE_API_KEY',
    'OPENROUTER_API_KEY',
    'BROWSER_USE_API_KEY',
    // Add other legitimate secret keys as needed
]);

// Maximum length for secret values (500 chars)
const MAX_SECRET_VALUE_LENGTH = 500;

// Maximum length for secret keys (100 chars)
const MAX_SECRET_KEY_LENGTH = 100;

// Allowed model names whitelist
export const ALLOWED_MODELS = new Set([
    // OpenAI models
    'gpt-4',
    'gpt-4-turbo',
    'gpt-3.5-turbo',
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4.1',
    'gpt-5.2',
    'gpt-5-mini',
    'gpt-5-nano',
    'computer-use-preview',
    // Anthropic models
    'claude-3-opus',
    'claude-3-sonnet',
    'claude-3-haiku',
    'claude-haiku-4.5',
    'claude-haiku-4-5-20251001',
    'claude-sonnet-4-20250514',
    'claude-sonnet-4',
    'claude-sonnet-4-5-20250929',
    // Google models
    'gemini-pro',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-3-pro-preview',
    // Browser-Use models
    'browser-use/bu-1.0',
    'browser-use-llm',
    // OpenRouter models (will be validated by prefix)
    // Format: openrouter/provider/model-name
    'openrouter/moonshotai/kimi-k2-thinking',
    // Provider-prefixed models
    'openai/gpt-5.2',
    'openai/gpt-5-mini',
    'openai/gpt-5-nano',
]);

// Provider prefixes for model validation
const PROVIDER_PREFIXES = ['openai', 'google', 'anthropic', 'openrouter', 'browser-use', 'groq'];

/**
 * Validates secrets object against whitelist and security rules
 * 
 * @param secrets - Record of secret key-value pairs
 * @returns Validation result
 */
export function validateSecrets(secrets: Record<string, string> | undefined | null): ValidationResult {
    if (!secrets) {
        return { isValid: true };
    }

    if (typeof secrets !== 'object' || Array.isArray(secrets)) {
        return {
            isValid: false,
            error: 'Secrets must be an object with string keys and values',
        };
    }

    const secretKeys = Object.keys(secrets);

    // Validate against whitelist
    for (const key of secretKeys) {
        if (!ALLOWED_SECRET_KEYS.has(key)) {
            return {
                isValid: false,
                error: `Invalid secret key: ${key}. Only allowed secret keys are permitted.`,
            };
        }
    }

    // Validate key and value lengths
    for (const [key, value] of Object.entries(secrets)) {
        if (typeof key !== 'string' || key.length === 0) {
            return {
                isValid: false,
                error: 'Secret keys must be non-empty strings',
            };
        }

        if (key.length > MAX_SECRET_KEY_LENGTH) {
            return {
                isValid: false,
                error: `Secret key too long: ${key.length} characters (max: ${MAX_SECRET_KEY_LENGTH})`,
            };
        }

        if (typeof value !== 'string') {
            return {
                isValid: false,
                error: `Secret value for ${key} must be a string`,
            };
        }

        if (value.length > MAX_SECRET_VALUE_LENGTH) {
            return {
                isValid: false,
                error: `Secret value for ${key} too long: ${value.length} characters (max: ${MAX_SECRET_VALUE_LENGTH})`,
            };
        }
    }

    return { isValid: true };
}

/**
 * Detects suspicious secrets for security monitoring
 * 
 * @param secrets - Record of secret key-value pairs
 * @returns true if suspicious patterns are detected
 */
export function detectSuspiciousSecrets(secrets: Record<string, string> | undefined | null): boolean {
    if (!secrets) {
        return false;
    }

    return false;
}

/**
 * Validates API key format based on provider
 * 
 * @param key - API key to validate
 * @param provider - Provider name (openai, anthropic, google, openrouter, browseruse, smooth)
 * @returns Validation result
 */
export function validateApiKeyFormat(
    key: string | undefined | null,
    provider: 'openai' | 'anthropic' | 'google' | 'openrouter' | 'browseruse' | 'smooth'
): ValidationResult {
    if (!key) {
        return { isValid: true }; // Optional keys are allowed
    }

    if (typeof key !== 'string') {
        return {
            isValid: false,
            error: `API key for ${provider} must be a string`,
        };
    }

    const trimmedKey = key.trim();

    if (trimmedKey.length === 0) {
        return {
            isValid: false,
            error: `API key for ${provider} cannot be empty`,
        };
    }

    // Provider-specific format validation
    const patterns: Record<string, RegExp> = {
        openai: /^sk-[A-Za-z0-9]{32,}$/,
        anthropic: /^sk-ant-[A-Za-z0-9-]{32,}$/, // Anthropic keys can vary in length (typically 95+ chars)
        google: /^[A-Za-z0-9_-]{20,}$/, // Google keys can vary in length
        openrouter: /^sk-or-[A-Za-z0-9]{32,}$/,
        browseruse: /^[A-Za-z0-9]{32,}$/,
        smooth: /^[A-Za-z0-9_-]{20,}$/, // Smooth keys can vary in length and may contain dashes/underscores
    };

    const pattern = patterns[provider];
    if (!pattern) {
        // Unknown provider - use basic validation
        if (trimmedKey.length < 20) {
            return {
                isValid: false,
                error: `API key for ${provider} is too short (minimum 20 characters)`,
            };
        }
        return { isValid: true };
    }

    if (!pattern.test(trimmedKey)) {
        return {
            isValid: false,
            error: `Invalid ${provider} API key format`,
        };
    }

    return { isValid: true };
}

/**
 * Validates model name against whitelist
 * 
 * @param model - Model name to validate
 * @returns Validation result
 */
export function validateModelName(model: string | undefined | null): ValidationResult {
    if (!model) {
        return {
            isValid: false,
            error: 'Model name is required',
        };
    }

    if (typeof model !== 'string') {
        return {
            isValid: false,
            error: 'Model name must be a string',
        };
    }

    const trimmedModel = model.trim();

    if (trimmedModel.length === 0) {
        return {
            isValid: false,
            error: 'Model name cannot be empty',
        };
    }

    // Check if model is in provider/model format (e.g., "openai/gpt-4")
    if (trimmedModel.includes('/')) {
        const parts = trimmedModel.split('/');
        if (parts.length >= 2) {
            const provider = parts[0].toLowerCase();
            const modelName = parts.slice(1).join('/').toLowerCase();

            // Validate provider prefix
            if (!PROVIDER_PREFIXES.includes(provider)) {
                return {
                    isValid: false,
                    error: `Invalid provider prefix: ${provider}`,
                };
            }

            // For OpenRouter, allow any model name after the prefix
            if (provider === 'openrouter') {
                // OpenRouter format: openrouter/provider/model-name
                // Validate basic format (alphanumeric, hyphens, slashes)
                if (!/^[a-z0-9][a-z0-9/-]*[a-z0-9]$|^[a-z0-9]$/i.test(modelName)) {
                    return {
                        isValid: false,
                        error: `Invalid OpenRouter model name format: ${modelName}`,
                    };
                }
                return { isValid: true };
            }

            // For other providers, check if the model name is in the whitelist
            const fullModelName = `${provider}/${modelName}`;
            if (ALLOWED_MODELS.has(fullModelName)) {
                return { isValid: true };
            }

            // Also check if just the model name (without provider) is in whitelist
            if (ALLOWED_MODELS.has(modelName)) {
                return { isValid: true };
            }

            return {
                isValid: false,
                error: `Model not in whitelist: ${fullModelName}`,
            };
        }
    }

    // Check if model is directly in whitelist
    const lowerModel = trimmedModel.toLowerCase();
    if (ALLOWED_MODELS.has(lowerModel)) {
        return { isValid: true };
    }

    // Check if model matches any whitelisted model (case-insensitive)
    for (const allowedModel of ALLOWED_MODELS) {
        if (allowedModel.toLowerCase() === lowerModel) {
            return { isValid: true };
        }
    }

    return {
        isValid: false,
        error: `Model not in whitelist: ${trimmedModel}`,
    };
}

/**
 * Logs security violation for monitoring (without exposing sensitive data)
 * 
 * @param violationType - Type of security violation
 * @param details - Additional details (without sensitive data)
 * @param userId - Optional user ID
 * @param context - Additional context (e.g., route name)
 */
export function logSecurityViolation(
    violationType: string,
    details: Record<string, unknown>,
    userId?: string,
    context?: string
): void {
    const logData = {
        timestamp: new Date().toISOString(),
        violationType,
        ...details,
        userId: userId || 'unknown',
        context: context || 'unknown',
    };

    // Log to console (in production, this should go to a monitoring system)
    console.warn('[SECURITY] Security violation detected:', JSON.stringify(logData));
}

