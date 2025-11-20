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
import { SmoothLogo } from "@/components/logos/smooth";
import { StagehandLogo } from "@/components/logos/stagehand";
import { NotteLogo } from "@/components/logos/notte";
import { formatModelName, getProviderName, ProviderLogo } from "./helpers";

interface AgentSelectionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    agentConfigs: AgentConfig[];
    onSave: (configs: AgentConfig[]) => void;
}

export function AgentSelectionDialog({
    open,
    onOpenChange,
    agentConfigs,
    onSave
}: AgentSelectionDialogProps) {
    const [tempAgentConfigs, setTempAgentConfigs] = useState<AgentConfig[]>(agentConfigs);

    // Reset temp configs when dialog opens
    useEffect(() => {
        if (open) {
            setTempAgentConfigs([...agentConfigs]);
        }
    }, [open, agentConfigs]);

    const handleSave = () => {
        onSave([...tempAgentConfigs]);
        onOpenChange(false);
    };

    const handleCancel = () => {
        setTempAgentConfigs([...agentConfigs]);
        onOpenChange(false);
    };

    const addAgentInstance = (agent: AgentType) => {
        if (tempAgentConfigs.length >= 4) {
            return; // Max limit reached
        }
        // For agents without model options (smooth, notte), use empty string
        const defaultModel = MODEL_OPTIONS[agent].length > 0
            ? MODEL_OPTIONS[agent][0]
            : "";
        const newId = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setTempAgentConfigs([...tempAgentConfigs, { id: newId, agent, model: defaultModel as ModelType }]);
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
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
                                                {agentType === "notte" && (
                                                    <NotteLogo className="h-4 w-4" />
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
                                                                            {AGENT_LABELS[agentType]}
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
                        <Button variant="outline" onClick={handleCancel} className="font-mono">
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={tempAgentConfigs.length === 0} className="font-mono">
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Save Changes
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

