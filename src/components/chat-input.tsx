"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LoadingDino } from "@/components/loading-dino";

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

export function ChatInput() {
    // Use this as default input
    const [input, setInput] = useState("Find which companies raised more than $10M in the US this month");
    const [isLoading, setIsLoading] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const router = useRouter();

    // Agent configuration state
    const [agentConfigs, setAgentConfigs] = useState<AgentConfig[]>([
        { agent: "browser-use", model: "browser-use/bu-1.0" },
        { agent: "smooth", model: "google/gemini-2.5-flash" }
    ]);

    // Temporary state for dialog
    const [tempAgentConfigs, setTempAgentConfigs] = useState<AgentConfig[]>(agentConfigs);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !isLoading && agentConfigs.length > 0) {
            setIsLoading(true);
            try {
                console.log("Submitting:", input, "with agents:", agentConfigs);

                // Call the multi-agent endpoint
                const response = await fetch("/api/agent/multi", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        instruction: input,
                        agents: agentConfigs
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

    return (
        <>
            {isLoading && <LoadingDino />}
            <div className="container mx-auto max-w-3xl px-4">
                <div className="bg-muted rounded-4xl w-full space-y-2 px-6 py-4">
                    <form
                        onSubmit={handleSubmit}
                        className="relative mx-auto overflow-hidden transition duration-200 dark:bg-zinc-800 mb-4 h-12 w-full max-w-full bg-transparent shadow-none"
                    >
                        <input
                            placeholder="Automate your tasks..."
                            type="text"
                            className="sm:text relative z-50 h-full w-full border-none bg-transparent pr-20 text-sm tracking-tight text-black focus:outline-none focus:ring-0 dark:text-white"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className="absolute right-0 top-1/2 z-50 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black transition duration-200 disabled:bg-gray-100 dark:bg-zinc-900 dark:disabled:bg-zinc-800"
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
                        </div>

                        <div className="flex items-center gap-4">
                        </div>
                    </div>

                    {/* Agent Configuration Dialog */}
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                                <DialogTitle>Configure Agents</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Select up to 4 agents to run simultaneously. Each agent will work on the same task.
                                </p>
                                <div className="space-y-4">
                                    {(Object.keys(AGENT_LABELS) as AgentType[]).map((agentType) => {
                                        const selected = isAgentSelected(agentType);
                                        const currentModel = getAgentModel(agentType);
                                        const isDisabled = agentType === "skyvern"; // Skyvern is disabled due to dependency conflicts

                                        return (
                                            <div key={agentType} className="space-y-2">
                                                <div className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={agentType}
                                                        checked={selected}
                                                        onCheckedChange={() => !isDisabled && toggleAgent(agentType)}
                                                        disabled={isDisabled || (!selected && tempAgentConfigs.length >= 4)}
                                                    />
                                                    <Label
                                                        htmlFor={agentType}
                                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                    >
                                                        {AGENT_LABELS[agentType]}
                                                    </Label>
                                                </div>
                                                {selected && MODEL_OPTIONS[agentType].length > 0 && (
                                                    <div className="ml-6 mt-2">
                                                        <Select
                                                            value={currentModel}
                                                            onValueChange={(v) => updateAgentModel(agentType, v as ModelType)}
                                                        >
                                                            <SelectTrigger size="sm" className="w-full">
                                                                <SelectValue placeholder="Select model" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {MODEL_OPTIONS[agentType].map((model) => (
                                                                    <SelectItem key={model} value={model}>
                                                                        {model}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}
                                                {selected && MODEL_OPTIONS[agentType].length === 0 && (
                                                    <div className="ml-6 mt-2">
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                                            Uses built-in models
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={handleDialogCancel}>
                                    Cancel
                                </Button>
                                <Button onClick={handleDialogSave} disabled={tempAgentConfigs.length === 0}>
                                    Save
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
        </>
    );
}