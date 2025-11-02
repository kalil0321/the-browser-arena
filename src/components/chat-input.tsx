"use client";

import { useState, useRef, useEffect, startTransition, useMemo, lazy, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { getApiKey, hasApiKey } from "@/lib/api-keys";
import { AgentConfigDialog } from "./agent-config-dialog";
import { getClientFingerprint } from "@/lib/fingerprint";

// Import types and helpers
import { AgentConfig, ChatInputState, AGENT_LABELS } from "./chat-input/types";
import { AgentSelectionDialog } from "./chat-input/agent-selection-dialog";
import { AuthDialog } from "./chat-input/auth-dialog";
import { FileUpload } from "./chat-input/file-upload";
import { AgentPills } from "./chat-input/agent-pills";
import { Paperclip } from "lucide-react";

// Lazy load the LoadingDino component for better initial load performance
const LoadingDino = lazy(() => import("@/components/loading-dino").then(mod => ({ default: mod.LoadingDino })));
import { authClient } from "@/lib/auth/client";

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
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Device fingerprinting for demo mode
    const [clientFingerprint, setClientFingerprint] = useState<string | null>(null);

    // Store input when user hits demo limit to restore after signup
    const [storedInputForDemo, setStoredInputForDemo] = useState<string | null>(null);

    // Get current user for API key access
    const user = useQuery(
        api.auth.getCurrentUser,
        isAuthenticated ? {} : "skip"
    );

    // Auth dialog state
    const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);

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

    const handleSignIn = async (email: string, password: string) => {
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

    const handleSignUp = async (email: string, password: string, name: string) => {
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
        setIsDialogOpen(true);
    };

    const handleDialogSave = (configs: AgentConfig[]) => {
        setAgentConfigs(configs);
        setIsDialogOpen(false);
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
                <FileUpload
                    file={file}
                    onFileChange={setFile}
                    onRemoveFile={handleRemoveFile}
                    isLoading={isLoading}
                    isUploadingFiles={isUploadingFiles}
                    fileInputRef={fileInputRef}
                >
                    <div
                        className={cn(
                            "bg-background rounded-4xl w-full space-y-2 px-4 py-4 transition-colors relative"
                        )}
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

                                <AgentPills
                                    agentConfigs={agentConfigs}
                                    onConfigClick={setPropertiesDialogAgent}
                                    isLoading={isLoading}
                                />
                            </div>

                            <div className="flex items-center gap-4" />
                        </div>
                    </div>
                </FileUpload>

                {/* Agent Selection Dialog */}
                <AgentSelectionDialog
                    open={isDialogOpen}
                    onOpenChange={setIsDialogOpen}
                    agentConfigs={agentConfigs}
                    onSave={handleDialogSave}
                />

                {/* Agent Properties Dialog */}
                <AgentConfigDialog
                    agentConfig={propertiesDialogAgent}
                    open={propertiesDialogAgent !== null}
                    onOpenChange={(open) => !open && setPropertiesDialogAgent(null)}
                    onSave={handlePropertiesSave}
                />

                {/* Login Dialog */}
                <AuthDialog
                    open={isLoginDialogOpen}
                    onOpenChange={setIsLoginDialogOpen}
                    onSignIn={handleSignIn}
                    onSignUp={handleSignUp}
                    authError={authError}
                    isSubmittingAuth={isSubmittingAuth}
                />
            </div>
        </>
    );
}

export type { ChatInputState } from "./chat-input/types";
