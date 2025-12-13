"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { AgentConfig, ModelType, MODEL_OPTIONS } from "./chat-input/types";

interface AgentConfigDialogProps {
    agentConfig: AgentConfig | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (config: AgentConfig) => void;
}

export function AgentConfigDialog({ agentConfig, open, onOpenChange, onSave }: AgentConfigDialogProps) {
    const [secrets, setSecrets] = useState<Array<{ key: string; value: string }>>([]);
    const [thinkingModel, setThinkingModel] = useState<ModelType | undefined>(undefined);
    const [executionModel, setExecutionModel] = useState<ModelType | undefined>(undefined);

    useEffect(() => {
        if (agentConfig) {
            // Initialize secrets from config
            if (agentConfig.secrets) {
                setSecrets(Object.entries(agentConfig.secrets).map(([key, value]) => ({ key, value })));
            } else {
                setSecrets([]);
            }
            setThinkingModel(agentConfig.thinkingModel);
            setExecutionModel(agentConfig.executionModel);
        } else {
            setSecrets([]);
            setThinkingModel(undefined);
            setExecutionModel(undefined);
        }
    }, [agentConfig, open]);

    if (!agentConfig) return null;

    const isBrowserUse = agentConfig.agent === "browser-use" || agentConfig.agent === "browser-use-cloud";
    const isStagehand = agentConfig.agent === "stagehand";
    const isSmooth = agentConfig.agent === "smooth";
    const isNotte = agentConfig.agent === "notte";

    // Don't show dialog for smooth
    if (isSmooth) {
        return null;
    }

    const handleAddSecret = () => {
        setSecrets([...secrets, { key: "", value: "" }]);
    };

    const handleRemoveSecret = (index: number) => {
        setSecrets(secrets.filter((_, i) => i !== index));
    };

    const handleSecretChange = (index: number, field: "key" | "value", value: string) => {
        const newSecrets = [...secrets];
        newSecrets[index][field] = value;
        setSecrets(newSecrets);
    };

    const handleSave = () => {
        const secretsObj: Record<string, string> = {};
        secrets.forEach(({ key, value }) => {
            if (key.trim()) {
                secretsObj[key.trim()] = value.trim();
            }
        });

        const updatedConfig: AgentConfig = {
            ...agentConfig,
            secrets: Object.keys(secretsObj).length > 0 ? secretsObj : undefined,
            thinkingModel: thinkingModel || undefined,
            executionModel: executionModel || undefined,
        };

        onSave(updatedConfig);
        onOpenChange(false);
    };

    const stagehandModels = MODEL_OPTIONS[agentConfig.agent] || MODEL_OPTIONS.stagehand;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                    <DialogTitle className="capitalize">
                        Configure {agentConfig.agent.replace("-", " ")} Properties
                    </DialogTitle>
                    <DialogDescription>
                        Set additional configuration options for this agent
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto">
                    {isBrowserUse && (
                        <div className="space-y-3">
                            <div>
                                <Label className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 block">
                                    Secrets
                                </Label>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                    Add secrets as key-value pairs for secure credential management.
                                </p>
                                <div className="space-y-2">
                                    {secrets.map((secret, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <Input
                                                placeholder="Key"
                                                value={secret.key}
                                                onChange={(e) => handleSecretChange(index, "key", e.target.value)}
                                                className="flex-1"
                                            />
                                            <Input
                                                type="password"
                                                placeholder="Value"
                                                value={secret.value}
                                                onChange={(e) => handleSecretChange(index, "value", e.target.value)}
                                                className="flex-1"
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleRemoveSecret(index)}
                                                className="shrink-0"
                                            >
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </div>
                                    ))}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleAddSecret}
                                        className="w-full"
                                    >
                                        + Add Secret
                                    </Button>
                                </div>
                                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-3">
                                    <p className="text-xs text-blue-900 dark:text-blue-100">
                                        <strong>Note:</strong> Secrets are passed to the agent at runtime. They are not stored permanently.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {isStagehand && (
                        <div className="space-y-3">
                            <div>
                                <Label className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 block">
                                    Model Configuration
                                </Label>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                    Configure separate models for thinking (planning) and execution (actions).
                                </p>
                                <div className="space-y-3">
                                    <div>
                                        <Label htmlFor="thinking-model" className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                                            Thinking Model
                                        </Label>
                                        <Select
                                            value={thinkingModel || agentConfig.model || stagehandModels[0]}
                                            onValueChange={(v) => setThinkingModel(v as ModelType)}
                                        >
                                            <SelectTrigger id="thinking-model">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {stagehandModels.map((model) => (
                                                    <SelectItem key={model} value={model}>
                                                        {model}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            Used for reasoning and planning
                                        </p>
                                    </div>
                                    <div>
                                        <Label htmlFor="execution-model" className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                                            Execution Model
                                        </Label>
                                        <Select
                                            value={executionModel || agentConfig.model || stagehandModels[0]}
                                            onValueChange={(v) => setExecutionModel(v as ModelType)}
                                        >
                                            <SelectTrigger id="execution-model">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {stagehandModels.map((model) => (
                                                    <SelectItem key={model} value={model}>
                                                        {model}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            Used for executing actions
                                        </p>
                                    </div>
                                </div>
                                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-3">
                                    <p className="text-xs text-blue-900 dark:text-blue-100">
                                        <strong>Note:</strong> If not specified, both thinking and execution will use the default model selected in agent configuration.
                                    </p>
                                </div>
                            </div>
                            <div>
                                <Label className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 block">
                                    Secrets
                                </Label>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                    Add secrets as key-value pairs for secure credential management. Secrets can be referenced in instructions using <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs">%secretKey%</code> syntax.
                                </p>
                                <div className="space-y-2">
                                    {secrets.map((secret, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <Input
                                                placeholder="Key"
                                                value={secret.key}
                                                onChange={(e) => handleSecretChange(index, "key", e.target.value)}
                                                className="flex-1"
                                            />
                                            <Input
                                                type="password"
                                                placeholder="Value"
                                                value={secret.value}
                                                onChange={(e) => handleSecretChange(index, "value", e.target.value)}
                                                className="flex-1"
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleRemoveSecret(index)}
                                                className="shrink-0"
                                            >
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </div>
                                    ))}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleAddSecret}
                                        className="w-full"
                                    >
                                        + Add Secret
                                    </Button>
                                </div>
                                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-3">
                                    <p className="text-xs text-blue-900 dark:text-blue-100">
                                        <strong>Note:</strong> Secrets are passed to the agent at runtime via variables. They are not stored permanently and are securely injected into the agent execution context.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave}>
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
