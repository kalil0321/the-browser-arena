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
import { Bot, Sparkles, Settings, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { getApiKey, hasApiKey } from "@/lib/api-keys";
import { Switch } from "@/components/ui/switch";
import { OpenAI } from "@/components/logos/openai";
import { GeminiLogo } from "@/components/logos/gemini";
import { ClaudeLogo } from "@/components/logos/claude";
import { AgentConfigDialog } from "./agent-config-dialog";
import { getClientFingerprint } from "@/lib/fingerprint";

type AgentType = "stagehand" | "smooth" | "stagehand-bb-cloud" | "browser-use" | "browser-use-cloud";
type ModelType = "google/gemini-2.5-flash" | "google/gemini-2.5-pro" | "openai/gpt-4.1" | "anthropic/claude-haiku-4.5" | "browser-use/bu-1.0" | "browser-use-llm" | "gemini-flash-latest" | "gpt-4.1" | "o3" | "claude-sonnet-4";

interface AgentConfig {
    agent: AgentType;
    model: ModelType;
    secrets?: Record<string, string>; // For browser-use: key-value pairs of secrets
    thinkingModel?: ModelType; // For stagehand: model used for thinking/planning
    executionModel?: ModelType; // For stagehand: model used for execution
}

const AGENT_LABELS: Record<AgentType, string> = {
    "stagehand": "Stagehand",
    "smooth": "Smooth",
    "stagehand-bb-cloud": "Stagehand Cloud",
    "browser-use": "BU",
    "browser-use-cloud": "BU Cloud"
};

const MODEL_OPTIONS: Record<AgentType, ModelType[]> = {
    "browser-use": ["browser-use/bu-1.0", "google/gemini-2.5-flash", "google/gemini-2.5-pro", "openai/gpt-4.1", "anthropic/claude-haiku-4.5"],
    "browser-use-cloud": ["browser-use-llm", "gemini-flash-latest", "gpt-4.1", "o3", "claude-sonnet-4"],
    "stagehand": ["google/gemini-2.5-flash", "google/gemini-2.5-pro", "openai/gpt-4.1", "anthropic/claude-haiku-4.5"],
    "smooth": [], // Smooth uses its own models
    "stagehand-bb-cloud": ["google/gemini-2.5-flash", "google/gemini-2.5-pro", "openai/gpt-4.1", "anthropic/claude-haiku-4.5"]
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
    return { provider: "", modelName: model };
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
        default:
            return <Bot className={cn("h-4 w-4 text-muted-foreground", className)} />;
    }
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
    const [input, setInput] = useState("Find top hacker news post");
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

    // Agent configuration state
    const [agentConfigs, setAgentConfigs] = useState<AgentConfig[]>([
        { agent: "browser-use", model: "browser-use/bu-1.0" },
        { agent: "smooth", model: "google/gemini-2.5-flash" }
    ]);

    // Privacy state
    const [isPrivate, setIsPrivate] = useState(false);

    // API key availability state for privacy warnings
    const [hasSmoothApiKey, setHasSmoothApiKey] = useState(false);
    const [hasBrowserUseApiKey, setHasBrowserUseApiKey] = useState(false);

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
                console.log("Submitting:", input, "with agents:", agentConfigs);

                // Get user's API keys if available
                let smoothApiKey: string | undefined = undefined;
                let openaiApiKey: string | undefined = undefined;
                let googleApiKey: string | undefined = undefined;
                let anthropicApiKey: string | undefined = undefined;
                let browserUseApiKey: string | undefined = undefined;

                if (user?._id) {
                    try {
                        // Get Smooth API key if Smooth agent is selected
                        if (agentConfigs.some(c => c.agent === "smooth")) {
                            const key = await getApiKey("smooth", user._id);
                            if (key) {
                                smoothApiKey = key;
                                console.log("🔑 Found user's Smooth API key in localStorage");
                            }
                        }

                        // Get OpenAI API key if needed
                        const key1 = await getApiKey("openai", user._id);
                        if (key1) {
                            openaiApiKey = key1;
                            console.log("🔑 Found user's OpenAI API key in localStorage");
                        }

                        // Get Google API key if needed
                        const key2 = await getApiKey("google", user._id);
                        if (key2) {
                            googleApiKey = key2;
                            console.log("🔑 Found user's Google API key in localStorage");
                        }

                        // Get Anthropic API key if needed
                        const key3 = await getApiKey("anthropic", user._id);
                        if (key3) {
                            anthropicApiKey = key3;
                            console.log("🔑 Found user's Anthropic API key in localStorage");
                        }

                        // Get Browser-Use API key if Browser-Use Cloud is selected
                        if (agentConfigs.some(c => c.agent === "browser-use-cloud")) {
                            const key4 = await getApiKey("browser-use", user._id);
                            if (key4) {
                                browserUseApiKey = key4;
                                console.log("🔑 Found user's Browser-Use API key in localStorage");
                            }
                        }
                    } catch (error) {
                        console.error("⚠️ Failed to get API keys from localStorage:", error);
                        console.log("ℹ️ Will fallback to server keys");
                        // Continue without user keys - will fallback to server keys
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
            console.log("Submitting demo:", input, "with agents:", agentConfigs);

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
            console.log("Demo session created, response data:", data);

            // Redirect to the session page
            const sessionId = data.session?.id;
            if (!sessionId) {
                console.error("No session ID in response:", data);
                throw new Error("Demo session created but no ID returned");
            }

            // Ensure sessionId is a string
            const sessionIdString = String(sessionId);
            console.log("Redirecting to session:", sessionIdString);

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
            await authClient.signIn.email({
                email,
                password,
            });
            setIsLoginDialogOpen(false);
            setEmail("");
            setPassword("");

            // Restore stored input if available
            if (storedInputForDemo) {
                setInput(storedInputForDemo);
                setStoredInputForDemo(null);
            }

            toast.success("Signed in successfully!", {
                duration: 3000,
            });
        } catch (err: any) {
            const errorMsg = err?.message || "Sign in failed";
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
            await authClient.signUp.email({
                email,
                password,
                name,
            });
            setIsLoginDialogOpen(false);
            setEmail("");
            setPassword("");
            setName("");

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
            const errorMsg = err?.message || "Sign up failed";
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

    const toggleAgent = (agent: AgentType) => {
        const exists = tempAgentConfigs.find(c => c.agent === agent);
        if (exists) {
            setTempAgentConfigs(tempAgentConfigs.filter(c => c.agent !== agent));
        } else {
            // Add with default model
            const defaultModel = MODEL_OPTIONS[agent][0] || "google/gemini-2.5-flash";
            setTempAgentConfigs([...tempAgentConfigs, { agent, model: defaultModel }]);
        }
    };

    const updateAgentModel = (agent: AgentType, model: ModelType) => {
        setTempAgentConfigs(tempAgentConfigs.map(c =>
            c.agent === agent ? { ...c, model } : c
        ));
    };

    const isAgentSelected = (agent: AgentType) => {
        return tempAgentConfigs.some(c => c.agent === agent);
    };

    const getAgentModel = (agent: AgentType): ModelType | undefined => {
        return tempAgentConfigs.find(c => c.agent === agent)?.model;
    };

    const handlePropertiesSave = (updatedConfig: AgentConfig) => {
        setAgentConfigs(agentConfigs.map(c =>
            c.agent === updatedConfig.agent ? updatedConfig : c
        ));
        setPropertiesDialogAgent(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
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
                <div className="bg-background rounded-4xl w-full space-y-2 px-4 py-4">
                    <form
                        onSubmit={handleSubmit}
                        className="relative mx-auto overflow-hidden transition duration-200 mb-2 min-h-12 w-full max-w-full bg-background shadow-none"
                    >
                        <textarea
                            ref={textareaRef}
                            placeholder="Automate your tasks..."
                            className="sm:text font-default relative w-full border-none bg-background pr-20 text-sm tracking-tight text-primary focus:outline-none focus:ring-0 dark:text-white resize-none overflow-hidden min-h-12 py-3"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            rows={1}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className="absolute right-0 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black transition duration-200 hover:opacity-90 disabled:bg-gray-100 dark:bg-zinc-900 dark:disabled:bg-zinc-800"
                        >
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
                        </button>
                    </form>



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
                                return (
                                    <button
                                        key={`${config.agent}-${index}`}
                                        type="button"
                                        onClick={() => hasProperties && setPropertiesDialogAgent({ ...config })}
                                        disabled={isLoading || !hasProperties}
                                        className={cn(
                                            "h-6 px-2 text-[10px] rounded-full transition-colors flex items-center gap-1 shrink-0",
                                            hasProperties
                                                ? "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700"
                                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 cursor-default",
                                            isLoading && "opacity-50 cursor-not-allowed"
                                        )}
                                        title={hasProperties ? `Configure ${AGENT_LABELS[config.agent]}` : AGENT_LABELS[config.agent]}
                                    >
                                        <span className="capitalize">{AGENT_LABELS[config.agent]}</span>
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
                                <div className="space-y-2.5">
                                    {(Object.keys(AGENT_LABELS) as AgentType[]).map((agentType) => {
                                        const selected = isAgentSelected(agentType);
                                        const currentModel = getAgentModel(agentType);
                                        const isDisabled = false; // All agents are now enabled
                                        const isMaxReached = !selected && tempAgentConfigs.length >= 4;

                                        return (
                                            <div
                                                key={agentType}
                                                className={cn(
                                                    "group relative rounded-md border p-3 transition-all",
                                                    selected
                                                        ? "border-primary bg-primary/5 shadow-sm"
                                                        : "border-border hover:border-primary/50 hover:bg-accent/50",
                                                    (isDisabled || isMaxReached) && "opacity-50 cursor-not-allowed"
                                                )}
                                                role="button"
                                                tabIndex={0}
                                                onClick={() => !isDisabled && !isMaxReached && toggleAgent(agentType)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        !isDisabled && !isMaxReached && toggleAgent(agentType);
                                                    }
                                                }}
                                            >
                                                <div className="flex items-start justify-between gap-2.5">
                                                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-1.5 mb-1">
                                                                <Label
                                                                    htmlFor={agentType}
                                                                    className={cn(
                                                                        "text-[13px] font-medium cursor-pointer font-default",
                                                                        selected && "text-primary",
                                                                        (isDisabled || isMaxReached) && "cursor-not-allowed"
                                                                    )}
                                                                >
                                                                    {AGENT_LABELS[agentType]}
                                                                </Label>
                                                                {selected && MODEL_OPTIONS[agentType].length > 0 && (
                                                                    <div className="ml-2 min-w-[140px] font-mono">
                                                                        <Select
                                                                            value={currentModel}
                                                                            onValueChange={(v) => updateAgentModel(agentType, v as ModelType)}
                                                                        >
                                                                            <SelectTrigger className="h-7 bg-background text-[12px]">
                                                                                <div className="flex items-center gap-2 w-full">
                                                                                    {(() => {
                                                                                        const { provider, modelName } = formatModelName(currentModel || "");
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
                                                                )}
                                                                {selected && (
                                                                    <Badge variant="default" className="ml-1 px-1.5 py-0.5 text-[10px]">
                                                                        <CheckCircle2 className="h-3 w-3" />
                                                                        <span>Active</span>
                                                                    </Badge>
                                                                )}
                                                                {isDisabled && (
                                                                    <Badge variant="outline" className="ml-1 px-1.5 py-0.5 text-[10px]">
                                                                        <XCircle className="h-3 w-3" />
                                                                        <span>Unavailable</span>
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {tempAgentConfigs.length >= 4 && (
                                    <div className="mt-4 rounded-lg bg-warning/10 border border-warning/20 p-3 flex items-start gap-2">
                                        <XCircle className="h-4 w-4 text-warning-foreground mt-0.5 shrink-0" />
                                        <p className="text-xs text-warning-foreground font-default">
                                            Maximum of 4 agents allowed. Deselect an agent to add another.
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
                            <Tabs defaultValue="signin" className="w-full">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="signin">Sign In</TabsTrigger>
                                    <TabsTrigger value="signup">Sign Up</TabsTrigger>
                                </TabsList>
                                <TabsContent value="signin" className="space-y-4 mt-4">
                                    {authError && (
                                        <div className="text-sm text-red-600 dark:text-red-400 p-2 bg-red-500/10 rounded">
                                            {authError}
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
                                        />
                                    </div>
                                    <Button
                                        onClick={handleSignIn}
                                        disabled={isSubmittingAuth || !email || !password}
                                        className="w-full"
                                    >
                                        {isSubmittingAuth ? "Signing in..." : "Sign In"}
                                    </Button>
                                </TabsContent>
                                <TabsContent value="signup" className="space-y-4 mt-4">
                                    {authError && (
                                        <div className="text-sm text-red-600 dark:text-red-400 p-2 bg-red-500/10 rounded">
                                            {authError}
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
                                        />
                                    </div>
                                    <Button
                                        onClick={handleSignUp}
                                        disabled={isSubmittingAuth || !email || !password || !name}
                                        className="w-full"
                                    >
                                        {isSubmittingAuth ? "Signing up..." : "Sign Up"}
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