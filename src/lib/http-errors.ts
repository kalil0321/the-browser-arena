import { NextResponse } from "next/server";

type ErrorBody = {
    error: { code: string; message: string };
    details?: Record<string, any>;
    correlationId: string;
};

function generateCorrelationId(): string {
    return `req_${Math.random().toString(36).slice(2)}`;
}

function redactSecrets(details: any): any {
    if (!details || typeof details !== "object") return details;
    const clone: any = Array.isArray(details) ? [...details] : { ...details };
    for (const key of Object.keys(clone)) {
        const lower = key.toLowerCase();
        if (lower.includes("apikey") || lower.includes("api_key") || lower.includes("authorization") || lower.includes("token") || lower.includes("secret")) {
            clone[key] = "[REDACTED]";
        } else if (typeof clone[key] === "object") {
            clone[key] = redactSecrets(clone[key]);
        }
    }
    return clone;
}

export function err(opts: { code: string; message: string; status: number; details?: Record<string, any> }) {
    const correlationId = generateCorrelationId();
    const body: ErrorBody = {
        error: { code: opts.code, message: opts.message },
        details: redactSecrets(opts.details),
        correlationId,
    };
    return NextResponse.json(body, {
        status: opts.status,
        headers: { "X-Correlation-Id": correlationId },
    });
}

export const badRequest = (message: string, details?: Record<string, any>) =>
    err({ code: "BAD_REQUEST", message, status: 400, details });

export const unauthorized = (message = "Unauthorized") =>
    err({ code: "UNAUTHORIZED", message, status: 401 });

export const forbidden = (message = "Forbidden") =>
    err({ code: "FORBIDDEN", message, status: 403 });

export const missingKey = (provider: string, managed: boolean) =>
    err({
        code: "MISSING_API_KEY",
        message: `${provider} API key is missing`,
        status: managed ? 503 : 422,
        details: { provider, hint: managed ? "Set server env var" : "Add key in Settings" },
    });

export const invalidKey = (provider: string) =>
    err({ code: "INVALID_API_KEY", message: `Invalid ${provider} API key`, status: 401, details: { provider } });

export const rateLimited = (provider: string, retryAfter?: string | null) =>
    err({ code: "RATE_LIMITED", message: `${provider} rate limit exceeded`, status: 429, details: { provider, retryAfter } });

export const providerUnavailable = (provider: string, details?: Record<string, any>) =>
    err({ code: "PROVIDER_UNAVAILABLE", message: `${provider} service unavailable`, status: 503, details: { provider, ...details } });

export const serverMisconfigured = (message: string, details?: Record<string, any>) =>
    err({ code: "SERVER_MISCONFIGURED", message, status: 503, details });

export async function mapProviderError(response: Response, provider: string) {
    if (response.status === 401 || response.status === 403) {
        return invalidKey(provider);
    }
    if (response.status === 429) {
        return rateLimited(provider, response.headers.get("retry-after"));
    }
    const text = await response.text().catch(() => "");
    return err({
        code: "PROVIDER_ERROR",
        message: `${provider} error`,
        status: 502,
        details: { provider, status: response.status, body: text?.slice(0, 500) },
    });
}


