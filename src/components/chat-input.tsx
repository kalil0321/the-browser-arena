"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingDino } from "@/components/loading-dino";
import { authClient } from "@/lib/auth/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Bot, Sparkles, Settings, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { getApiKey } from "@/lib/api-keys";

type AgentType = "stagehand" | "smooth" | "skyvern" | "browser-use";
type ModelType = "google/gemini-2.5-flash" | "google/gemini-2.5-pro" | "openai/gpt-4.1" | "anthropic/claude-4.5-haiku" | "browser-use/bu-1.0";

interface AgentConfig {
    agent: AgentType;
    model: ModelType;
}

const AGENT_LABELS: Record<AgentType, string> = {
    "stagehand": "Stagehand",
    "smooth": "Smooth",
    "skyvern": "Skyvern",
    "browser-use": "Browser-Use"
};

const MODEL_OPTIONS: Record<AgentType, ModelType[]> = {
    "browser-use": ["browser-use/bu-1.0"],
    "stagehand": ["google/gemini-2.5-flash", "google/gemini-2.5-pro", "openai/gpt-4.1", "anthropic/claude-4.5-haiku"],
    "smooth": [], // Smooth uses its own models
    "skyvern": ["google/gemini-2.5-flash", "google/gemini-2.5-pro", "openai/gpt-4.1", "anthropic/claude-4.5-haiku"]
};

// Helper to format model names
const formatModelName = (model: string) => {
    const parts = model.split("/");
    if (parts.length >= 2) {
        const provider = parts[0];
        const modelName = parts.slice(1).join("/");
        return { provider, modelName };
    }
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
    return providerMap[provider] || provider;
};

export function ChatInput() {
    // Use this as default input
    const [input, setInput] = useState("Find which companies raised more than $10M in the US this month");
    const [isLoading, setIsLoading] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
    const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
    const router = useRouter();
    const textareaRef = useRef<HTMLTextAreaElement>(null);

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

    // Temporary state for dialog
    const [tempAgentConfigs, setTempAgentConfigs] = useState<AgentConfig[]>(agentConfigs);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [input]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !isLoading && agentConfigs.length > 0) {
            // Check if user is authenticated
            if (!isAuthenticated) {
                setIsLoginDialogOpen(true);
                return;
            }

            setIsLoading(true);
            try {
                console.log("Submitting:", input, "with agents:", agentConfigs);

                // Get user's Smooth API key if available
                let smoothApiKey: string | undefined = undefined;
                if (user?._id && agentConfigs.some(c => c.agent === "smooth")) {
                    try {
                        const key = await getApiKey("smooth", user._id);
                        if (key) {
                            smoothApiKey = key;
                            console.log("🔑 Found user's Smooth API key in localStorage, will use it for API calls");
                        } else {
                            console.log("ℹ️ No user Smooth API key found, will use server key (fallback)");
                        }
                    } catch (error) {
                        console.error("⚠️ Failed to get Smooth API key from localStorage:", error);
                        console.log("ℹ️ Will fallback to server key");
                        // Continue without user key - will fallback to server key
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
                        isPrivate: isPrivate,
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    console.error("API Error:", response.status, errorData);
                    throw new Error(errorData.error || "Failed to create session");
                }

                const data = await response.json();

                // Redirect to the session page
                if (data.session?.id) {
                    router.push(`/session/${data.session.id}`);
                }
            } catch (error) {
                console.error("Error submitting:", error);
                alert(`Failed to create session: ${error instanceof Error ? error.message : "Unknown error"}`);
            } finally {
                setIsLoading(false);
                setInput("");
            }
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
        } catch (err: any) {
            setAuthError(err?.message || "Sign in failed");
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
        } catch (err: any) {
            setAuthError(err?.message || "Sign up failed");
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

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    return (
        <>
            {isLoading && <LoadingDino />}
            <div className="container mx-auto max-w-3xl px-4 font-mono text-white">
                <div className="bg-white rounded-4xl w-full space-y-2 px-4 py-4">
                    <form
                        onSubmit={handleSubmit}
                        className="relative mx-auto overflow-hidden transition duration-200 dark:bg-zinc-800 mb-4 min-h-12 w-full max-w-full bg-transparent shadow-none"
                    >
                        <textarea
                            ref={textareaRef}
                            placeholder="Automate your tasks..."
                            className="sm:text font-default relative w-full border-none bg-transparent pr-20 text-sm tracking-tight text-black focus:outline-none focus:ring-0 dark:text-white resize-none overflow-hidden min-h-12 py-3"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            rows={1}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className="absolute right-0 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black transition duration-200 disabled:bg-gray-100 dark:bg-zinc-900 dark:disabled:bg-zinc-800"
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
                        <div className="flex items-center gap-3">
                            <Button
                                type="button"
                                onClick={handleDialogOpen}
                                disabled={isLoading}
                                variant="outline"
                                size="sm"
                                className="text-xs"
                            >
                                Configure Agents ({agentConfigs.length})
                            </Button>
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="private-session"
                                    checked={isPrivate}
                                    onCheckedChange={(checked) => setIsPrivate(checked === true)}
                                    disabled={isLoading}
                                />
                                <Label
                                    htmlFor="private-session"
                                    className="text-xs text-muted-foreground cursor-pointer"
                                >
                                    Private session
                                </Label>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                        </div>
                    </div>

                    {/* Agent Configuration Dialog */}
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogContent className="sm:max-w-[600px]">
                            <DialogHeader>
                                <div className="flex items-center gap-2">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                        <Settings className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <DialogTitle className="text-xl">Configure Agents</DialogTitle>
                                        <DialogDescription className="mt-1">
                                            Select agents to run simultaneously ({tempAgentConfigs.length}/4)
                                        </DialogDescription>
                                    </div>
                                </div>
                            </DialogHeader>
                            <div className="py-4">
                                <div className="space-y-3">
                                    {(Object.keys(AGENT_LABELS) as AgentType[]).map((agentType) => {
                                        const selected = isAgentSelected(agentType);
                                        const currentModel = getAgentModel(agentType);
                                        const isDisabled = agentType === "skyvern"; // Skyvern is disabled due to dependency conflicts
                                        const isMaxReached = !selected && tempAgentConfigs.length >= 4;

                                        return (
                                            <div
                                                key={agentType}
                                                className={cn(
                                                    "group relative rounded-lg border-2 p-4 transition-all",
                                                    selected
                                                        ? "border-primary bg-primary/5 shadow-sm"
                                                        : "border-border hover:border-primary/50 hover:bg-accent/50",
                                                    (isDisabled || isMaxReached) && "opacity-50 cursor-not-allowed"
                                                )}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                                        <Checkbox
                                                            id={agentType}
                                                            checked={selected}
                                                            onCheckedChange={() => !isDisabled && !isMaxReached && toggleAgent(agentType)}
                                                            disabled={isDisabled || isMaxReached}
                                                            className="mt-0.5"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <Bot className={cn(
                                                                    "h-4 w-4 shrink-0",
                                                                    selected ? "text-primary" : "text-muted-foreground"
                                                                )} />
                                                                <Label
                                                                    htmlFor={agentType}
                                                                    className={cn(
                                                                        "text-sm font-semibold cursor-pointer",
                                                                        selected && "text-primary",
                                                                        (isDisabled || isMaxReached) && "cursor-not-allowed"
                                                                    )}
                                                                >
                                                                    {AGENT_LABELS[agentType]}
                                                                </Label>
                                                                {selected && (
                                                                    <Badge variant="default" className="ml-1">
                                                                        <CheckCircle2 className="h-3 w-3" />
                                                                        <span>Active</span>
                                                                    </Badge>
                                                                )}
                                                                {isDisabled && (
                                                                    <Badge variant="outline" className="ml-1">
                                                                        <XCircle className="h-3 w-3" />
                                                                        <span>Unavailable</span>
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            {selected && MODEL_OPTIONS[agentType].length > 0 && (
                                                                <div className="mt-3">
                                                                    <Label className="text-xs text-muted-foreground mb-2 block">
                                                                        Model
                                                                    </Label>
                                                                    <Select
                                                                        value={currentModel}
                                                                        onValueChange={(v) => updateAgentModel(agentType, v as ModelType)}
                                                                    >
                                                                        <SelectTrigger className="w-full h-9 bg-background">
                                                                            <div className="flex items-center gap-2 w-full">
                                                                                <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                                                                                <SelectValue placeholder="Select model" />
                                                                            </div>
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            {MODEL_OPTIONS[agentType].map((model) => {
                                                                                const { provider, modelName } = formatModelName(model);
                                                                                return (
                                                                                    <SelectItem key={model} value={model}>
                                                                                        <div className="flex flex-col py-0.5">
                                                                                            <span className="font-medium leading-tight">{modelName}</span>
                                                                                            <span className="text-xs text-muted-foreground leading-tight">
                                                                                                {getProviderName(provider)}
                                                                                            </span>
                                                                                        </div>
                                                                                    </SelectItem>
                                                                                );
                                                                            })}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                            )}
                                                            {selected && MODEL_OPTIONS[agentType].length === 0 && (
                                                                <div className="mt-3 flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                                                                    <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                                                                    <span className="text-xs text-muted-foreground">
                                                                        Uses built-in models
                                                                    </span>
                                                                </div>
                                                            )}
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
                                        <p className="text-xs text-warning-foreground">
                                            Maximum of 4 agents allowed. Deselect an agent to add another.
                                        </p>
                                    </div>
                                )}
                                {tempAgentConfigs.length === 0 && (
                                    <div className="mt-4 rounded-lg bg-info/10 border border-info/20 p-3 flex items-start gap-2">
                                        <Bot className="h-4 w-4 text-info-foreground mt-0.5 shrink-0" />
                                        <p className="text-xs text-info-foreground">
                                            Select at least one agent to continue.
                                        </p>
                                    </div>
                                )}
                            </div>
                            <DialogFooter className="sm:justify-between">
                                <div className="text-xs text-muted-foreground">
                                    {tempAgentConfigs.length > 0 && (
                                        <span>
                                            {tempAgentConfigs.length} agent{tempAgentConfigs.length !== 1 ? "s" : ""} selected
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={handleDialogCancel}>
                                        Cancel
                                    </Button>
                                    <Button onClick={handleDialogSave} disabled={tempAgentConfigs.length === 0}>
                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                        Save Changes
                                    </Button>
                                </div>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Login Dialog */}
                    <Dialog open={isLoginDialogOpen} onOpenChange={setIsLoginDialogOpen}>
                        <DialogContent className="sm:max-w-[400px]">
                            <DialogHeader>
                                <DialogTitle>Sign In Required</DialogTitle>
                                <DialogDescription>
                                    Please sign in or create an account to submit a message.
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