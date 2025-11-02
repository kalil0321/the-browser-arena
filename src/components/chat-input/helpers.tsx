import React from "react";
import { Bot } from "lucide-react";
import { OpenAI } from "@/components/logos/openai";
import { GeminiLogo } from "@/components/logos/gemini";
import { ClaudeLogo } from "@/components/logos/claude";
import { BrowserUseLogo } from "@/components/logos/bu";
import { cn } from "@/lib/utils";

// Helper to detect provider from browser-use cloud model names
export const detectProviderFromModelName = (modelName: string): string => {
    if (modelName.startsWith("gpt-") || modelName === "o3") {
        return "openai";
    }
    if (modelName.startsWith("gemini-")) {
        return "google";
    }
    if (modelName.startsWith("claude-")) {
        return "anthropic";
    }
    if (modelName === "browser-use-llm" || modelName === "bu-1.0") {
        return "browser-use";
    }
    return "";
};

// Helper to format model names
export const formatModelName = (model: string) => {
    const parts = model.split("/");
    if (parts.length >= 2) {
        const provider = parts[0];
        const modelName = parts.slice(1).join("/");
        return { provider, modelName };
    }
    // Models without "/" (like Browser Use Cloud models)
    const provider = detectProviderFromModelName(model);
    return { provider, modelName: model };
};

// Helper to get provider display name
export const getProviderName = (provider: string) => {
    const providerMap: Record<string, string> = {
        "google": "Google",
        "openai": "OpenAI",
        "anthropic": "Anthropic",
        "browser-use": "Browser-Use"
    };
    // Handle Browser Use Cloud models that don't have provider prefix
    if (provider === "" || !provider) {
        return "Browser-Use Cloud";
    }
    return providerMap[provider] || provider;
};

// Helper to get provider logo
export const ProviderLogo: React.FC<{ provider: string; className?: string }> = ({ provider, className }) => {
    switch (provider) {
        case "openai":
            return <OpenAI className={cn("h-4 w-4", className)} />;
        case "google":
            return <GeminiLogo className={cn("h-4 w-4", className)} />;
        case "anthropic":
            return <ClaudeLogo className={cn("h-4 w-4", className)} />;
        case "browser-use":
            return <BrowserUseLogo className={cn("h-4 w-4", className)} />;
        default:
            return <Bot className={cn("h-4 w-4 text-muted-foreground", className)} />;
    }
};

// Helper to get short model name for badges
export const getShortModelName = (model: string): string => {
    const { provider, modelName } = formatModelName(model);
    // Return short version of model name
    if (modelName.toLowerCase().includes("gemini")) {
        if (modelName.toLowerCase().includes("computer-use")) {
            return "Gemini CUA";
        }
        if (modelName.toLowerCase().includes("pro")) {
            return "Gemini Pro";
        }
        if (modelName.toLowerCase().includes("flash")) {
            return "Gemini Flash";
        }
        return "Gemini";
    }
    if (modelName.toLowerCase().includes("gpt") || modelName === "gpt-4.1") {
        return modelName;
    }
    if (modelName.toLowerCase().includes("computer-use")) {
        return "Computer Use";
    }
    if (modelName.toLowerCase().includes("claude")) {
        if (modelName === "claude-3-7-sonnet-latest") {
            return "Claude 3.7 Sonnet CUA";
        }
        if (modelName === "claude-haiku-4-5-20251001") {
            return "Claude Haiku CUA";
        }
        if (modelName === "claude-sonnet-4-20250514") {
            return "Claude Sonnet 4 CUA";
        }
        if (modelName === "claude-sonnet-4-5-20250929") {
            return "Claude Sonnet 4.5 CUA";
        }
        if (modelName.toLowerCase().includes("sonnet")) {
            return "Claude Sonnet";
        }
        if (modelName.toLowerCase().includes("haiku")) {
            return "Claude Haiku";
        }
        return "Claude";
    }
    if (modelName === "browser-use-llm" || modelName === "bu-1.0" || modelName === "browser-use/bu-1.0") {
        return "BU LLM";
    }
    if (modelName === "o3") {
        return "O3";
    }
    // Fallback: return model name as-is, truncate if too long
    return modelName.length > 15 ? modelName.substring(0, 12) + "..." : modelName;
};

