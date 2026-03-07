"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Settings, CheckCircle2, XCircle, Plus, Trash2, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentType, ModelType, AgentConfig, AGENT_LABELS, MODEL_OPTIONS } from "./types";
import { BrowserUseLogo } from "@/components/logos/bu";
import { StagehandLogo } from "@/components/logos/stagehand";
import { NotteLogo } from "@/components/logos/notte";
import { PlaywrightLogo } from "@/components/logos/playwright";
import { ChromeDevtoolsLogo } from "@/components/logos/chrome-devtools";
import { formatModelName, getProviderName, ProviderLogo } from "./helpers";

interface AgentSelectionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    agentConfigs: AgentConfig[];
    onSave: (configs: AgentConfig[]) => void;
}

const AVAILABLE_AGENT_TYPES: AgentType[] = [
    "stagehand",
    "browser-use",
    "browser-use-cloud",
    "notte",
    "playwright-mcp",
    "chrome-devtools-mcp",
];

function normalizeConfig(config: AgentConfig): AgentConfig {
    if (config.agent === "claude-code" || config.agent === "codex") {
        const mcpType = config.mcpType === "chrome-devtools" ? "chrome-devtools" : "playwright";
        return {
            ...config,
            agent: mcpType === "chrome-devtools" ? "chrome-devtools-mcp" : "playwright-mcp",
            model: config.agent,
            mcpType,
        };
    }
    return config;
}

export function AgentSelectionDialog({
    open,
    onOpenChange,
    agentConfigs,
    onSave
}: AgentSelectionDialogProps) {
    const [tempAgentConfigs, setTempAgentConfigs] = useState<AgentConfig[]>(
        agentConfigs.filter((config) => config.agent !== "smooth").map(normalizeConfig)
    );

    useEffect(() => {
        if (open) {
            setTempAgentConfigs(agentConfigs.filter((config) => config.agent !== "smooth").map(normalizeConfig));
        }
    }, [open, agentConfigs]);

    const handleSave = () => {
        onSave([...tempAgentConfigs]);
        onOpenChange(false);
    };

    const handleCancel = () => {
        setTempAgentConfigs(agentConfigs.filter((config) => config.agent !== "smooth").map(normalizeConfig));
        onOpenChange(false);
    };

    const addAgentInstance = (agent: AgentType) => {
        if (tempAgentConfigs.length >= 4) {
            return;
        }
        const defaultModel = MODEL_OPTIONS[agent].length > 0 ? MODEL_OPTIONS[agent][0] : "";
        const newId = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setTempAgentConfigs([
            ...tempAgentConfigs,
            {
                id: newId,
                agent,
                model: defaultModel as ModelType,
                ...(agent === "playwright-mcp" ? { mcpType: "playwright" as const } : {}),
                ...(agent === "chrome-devtools-mcp" ? { mcpType: "chrome-devtools" as const } : {}),
            },
        ]);
    };

    const removeAgentInstance = (index: number) => {
        setTempAgentConfigs(tempAgentConfigs.filter((_, i) => i !== index));
    };

    const updateAgentInstanceModel = (index: number, model: ModelType) => {
        setTempAgentConfigs(
            tempAgentConfigs.map((config, i) =>
                i === index ? { ...config, model } : config
            )
        );
    };

    const getAgentInstanceCount = (agent: AgentType): number => {
        return tempAgentConfigs.filter((config) => config.agent === agent).length;
    };

    const getAgentInstances = (agent: AgentType): Array<{ config: AgentConfig; index: number }> => {
        return tempAgentConfigs
            .map((config, index) => ({ config, index }))
            .filter(({ config }) => config.agent === agent);
    };

    const renderAgentIcon = (agentType: AgentType) => {
        if (agentType === "browser-use" || agentType === "browser-use-cloud") {
            return <BrowserUseLogo className="h-3.5 w-3.5" />;
        }
        if (agentType === "stagehand") {
            return <StagehandLogo className="h-3.5 w-3.5" />;
        }
        if (agentType === "notte") {
            return <NotteLogo className="h-3.5 w-3.5" />;
        }
        if (agentType === "playwright-mcp") {
            return <PlaywrightLogo className="h-3.5 w-3.5" />;
        }
        if (agentType === "chrome-devtools-mcp") {
            return <ChromeDevtoolsLogo className="h-3.5 w-3.5" />;
        }
        return null;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="p-3 font-mono sm:max-w-[520px]">
                <DialogHeader>
                    <div className="flex items-center gap-1.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                            <Settings className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div>
                            <DialogTitle className="text-base font-mono">Configure Agents</DialogTitle>
                            <DialogDescription className="mt-0.5 text-[11px]">
                                Pick up to 4 agents ({tempAgentConfigs.length}/4)
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>
                <div className="py-1">
                    <div className="space-y-3">
                        {AVAILABLE_AGENT_TYPES.map((agentType) => {
                            const instances = getAgentInstances(agentType);
                            const instanceCount = getAgentInstanceCount(agentType);
                            const isMaxReached = tempAgentConfigs.length >= 4;

                            return (
                                <div key={agentType} className="space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex min-w-0 items-center gap-2">
                                            {renderAgentIcon(agentType)}
                                            <Label className="font-default text-[13px] font-semibold">
                                                {AGENT_LABELS[agentType]}
                                            </Label>
                                            {instanceCount > 0 && (
                                                <Badge variant="secondary" className="h-4 px-1.5 py-0 text-[10px]">
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
                                                className="h-6 px-2 text-[11px]"
                                            >
                                                <Plus className="mr-1 h-3 w-3" />
                                                Add
                                            </Button>
                                        )}
                                    </div>

                                    {instances.length > 0 ? (
                                        <div className="ml-5 space-y-1.5">
                                            {instances.map(({ config, index }, idx) => {
                                                const isMultiple = instances.length > 1;
                                                return (
                                                    <div
                                                        key={`${agentType}-${index}`}
                                                        className={cn("rounded-md border border-primary/30 bg-primary/5 px-2.5 py-2 transition-all")}
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="flex min-w-0 flex-1 items-center gap-2">
                                                                {isMultiple && (
                                                                    <Badge variant="outline" className="h-4 shrink-0 px-1.5 py-0 text-[10px]">
                                                                        #{idx + 1}
                                                                    </Badge>
                                                                )}
                                                                {MODEL_OPTIONS[agentType].length > 0 ? (
                                                                    <div className="min-w-0 flex-1 font-mono">
                                                                        <Select
                                                                            value={config.model}
                                                                            onValueChange={(value) => updateAgentInstanceModel(index, value as ModelType)}
                                                                        >
                                                                            <SelectTrigger className="h-7 bg-background text-[11px]">
                                                                                <div className="flex w-full items-center gap-2">
                                                                                    {(() => {
                                                                                        const { provider, modelName } = formatModelName(config.model || "");
                                                                                        return (
                                                                                            <>
                                                                                                <ProviderLogo provider={provider} />
                                                                                                <span className="truncate text-[11px]">{modelName === "claude-code" ? "Claude Code" : modelName === "codex" ? "Codex" : modelName || "Select model"}</span>
                                                                                            </>
                                                                                        );
                                                                                    })()}
                                                                                </div>
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {MODEL_OPTIONS[agentType].map((model) => {
                                                                                    const { provider, modelName } = formatModelName(model);
                                                                                    const displayName = modelName === "claude-code" ? "Claude Code" : modelName === "codex" ? "Codex" : modelName;
                                                                                    return (
                                                                                        <SelectItem key={model} value={model}>
                                                                                            <div className="flex items-center gap-2 py-0.5 font-mono">
                                                                                                <ProviderLogo provider={provider} />
                                                                                                <div className="flex flex-col">
                                                                                                    <span className="text-[11px] font-medium leading-tight">{displayName}</span>
                                                                                                    <span className="text-[10px] leading-tight text-muted-foreground">
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
                                                                    <span className="text-[11px] text-muted-foreground">
                                                                        {AGENT_LABELS[agentType]}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => removeAgentInstance(index)}
                                                                className="h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        !isMaxReached && (
                                            <div className="ml-5">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => addAgentInstance(agentType)}
                                                    className="h-7 w-full justify-start px-2.5 text-[11px] text-muted-foreground hover:text-foreground"
                                                >
                                                    <Plus className="mr-1.5 h-3 w-3" />
                                                    Add {AGENT_LABELS[agentType]}
                                                </Button>
                                            </div>
                                        )
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {tempAgentConfigs.length >= 4 && (
                        <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/10 p-2.5">
                            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />
                            <p className="font-default text-[11px] text-warning-foreground">
                                Max 4 agent instances. Remove one to add another.
                            </p>
                        </div>
                    )}
                    {tempAgentConfigs.length === 0 && (
                        <div className="mt-3 flex items-start gap-2 rounded-lg border border-info/20 bg-info/10 p-2.5">
                            <Bot className="mt-0.5 h-4 w-4 shrink-0 text-info-foreground" />
                            <p className="font-default text-[11px] text-info-foreground">
                                Select at least one agent to continue.
                            </p>
                        </div>
                    )}
                </div>
                <DialogFooter className="gap-2 border-t pt-2 sm:justify-between">
                    <div className="font-default text-[11px] text-muted-foreground">
                        {tempAgentConfigs.length > 0 && (
                            <span>
                                {tempAgentConfigs.length} agent{tempAgentConfigs.length !== 1 ? "s" : ""} selected
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleCancel} className="h-8 px-3 font-mono text-[11px]">
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={tempAgentConfigs.length === 0} className="h-8 px-3 font-mono text-[11px]">
                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                            Save
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
