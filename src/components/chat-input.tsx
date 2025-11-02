"use client";

import { useState, useRef, useEffect, startTransition, useMemo, useCallback, lazy, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Lazy load the LoadingDino component for better initial load performance
const LoadingDino = lazy(() => import("@/components/loading-dino").then(mod => ({ default: mod.LoadingDino })));
import { authClient } from "@/lib/auth/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Bot, Sparkles, Settings, CheckCircle2, XCircle, Plus, Trash2, Paperclip, X, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { getApiKey, hasApiKey } from "@/lib/api-keys";
import { Switch } from "@/components/ui/switch";
import { OpenAI } from "@/components/logos/openai";
import { GeminiLogo } from "@/components/logos/gemini";
import { ClaudeLogo } from "@/components/logos/claude";
import { BrowserUseLogo } from "@/components/logos/bu";
import { SmoothLogo } from "@/components/logos/smooth";
import { StagehandLogo } from "@/components/logos/stagehand";
import { AgentConfigDialog } from "./agent-config-dialog";
import { getClientFingerprint } from "@/lib/fingerprint";

type AgentType = "stagehand" | "smooth" | "stagehand-bb-cloud" | "browser-use" | "browser-use-cloud";
type ModelType = "google/gemini-2.5-flash" | "google/gemini-2.5-pro" | "openai/gpt-4.1" | "anthropic/claude-haiku-4.5" | "browser-use/bu-1.0" | "browser-use-llm" | "gemini-flash-latest" | "gpt-4.1" | "o3" | "claude-sonnet-4" | "openai/computer-use-preview" | "openai/computer-use-preview-2025-03-11" | "anthropic/claude-3-7-sonnet-latest" | "anthropic/claude-haiku-4-5-20251001" | "anthropic/claude-sonnet-4-20250514" | "anthropic/claude-sonnet-4-5-20250929" | "google/gemini-2.5-computer-use-preview-10-2025";

interface AgentConfig {
    id?: string; // Unique identifier for this agent instance
    agent: AgentType;
    model: ModelType;
    secrets?: Record<string, string>; // For browser-use: key-value pairs of secrets
    thinkingModel?: ModelType; // For stagehand: model used for thinking/planning
    executionModel?: ModelType; // For stagehand: model used for execution
}

const AGENT_LABELS: Record<AgentType, string> = {
    "stagehand": "Stagehand",
    "smooth": "Smooth",
    "stagehand-bb-cloud": "Stagehand Cloud", // Commented out in UI for now
    "browser-use": "BU",
    "browser-use-cloud": "BU Cloud"
};

const MODEL_OPTIONS: Record<AgentType, ModelType[]> = {
    "browser-use": ["browser-use/bu-1.0", "google/gemini-2.5-flash", "google/gemini-2.5-pro", "openai/gpt-4.1", "anthropic/claude-haiku-4.5"],
    "browser-use-cloud": ["browser-use-llm", "gemini-flash-latest", "gpt-4.1", "o3", "claude-sonnet-4"],
    "stagehand": ["google/gemini-2.5-flash", "google/gemini-2.5-pro", "openai/gpt-4.1", "anthropic/claude-haiku-4.5", "openai/computer-use-preview", "openai/computer-use-preview-2025-03-11", "anthropic/claude-3-7-sonnet-latest", "anthropic/claude-haiku-4-5-20251001", "anthropic/claude-sonnet-4-20250514", "anthropic/claude-sonnet-4-5-20250929", "google/gemini-2.5-computer-use-preview-10-2025"],
    "smooth": [], // Smooth uses its own models
    "stagehand-bb-cloud": ["google/gemini-2.5-flash", "google/gemini-2.5-pro", "openai/gpt-4.1", "anthropic/claude-haiku-4.5", "openai/computer-use-preview", "openai/computer-use-preview-2025-03-11", "anthropic/claude-3-7-sonnet-latest", "anthropic/claude-haiku-4-5-20251001", "anthropic/claude-sonnet-4-20250514", "anthropic/claude-sonnet-4-5-20250929", "google/gemini-2.5-computer-use-preview-10-2025"] // Commented out in UI for now
};

// Helper to detect provider from browser-use cloud model names
const detectProviderFromModelName = (modelName: string): string => {
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
const formatModelName = (model: string) => {
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
const getProviderName = (provider: string) => {
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
const ProviderLogo: React.FC<{ provider: string; className?: string }> = ({ provider, className }) => {
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
const getShortModelName = (model: string): string => {
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

export interface ChatInputState {
    isPrivate: boolean;
    agentConfigs: AgentConfig[];
    hasSmoothApiKey: boolean;
    hasBrowserUseApiKey: boolean;
    clientFingerprint?: string | null;
}

interface ChatInputProps {
    onStateChange?: (state: ChatInputState) => void;
    onAgentPresenceChange?: (hasSmooth: boolean, hasBrowserUse: boolean) => void;
}

export function ChatInput({ onStateChange, onAgentPresenceChange }: ChatInputProps) {

    // Use this as default input
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
    const [propertiesDialogAgent, setPropertiesDialogAgent] = useState<AgentConfig | null>(null);
    const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
    const router = useRouter();
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Device fingerprinting for demo mode
    const [clientFingerprint, setClientFingerprint] = useState<string | null>(null);

    // Store input when user hits demo limit to restore after signup
    const [storedInputForDemo, setStoredInputForDemo] = useState<string | null>(null);

    // Get current user for API key access
    const user = useQuery(
        api.auth.getCurrentUser,
        isAuthenticated ? {} : "skip"
    );

    // Login dialog state
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const [activeAuthTab, setActiveAuthTab] = useState<"signin" | "signup">("signin");

    // Clear errors when dialog opens/closes
    useEffect(() => {
        if (!isLoginDialogOpen) {
            setAuthError(null);
            setEmail("");
            setPassword("");
            setName("");
        }
    }, [isLoginDialogOpen]);

    // Clear errors when switching tabs
    useEffect(() => {
        setAuthError(null);
    }, [activeAuthTab]);

    // Agent configuration state
    const [agentConfigs, setAgentConfigs] = useState<AgentConfig[]>([
        { id: `agent-${Date.now()}`, agent: "browser-use", model: "browser-use/bu-1.0" }
    ]);

    // Privacy state
    const [isPrivate, setIsPrivate] = useState(false);

    // API key availability state for privacy warnings
    const [hasSmoothApiKey, setHasSmoothApiKey] = useState(false);
    const [hasBrowserUseApiKey, setHasBrowserUseApiKey] = useState(false);

    // File upload state (single file only)
    const [file, setFile] = useState<File | null>(null);
    const [uploadedFileIds, setUploadedFileIds] = useState<Record<string, string>>({}); // Map file name to Smooth file ID
    const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null); // For browser-use: server file path
    const [isUploadingFiles, setIsUploadingFiles] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Temporary state for dialog
    const [tempAgentConfigs, setTempAgentConfigs] = useState<AgentConfig[]>(agentConfigs);

    // Check if user has API keys for privacy warnings (use hasApiKey for synchronous check)
    useEffect(() => {
        if (user?._id) {
            // Use synchronous hasApiKey check instead of async getApiKey to avoid layout shift
            const smoothKey = hasApiKey("smooth");
            const browserUseKey = hasApiKey("browser-use");
            setHasSmoothApiKey(smoothKey);
            setHasBrowserUseApiKey(browserUseKey);
        } else {
            setHasSmoothApiKey(false);
            setHasBrowserUseApiKey(false);
        }
    }, [user?._id]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [input]);

    // Notify parent when agent selection changes - memoized to prevent unnecessary calls
    const hasSmooth = useMemo(() => agentConfigs.some(c => c.agent === "smooth"), [agentConfigs]);
    const hasBrowserUse = useMemo(() => agentConfigs.some(c => c.agent === "browser-use" || c.agent === "browser-use-cloud"), [agentConfigs]);

    useEffect(() => {
        onAgentPresenceChange?.(hasSmooth, hasBrowserUse);
    }, [hasSmooth, hasBrowserUse, onAgentPresenceChange]);

    // Generate device fingerprint on mount
    useEffect(() => {
        const generateFingerprint = async () => {
            try {
                const fingerprint = await getClientFingerprint();
                console.log("[ChatInput] Generated client fingerprint:", fingerprint);
                setClientFingerprint(fingerprint);
            } catch (error) {
                console.error("Failed to generate fingerprint:", error);
            }
        };
        generateFingerprint();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !isLoading && agentConfigs.length > 0) {
            // Check if user is authenticated - if not, try demo mode
            if (!isAuthenticated) {
                // Try demo mode if fingerprint is ready
                if (clientFingerprint) {
                    await handleDemoSubmit();
                    return;
                } else {
                    toast.error("Loading... Please try again in a moment.", {
                        duration: 3000,
                    });
                    return;
                }
            }

            setIsLoading(true);
            try {
                const agentsForLog = agentConfigs.map(({ agent, model, secrets, thinkingModel, executionModel }) => ({
                    agent,
                    model,
                    ...(thinkingModel ? { thinkingModel } : {}),
                    ...(executionModel ? { executionModel } : {}),
                    ...(secrets
                        ? {
                            secretKeys: Object.keys(secrets),
                            secretCount: Object.keys(secrets).length,
                        }
                        : {}),
                }));
                console.log("Submitting multi-agent request", {
                    instructionPreview: input.slice(0, 64),
                    agents: agentsForLog,
                });

                // Get user's API keys if available
                let smoothApiKey: string | undefined = undefined;
                let openaiApiKey: string | undefined = undefined;
                let googleApiKey: string | undefined = undefined;
                let anthropicApiKey: string | undefined = undefined;
                let browserUseApiKey: string | undefined = undefined;

                // Check if Smooth agent is selected
                const hasSmoothAgent = agentConfigs.some(c => c.agent === "smooth");

                if (user?._id) {
                    try {
                        // Get Smooth API key if Smooth agent is selected
                        if (hasSmoothAgent) {
                            const key = await getApiKey("smooth", user._id);
                            if (key) {
                                smoothApiKey = key;
                                console.log("?? Found user's Smooth API key in localStorage");
                            }

                            // Upload file to Smooth API if file is selected
                            if (file) {
                                if (!smoothApiKey) {
                                    toast.error("Smooth API key required to upload files", {
                                        duration: 5000,
                                    });
                                    setIsLoading(false);
                                    return;
                                }

                                setIsUploadingFiles(true);
                                try {
                                    const uploadedIds = await uploadFilesToSmooth([file], smoothApiKey);
                                    setUploadedFileIds(uploadedIds);
                                    console.log("✅ File uploaded successfully to Smooth:", uploadedIds);
                                } catch (error) {
                                    console.error("❌ Error uploading file to Smooth:", error);
                                    toast.error(`Failed to upload file: ${error instanceof Error ? error.message : "Unknown error"}`, {
                                        duration: 5000,
                                    });
                                    setIsLoading(false);
                                    setIsUploadingFiles(false);
                                    return;
                                } finally {
                                    setIsUploadingFiles(false);
                                }
                            }
                        }

                        // Get OpenAI API key if needed
                        const key1 = await getApiKey("openai", user._id);
                        if (key1) {
                            openaiApiKey = key1;
                            console.log("?? Found user's OpenAI API key in localStorage");
                        }

                        // Get Google API key if needed
                        const key2 = await getApiKey("google", user._id);
                        if (key2) {
                            googleApiKey = key2;
                            console.log("?? Found user's Google API key in localStorage");
                        }

                        // Get Anthropic API key if needed
                        const key3 = await getApiKey("anthropic", user._id);
                        if (key3) {
                            anthropicApiKey = key3;
                            console.log("?? Found user's Anthropic API key in localStorage");
                        }

                        // Get Browser-Use API key if Browser-Use Cloud is selected
                        if (agentConfigs.some(c => c.agent === "browser-use-cloud")) {
                            const key4 = await getApiKey("browser-use", user._id);
                            if (key4) {
                                browserUseApiKey = key4;
                                console.log("?? Found user's Browser-Use API key in localStorage");
                            }
                        }
                    } catch (error) {
                        console.error("?? Failed to get API keys from localStorage:", error);
                        console.log("?? Will fallback to server keys");
                        // Continue without user keys - will fallback to server keys
                    }
                }

                // Prepare file data for different agents
                const hasBrowserUseAgent = agentConfigs.some(c => c.agent === "browser-use");
                const hasStagehandAgent = agentConfigs.some(c => c.agent === "stagehand");

                // For Smooth: prepare file IDs
                const smoothFileIds = hasSmoothAgent && file
                    ? (uploadedFileIds[file.name] ? [uploadedFileIds[file.name]] : [])
                    : [];

                // For browser-use and stagehand: upload file if selected
                let browserUseFilePath: string | null = null;
                let stagehandFileData: { name: string; data: string } | null = null;

                if (file && (hasBrowserUseAgent || hasStagehandAgent)) {
                    setIsUploadingFiles(true);
                    try {
                        if (hasBrowserUseAgent) {
                            // Upload file to Python server for browser-use via Next.js API route
                            const formData = new FormData();
                            formData.append('file', file);

                            const uploadResponse = await fetch('/api/agent/upload-file', {
                                method: 'POST',
                                body: formData,
                            });

                            if (!uploadResponse.ok) {
                                const errorData = await uploadResponse.json().catch(() => ({}));
                                throw new Error(errorData.error || `Failed to upload file to browser-use server: ${uploadResponse.statusText}`);
                            }

                            const uploadData = await uploadResponse.json();
                            browserUseFilePath = uploadData.filePath;
                            setUploadedFilePath(browserUseFilePath);
                            console.log("✅ File uploaded to browser-use server:", browserUseFilePath);
                        }

                        if (hasStagehandAgent) {
                            // Convert file to base64 for stagehand
                            const arrayBuffer = await file.arrayBuffer();
                            const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
                            stagehandFileData = {
                                name: file.name,
                                data: base64,
                            };
                            console.log("✅ File prepared for stagehand:", file.name);
                        }
                    } catch (error) {
                        console.error("❌ Error preparing file:", error);
                        toast.error(`Failed to prepare file: ${error instanceof Error ? error.message : "Unknown error"}`, {
                            duration: 5000,
                        });
                        setIsLoading(false);
                        setIsUploadingFiles(false);
                        return;
                    } finally {
                        setIsUploadingFiles(false);
                    }
                }

                // Call the multi-agent endpoint
                const response = await fetch("/api/agent/multi", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        instruction: input,
                        agents: agentConfigs,
                        smoothApiKey: smoothApiKey,
                        openaiApiKey: openaiApiKey,
                        googleApiKey: googleApiKey,
                        anthropicApiKey: anthropicApiKey,
                        browserUseApiKey: browserUseApiKey,
                        isPrivate: isPrivate,
                        smoothFileIds: smoothFileIds.length > 0 ? smoothFileIds : undefined,
                        browserUseFilePath: browserUseFilePath || undefined,
                        stagehandFileData: stagehandFileData || undefined,
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    console.error("API Error:", response.status, errorData);
                    throw new Error(errorData.error || "Failed to create session");
                }

                const data = await response.json();
                console.log("Session created, response data:", data);

                // Redirect to the session page
                const sessionId = data.session?.id;
                if (!sessionId) {
                    console.error("No session ID in response:", data);
                    throw new Error("Session created but no ID returned");
                }

                // Ensure sessionId is a string
                const sessionIdString = String(sessionId);
                console.log("Redirecting to session:", sessionIdString);

                // Clear loading state before redirect
                setIsLoading(false);

                // Use startTransition for better React 18 concurrent rendering
                // and ensure navigation happens properly
                startTransition(() => {
                    setInput(""); // Clear input only on successful navigation
                    setFile(null); // Clear file after successful submission
                    setUploadedFileIds({}); // Clear uploaded file IDs
                    setUploadedFilePath(null); // Clear browser-use file path
                    router.push(`/session/${sessionIdString}`);
                });
            } catch (error) {
                console.error("Error submitting:", error);
                const errorMessage = error instanceof Error ? error.message : "Unknown error";
                toast.error(`Failed to create session: ${errorMessage}`, {
                    duration: 5000,
                    description: "Please check your configuration and try again."
                });
                setIsLoading(false);
                // Don't clear input on error, let user retry
            }
        }
    };

    const handleDemoSubmit = async () => {
        setIsLoading(true);
        try {
            // Demo mode only supports one agent
            if (agentConfigs.length !== 1) {
                toast.error("Demo mode supports only one agent. Please select either Stagehand or Browser-Use.", {
                    duration: 5000,
                });
                setIsLoading(false);
                return;
            }

            const agent = agentConfigs[0];

            // Demo mode only supports stagehand and browser-use (not cloud)
            if (agent.agent !== "stagehand" && agent.agent !== "browser-use") {
                toast.error("Demo mode only supports Stagehand or Browser-Use. Please select one of these.", {
                    duration: 5000,
                });
                setIsLoading(false);
                return;
            }

            // Call the demo endpoint
            const response = await fetch("/api/agent/demo", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    instruction: input,
                    agentType: agent.agent,
                    model: agent.model,
                    clientFingerprint: clientFingerprint,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error("Demo API Error:", response.status, errorData);

                // Handle demo limit reached
                if (response.status === 403 && errorData.error === "DEMO_LIMIT_REACHED") {
                    setStoredInputForDemo(input); // Store the input for after signup
                    setIsLoginDialogOpen(true);
                    setIsLoading(false);
                    return;
                }

                throw new Error(errorData.message || "Failed to create demo session");
            }

            const data = await response.json();

            // Redirect to the session page
            const sessionId = data.session?.id;
            if (!sessionId) {
                console.error("No session ID in response:", data);
                throw new Error("Demo session created but no ID returned");
            }

            // Ensure sessionId is a string
            const sessionIdString = String(sessionId);

            // Store demo session in localStorage
            try {
                const currentInstruction = input;
                const demoSession = {
                    _id: sessionIdString,
                    instruction: currentInstruction,
                    userId: "demo-user",
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    _creationTime: Date.now(),
                };
                const existing = localStorage.getItem("demo_sessions");
                const sessions = existing ? JSON.parse(existing) : [];
                // Add to beginning and keep only last 10
                const updated = [demoSession, ...sessions].slice(0, 10);
                localStorage.setItem("demo_sessions", JSON.stringify(updated));
            } catch (storageError) {
                console.error("Failed to store demo session in localStorage:", storageError);
            }

            // Clear loading state before redirect
            setIsLoading(false);

            // Use startTransition for better React 18 concurrent rendering
            startTransition(() => {
                setInput(""); // Clear input only on successful navigation
                router.push(`/demo/session/${sessionIdString}`);
            });
        } catch (error) {
            console.error("Error submitting demo:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            toast.error(`Demo failed: ${errorMessage}`, {
                duration: 5000,
                description: "Please try again or create an account for full access."
            });
            setIsLoading(false);
            // Don't clear input on error, let user retry
        }
    };

    const handleSignIn = async () => {
        setIsSubmittingAuth(true);
        setAuthError(null);
        try {
            const { data, error } = await authClient.signIn.email({
                email,
                password,
            });

            if (error) {
                const errorMsg = error.message || "Sign in failed. Please check your credentials and try again.";
                setAuthError(errorMsg);
                toast.error("Sign in failed", {
                    description: errorMsg,
                    duration: 5000,
                });
                setIsSubmittingAuth(false);
                return;
            }

            setIsLoginDialogOpen(false);
            setEmail("");
            setPassword("");
            setAuthError(null);

            // Restore stored input if available
            if (storedInputForDemo) {
                setInput(storedInputForDemo);
                setStoredInputForDemo(null);
            }

            toast.success("Signed in successfully!", {
                duration: 3000,
            });
        } catch (err: any) {
            console.error("Sign in error:", err);
            const errorMsg = err?.message || "Sign in failed. Please check your credentials and try again.";
            setAuthError(errorMsg);
            toast.error("Sign in failed", {
                description: errorMsg,
                duration: 5000,
            });
        } finally {
            setIsSubmittingAuth(false);
        }
    };

    const handleSignUp = async () => {
        setIsSubmittingAuth(true);
        setAuthError(null);
        try {
            const { data, error } = await authClient.signUp.email({
                email,
                password,
                name,
            });

            if (error) {
                const errorMsg = error.message || "Sign up failed. Please check your information and try again.";
                setAuthError(errorMsg);
                toast.error("Sign up failed", {
                    description: errorMsg,
                    duration: 5000,
                });
                setIsSubmittingAuth(false);
                return;
            }

            setIsLoginDialogOpen(false);
            setEmail("");
            setPassword("");
            setName("");
            setAuthError(null);

            // Restore stored input if available
            if (storedInputForDemo) {
                setInput(storedInputForDemo);
                setStoredInputForDemo(null);
            }

            toast.success("Account created successfully!", {
                duration: 3000,
                description: "Welcome to The Browser Arena!"
            });
        } catch (err: any) {
            console.error("Sign up error:", err);
            const errorMsg = err?.message || "Sign up failed. Please check your information and try again.";
            setAuthError(errorMsg);
            toast.error("Sign up failed", {
                description: errorMsg,
                duration: 5000,
            });
        } finally {
            setIsSubmittingAuth(false);
        }
    };

    const handleDialogOpen = () => {
        setTempAgentConfigs([...agentConfigs]);
        setIsDialogOpen(true);
    };

    const handleDialogSave = () => {
        setAgentConfigs([...tempAgentConfigs]);
        setIsDialogOpen(false);
    };

    const handleDialogCancel = () => {
        setTempAgentConfigs([...agentConfigs]);
        setIsDialogOpen(false);
    };

    const addAgentInstance = (agent: AgentType) => {
        if (tempAgentConfigs.length >= 4) {
            return; // Max limit reached
        }
        const defaultModel = MODEL_OPTIONS[agent][0] || "google/gemini-2.5-flash";
        const newId = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setTempAgentConfigs([...tempAgentConfigs, { id: newId, agent, model: defaultModel }]);
    };

    const removeAgentInstance = (index: number) => {
        setTempAgentConfigs(tempAgentConfigs.filter((_, i) => i !== index));
    };

    const updateAgentInstanceModel = (index: number, model: ModelType) => {
        setTempAgentConfigs(tempAgentConfigs.map((c, i) =>
            i === index ? { ...c, model } : c
        ));
    };

    const toggleAgent = (agent: AgentType) => {
        // Always add an instance if under limit, never remove
        if (tempAgentConfigs.length < 4) {
            addAgentInstance(agent);
        }
    };

    const getAgentInstanceCount = (agent: AgentType): number => {
        return tempAgentConfigs.filter(c => c.agent === agent).length;
    };

    const getAgentInstances = (agent: AgentType): Array<{ config: AgentConfig; index: number }> => {
        return tempAgentConfigs
            .map((config, index) => ({ config, index }))
            .filter(({ config }) => config.agent === agent);
    };

    const handlePropertiesSave = (updatedConfig: AgentConfig) => {
        // Match by id first (if present), then fall back to agent and model
        let found = false;
        setAgentConfigs(agentConfigs.map(c => {
            // If both have ids and they match
            if (updatedConfig.id && c.id && c.id === updatedConfig.id) {
                found = true;
                return updatedConfig;
            }
            // If no id is present, fall back to matching agent+model (only first match)
            if (!updatedConfig.id && !found && c.agent === updatedConfig.agent && c.model === updatedConfig.model) {
                found = true;
                return updatedConfig;
            }
            return c;
        }));
        setPropertiesDialogAgent(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    // File upload handlers (single file only)
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
        }
        // Reset input so same file can be selected again
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleRemoveFile = () => {
        const fileName = file?.name;
        if (fileName) {
            // Remove from uploadedFileIds if file was uploaded
            setUploadedFileIds(prevIds => {
                const newIds = { ...prevIds };
                delete newIds[fileName];
                return newIds;
            });
        }
        setFile(null);
        setUploadedFilePath(null);
    };

    // Upload file to Smooth API (single file)
    const uploadFilesToSmooth = async (filesToUpload: File[], apiKey: string): Promise<Record<string, string>> => {
        const fileIds: Record<string, string> = {};
        const smoothFileUrl = 'https://api.smooth.sh/api/v1/file';

        // Only process first file (single file upload)
        const file = filesToUpload[0];
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('name', file.name);
            formData.append('purpose', `Uploaded via Browser Arena: ${file.name}`);

            const response = await fetch(smoothFileUrl, {
                method: 'POST',
                headers: {
                    'apikey': apiKey,
                },
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to upload ${file.name}`);
            }

            const data = await response.json();
            if (data.id) {
                fileIds[file.name] = data.id;
                console.log(`✅ Uploaded file ${file.name} with ID: ${data.id}`);
            } else {
                throw new Error(`No file ID returned for ${file.name}`);
            }
        } catch (error) {
            console.error(`❌ Error uploading file ${file.name}:`, error);
            throw error;
        }

        return fileIds;
    };

    // Drag and drop handlers
    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.types.includes('Files')) {
            setIsDragging(true);
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Only hide if we're leaving the container (not just moving between children)
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
            setIsDragging(false);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.types.includes('Files')) {
            e.dataTransfer.dropEffect = 'copy';
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            setFile(droppedFile);
        }
    };

    // Memoize chatInputState to prevent unnecessary re-renders
    const chatInputState: ChatInputState = useMemo(() => ({
        isPrivate,
        agentConfigs,
        hasSmoothApiKey,
        hasBrowserUseApiKey,
        clientFingerprint,
    }), [isPrivate, agentConfigs, hasSmoothApiKey, hasBrowserUseApiKey, clientFingerprint]);

    // Notify parent component whenever state changes
    useEffect(() => {
        onStateChange?.(chatInputState);
    }, [chatInputState, onStateChange]);

    return (
        <>
            {isLoading && (
                <Suspense fallback={
                    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md">
                        <div className="text-lg text-foreground">Loading...</div>
                    </div>
                }>
                    <LoadingDino />
                </Suspense>
            )}
            <div className="container mx-auto max-w-3xl px-4 font-mono text-white">
                <div
                    className={cn(
                        "bg-background rounded-4xl w-full space-y-2 px-4 py-4 transition-colors relative",
                        isDragging && "ring-2 ring-primary ring-offset-2"
                    )}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    <form
                        onSubmit={handleSubmit}
                        className="relative mx-auto overflow-hidden transition duration-200 mb-2 min-h-12 w-full max-w-full bg-background shadow-none"
                    >
                        <textarea
                            ref={textareaRef}
                            placeholder="Automate your tasks..."
                            className="sm:text font-default relative w-full border-none bg-background pr-28 text-sm tracking-tight text-primary focus:outline-none focus:ring-0 dark:text-white resize-none overflow-hidden min-h-12 py-3"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            rows={1}
                            disabled={isUploadingFiles}
                        />
                        <div className="absolute right-0 top-3 flex items-center gap-1">
                            <input
                                ref={fileInputRef}
                                type="file"
                                onChange={handleFileSelect}
                                className="hidden"
                                id="file-upload-input"
                                disabled={isLoading || isUploadingFiles}
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isLoading || isUploadingFiles}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 transition duration-200 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Upload file"
                            >
                                <Paperclip className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                            </button>
                            <button
                                type="submit"
                                disabled={!input.trim() || isLoading || isUploadingFiles}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-black transition duration-200 hover:opacity-90 disabled:bg-gray-100 dark:bg-zinc-900 dark:disabled:bg-zinc-800"
                            >
                                {isUploadingFiles ? (
                                    <svg className="animate-spin h-4 w-4 text-gray-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="24"
                                        height="24"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="h-4 w-4 text-gray-300"
                                    >
                                        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                        <path d="M5 12l14 0" strokeDasharray="50%" strokeDashoffset="50%" />
                                        <path d="M13 18l6 -6" />
                                        <path d="M13 6l6 6" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </form>

                    {/* File display (single file) */}
                    {file && (
                        <div className="flex flex-wrap gap-2 mb-2">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs text-foreground">
                                <Paperclip className="h-3 w-3 text-muted-foreground" />
                                <span className="max-w-[200px] truncate">{file.name}</span>
                                <button
                                    type="button"
                                    onClick={handleRemoveFile}
                                    disabled={isLoading || isUploadingFiles}
                                    className="ml-1 hover:opacity-70 disabled:opacity-50"
                                    title="Remove file"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Drag and drop hint */}
                    {isDragging && (
                        <div className="absolute inset-0 flex items-center justify-center bg-primary/5 border-2 border-dashed border-primary rounded-4xl z-10 pointer-events-none">
                            <div className="text-center">
                                <Paperclip className="h-8 w-8 mx-auto mb-2 text-primary" />
                                <p className="text-sm font-medium text-primary">Drop files here</p>
                            </div>
                        </div>
                    )}



                    <div className="flex h-10 w-full items-center justify-between">
                        <div className="flex items-center gap-2 flex-nowrap overflow-x-auto whitespace-nowrap max-w-full">
                            <Button
                                type="button"
                                onClick={handleDialogOpen}
                                disabled={isLoading}
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-primary hover:text-primary shrink-0"
                            >
                                <Settings className="mr-1.5 h-4 w-4" />
                                Agents
                                <span className="ml-1 rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-1.5 py-0.5 text-[10px]">
                                    {agentConfigs.length}
                                </span>
                            </Button>
                            <div className="flex items-center gap-2 rounded-full px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900 shrink-0">
                                <Label htmlFor="private-session" className="text-[11px] text-muted-foreground">Private</Label>
                                <Switch
                                    id="private-session"
                                    checked={isPrivate}
                                    onCheckedChange={(checked) => setIsPrivate(checked === true)}
                                    disabled={isLoading}
                                />
                            </div>

                            {/* Agent Pills (hide Smooth) */}
                            {agentConfigs.filter(c => c.agent !== "smooth").map((config, index) => {
                                const hasProperties = config.agent !== "smooth";
                                const { provider } = formatModelName(config.model);
                                const shortModelName = getShortModelName(config.model);
                                const tooltipText = `${AGENT_LABELS[config.agent]} - ${config.model}${hasProperties ? " (Click to configure)" : ""}`;

                                return (
                                    <button
                                        key={`${config.agent}-${index}-${config.model}`}
                                        type="button"
                                        onClick={() => hasProperties && setPropertiesDialogAgent({ ...config, id: config.id || `agent-${index}-${Date.now()}` })}
                                        disabled={isLoading || !hasProperties}
                                        className={cn(
                                            "h-6 px-2 text-[10px] rounded-full transition-colors flex items-center gap-1 shrink-0",
                                            hasProperties
                                                ? "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700"
                                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 cursor-default",
                                            isLoading && "opacity-50 cursor-not-allowed"
                                        )}
                                        title={tooltipText}
                                    >
                                        <span className="capitalize">{AGENT_LABELS[config.agent]}</span>
                                        <span className="text-[9px] text-muted-foreground">•</span>
                                        <span className="text-[9px] truncate max-w-[60px]">{shortModelName}</span>
                                        {hasProperties && (
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex items-center gap-4" />
                    </div>

                    {/* Agent Selection Dialog */}
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogContent className="sm:max-w-[600px] font-mono p-4">
                            <DialogHeader>
                                <div className="flex items-center gap-1.5">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                                        <Settings className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                        <DialogTitle className="text-lg font-mono">Configure Agents</DialogTitle>
                                        <DialogDescription className="mt-0.5 text-xs">
                                            Select agents to run simultaneously ({tempAgentConfigs.length}/4)
                                        </DialogDescription>
                                    </div>
                                </div>
                            </DialogHeader>
                            <div className="py-3">
                                <div className="space-y-4">
                                    {(Object.keys(AGENT_LABELS) as AgentType[])
                                        .filter((agentType) => agentType !== "stagehand-bb-cloud") // Commented out: Stagehand Cloud
                                        .map((agentType) => {
                                            const instances = getAgentInstances(agentType);
                                            const instanceCount = getAgentInstanceCount(agentType);
                                            const isDisabled = false; // All agents are now enabled
                                            const isMaxReached = tempAgentConfigs.length >= 4;

                                            return (
                                                <div key={agentType} className="space-y-2">
                                                    {/* Agent Type Header */}
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            {(agentType === "browser-use" || agentType === "browser-use-cloud") && (
                                                                <BrowserUseLogo className="h-4 w-4" />
                                                            )}
                                                            {agentType === "smooth" && (
                                                                <SmoothLogo className="h-4 w-4" />
                                                            )}
                                                            {agentType === "stagehand" && (
                                                                <StagehandLogo className="h-4 w-4" />
                                                            )}
                                                            <Label className="text-sm font-semibold font-default">
                                                                {AGENT_LABELS[agentType]}
                                                            </Label>
                                                            {instanceCount > 0 && (
                                                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                                                    {instanceCount}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        {!isMaxReached && (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => addAgentInstance(agentType)}
                                                                disabled={isDisabled || isMaxReached}
                                                                className="h-7 px-2 text-xs"
                                                            >
                                                                <Plus className="h-3.5 w-3.5 mr-1" />
                                                                Add Instance
                                                            </Button>
                                                        )}
                                                    </div>

                                                    {/* Instance Cards */}
                                                    {instances.length > 0 ? (
                                                        <div className="space-y-2 ml-6">
                                                            {instances.map(({ config, index }, idx) => {
                                                                const isMultiple = instances.length > 1;
                                                                return (
                                                                    <div
                                                                        key={`${agentType}-${index}`}
                                                                        className={cn(
                                                                            "rounded-md border p-3 transition-all",
                                                                            "border-primary/30 bg-primary/5"
                                                                        )}
                                                                    >
                                                                        <div className="flex items-center gap-2 justify-between">
                                                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                                {isMultiple && (
                                                                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                                                                                        #{idx + 1}
                                                                                    </Badge>
                                                                                )}
                                                                                {MODEL_OPTIONS[agentType].length > 0 ? (
                                                                                    <div className="flex-1 min-w-0 font-mono">
                                                                                        <Select
                                                                                            value={config.model}
                                                                                            onValueChange={(v) => updateAgentInstanceModel(index, v as ModelType)}
                                                                                        >
                                                                                            <SelectTrigger className="h-8 bg-background text-[12px]">
                                                                                                <div className="flex items-center gap-2 w-full">
                                                                                                    {(() => {
                                                                                                        const { provider, modelName } = formatModelName(config.model || "");
                                                                                                        return (
                                                                                                            <>
                                                                                                                <ProviderLogo provider={provider} />
                                                                                                                <span className="truncate text-[12px]">{modelName || "Select model"}</span>
                                                                                                            </>
                                                                                                        );
                                                                                                    })()}
                                                                                                </div>
                                                                                            </SelectTrigger>
                                                                                            <SelectContent>
                                                                                                {MODEL_OPTIONS[agentType].map((model) => {
                                                                                                    const { provider, modelName } = formatModelName(model);
                                                                                                    return (
                                                                                                        <SelectItem key={model} value={model}>
                                                                                                            <div className="flex items-center gap-2 py-0.5 font-mono">
                                                                                                                <ProviderLogo provider={provider} />
                                                                                                                <div className="flex flex-col">
                                                                                                                    <span className="font-medium leading-tight text-[12px]">{modelName}</span>
                                                                                                                    <span className="text-[11px] text-muted-foreground leading-tight">
                                                                                                                        {getProviderName(provider)}
                                                                                                                    </span>
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        </SelectItem>
                                                                                                    );
                                                                                                })}
                                                                                            </SelectContent>
                                                                                        </Select>
                                                                                    </div>
                                                                                ) : (
                                                                                    <span className="text-xs text-muted-foreground">
                                                                                        {AGENT_LABELS[agentType]} (no model selection)
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => removeAgentInstance(index)}
                                                                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                                                                            >
                                                                                <Trash2 className="h-4 w-4" />
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        !isMaxReached && (
                                                            <div className="ml-6">
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => toggleAgent(agentType)}
                                                                    disabled={isDisabled || isMaxReached}
                                                                    className="h-8 w-full text-xs justify-start text-muted-foreground hover:text-foreground"
                                                                >
                                                                    <Plus className="h-3.5 w-3.5 mr-2" />
                                                                    Click to add {AGENT_LABELS[agentType]}
                                                                </Button>
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            );
                                        })}
                                </div>
                                {tempAgentConfigs.length >= 4 && (
                                    <div className="mt-4 rounded-lg bg-warning/10 border border-warning/20 p-3 flex items-start gap-2">
                                        <XCircle className="h-4 w-4 text-warning-foreground mt-0.5 shrink-0" />
                                        <p className="text-xs text-warning-foreground font-default">
                                            Maximum of 4 agent instances allowed. Remove an instance to add another.
                                        </p>
                                    </div>
                                )}
                                {tempAgentConfigs.length === 0 && (
                                    <div className="mt-4 rounded-lg bg-info/10 border border-info/20 p-3 flex items-start gap-2">
                                        <Bot className="h-4 w-4 text-info-foreground mt-0.5 shrink-0" />
                                        <p className="text-xs text-info-foreground font-default">
                                            Select at least one agent to continue.
                                        </p>
                                    </div>
                                )}
                            </div>
                            <DialogFooter className="sm:justify-between">
                                <div className="text-xs text-muted-foreground font-default">
                                    {tempAgentConfigs.length > 0 && (
                                        <span>
                                            {tempAgentConfigs.length} agent{tempAgentConfigs.length !== 1 ? "s" : ""} selected
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={handleDialogCancel} className="font-mono">
                                        Cancel
                                    </Button>
                                    <Button onClick={handleDialogSave} disabled={tempAgentConfigs.length === 0} className="font-mono">
                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                        Save Changes
                                    </Button>
                                </div>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Agent Properties Dialog */}
                    <AgentConfigDialog
                        agentConfig={propertiesDialogAgent}
                        open={propertiesDialogAgent !== null}
                        onOpenChange={(open) => !open && setPropertiesDialogAgent(null)}
                        onSave={handlePropertiesSave}
                    />

                    {/* Login Dialog */}
                    <Dialog open={isLoginDialogOpen} onOpenChange={setIsLoginDialogOpen}>
                        <DialogContent className="sm:max-w-[400px]">
                            <DialogHeader>
                                <DialogTitle>Sign In Required</DialogTitle>
                                <DialogDescription>
                                    Please sign in or create an account to submit a query.
                                </DialogDescription>
                            </DialogHeader>
                            <Tabs
                                value={activeAuthTab}
                                onValueChange={(value) => setActiveAuthTab(value as "signin" | "signup")}
                                className="w-full"
                            >
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="signin">Sign In</TabsTrigger>
                                    <TabsTrigger value="signup">Sign Up</TabsTrigger>
                                </TabsList>
                                <TabsContent value="signin" className="space-y-4 mt-4">
                                    {authError && (
                                        <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 p-3 bg-red-500/10 border border-red-500/20 rounded-md">
                                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                            <span className="flex-1">{authError}</span>
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        <Label htmlFor="email">Email</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="Enter your email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && email && password && !isSubmittingAuth) {
                                                    handleSignIn();
                                                }
                                            }}
                                            disabled={isSubmittingAuth}
                                            autoComplete="email"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="password">Password</Label>
                                        <Input
                                            id="password"
                                            type="password"
                                            placeholder="Enter your password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && email && password && !isSubmittingAuth) {
                                                    handleSignIn();
                                                }
                                            }}
                                            disabled={isSubmittingAuth}
                                            autoComplete="current-password"
                                        />
                                    </div>
                                    <Button
                                        onClick={handleSignIn}
                                        disabled={isSubmittingAuth || !email || !password}
                                        className="w-full"
                                    >
                                        {isSubmittingAuth ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Signing in...
                                            </>
                                        ) : (
                                            "Sign In"
                                        )}
                                    </Button>
                                </TabsContent>
                                <TabsContent value="signup" className="space-y-4 mt-4">
                                    {authError && (
                                        <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 p-3 bg-red-500/10 border border-red-500/20 rounded-md">
                                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                            <span className="flex-1">{authError}</span>
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Name</Label>
                                        <Input
                                            id="name"
                                            type="text"
                                            placeholder="Enter your name"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && name && email && password && !isSubmittingAuth) {
                                                    handleSignUp();
                                                }
                                            }}
                                            disabled={isSubmittingAuth}
                                            autoComplete="name"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="signup-email">Email</Label>
                                        <Input
                                            id="signup-email"
                                            type="email"
                                            placeholder="Enter your email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && name && email && password && !isSubmittingAuth) {
                                                    handleSignUp();
                                                }
                                            }}
                                            disabled={isSubmittingAuth}
                                            autoComplete="email"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="signup-password">Password</Label>
                                        <Input
                                            id="signup-password"
                                            type="password"
                                            placeholder="Create a password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && name && email && password && !isSubmittingAuth) {
                                                    handleSignUp();
                                                }
                                            }}
                                            disabled={isSubmittingAuth}
                                            autoComplete="new-password"
                                        />
                                    </div>
                                    <Button
                                        onClick={handleSignUp}
                                        disabled={isSubmittingAuth || !email || !password || !name}
                                        className="w-full"
                                    >
                                        {isSubmittingAuth ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Signing up...
                                            </>
                                        ) : (
                                            "Sign Up"
                                        )}
                                    </Button>
                                </TabsContent>
                            </Tabs>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
        </>
    );
}