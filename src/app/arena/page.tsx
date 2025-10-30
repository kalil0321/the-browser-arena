"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { SidebarInset } from "@/components/ui/sidebar";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    TableCaption,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useEffect, useMemo, useState } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from "lucide-react";

type SessionRow = {
    _id: Id<"sessions">;
    instruction: string;
    createdAt: number;
    userId: string;
};

export default function ArenaPage() {
    const sessions = useQuery(api.queries.getAllSessions);
    const agents = useQuery(api.queries.getAllAgents);
    const stats = useQuery(api.queries.getArenaStats);

    const [filterAgent, setFilterAgent] = useState<string>("all");
    const [filterModel, setFilterModel] = useState<string>("all");
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [isStatsOpen, setIsStatsOpen] = useState<boolean>(false);

    // Create a map of sessionId -> agents for quick lookup
    const agentsBySession = useMemo(() => {
        if (!agents) return new Map();
        const map = new Map<Id<"sessions">, typeof agents>();
        agents.forEach((agent) => {
            const existing = map.get(agent.sessionId) || [];
            map.set(agent.sessionId, [...existing, agent]);
        });
        return map;
    }, [agents]);

    // Filter sessions based on selected filters
    const filteredSessions = useMemo(() => {
        if (!sessions) return [];

        return sessions.filter((session) => {
            const sessionAgents = agentsBySession.get(session._id) || [];

            if (filterAgent !== "all" && !sessionAgents.some(a => a.name === filterAgent)) {
                return false;
            }

            if (filterModel !== "all" && !sessionAgents.some(a => a.model === filterModel)) {
                return false;
            }

            if (filterStatus !== "all" && !sessionAgents.some(a => a.status === filterStatus)) {
                return false;
            }

            return true;
        });
    }, [sessions, agentsBySession, filterAgent, filterModel, filterStatus]);

    // Get unique values for filters
    const uniqueAgents = useMemo(() => {
        if (!stats) return [];
        return Object.keys(stats.agents).sort();
    }, [stats]);

    const uniqueModels = useMemo(() => {
        if (!stats) return [];
        return Object.keys(stats.models).sort();
    }, [stats]);

    const statusOptions = ["all", "pending", "running", "completed", "failed"];

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleString();
    };

    return (
        <SidebarInset className="flex flex-1 flex-col overflow-hidden bg-background">
            <header className="flex items-center justify-between border-b px-4 py-4">
                <div>
                    <h1 className="text-xl font-semibold text-foreground">Arena</h1>
                    <p className="text-sm text-muted-foreground">
                        View all crowdsourced sessions, models, and agents.
                    </p>
                </div>
                <Button asChild>
                    <Link href="/">New Session</Link>
                </Button>
            </header>

            {/* Statistics Cards */}
            {stats && (
                <div className="border-b px-4 py-3 bg-muted/30">
                    <Collapsible open={isStatsOpen} onOpenChange={setIsStatsOpen}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
                                <div className="rounded-lg border bg-card p-3">
                                    <div className="text-xs font-medium text-muted-foreground">Total Sessions</div>
                                    <div className="text-xl font-bold font-default mt-0.5">{stats.totalSessions}</div>
                                </div>
                                <div className="rounded-lg border bg-card p-3">
                                    <div className="text-xs font-medium text-muted-foreground">Total Agents</div>
                                    <div className="text-xl font-bold font-default mt-0.5">{stats.totalAgents}</div>
                                </div>
                                <div className="rounded-lg border bg-card p-3">
                                    <div className="text-xs font-medium text-muted-foreground">Unique Models</div>
                                    <div className="text-xl font-bold font-default mt-0.5">{Object.keys(stats.models).length}</div>
                                </div>
                                <div className="rounded-lg border bg-card p-3">
                                    <div className="text-xs font-medium text-muted-foreground">Unique Agents</div>
                                    <div className="text-xl font-bold font-default mt-0.5">{Object.keys(stats.agents).length}</div>
                                </div>
                            </div>
                            <CollapsibleTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="ml-3 shrink-0"
                                >
                                    {isStatsOpen ? (
                                        <>
                                            <ChevronUp className="size-4 mr-1" />
                                            Hide Details
                                        </>
                                    ) : (
                                        <>
                                            <ChevronDown className="size-4 mr-1" />
                                            Show Details
                                        </>
                                    )}
                                </Button>
                            </CollapsibleTrigger>
                        </div>

                        <CollapsibleContent>
                            {/* Model and Agent Breakdown */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pb-2">
                                {/* Models Usage */}
                                <div className="rounded-lg border bg-card p-4">
                                    <div className="text-sm font-semibold mb-3">Models Used</div>
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                        {Object.entries(stats.models)
                                            .sort(([, a], [, b]) => b - a)
                                            .map(([model, count]) => (
                                                <div key={model} className="flex items-center justify-between">
                                                    <span className="text-sm text-muted-foreground font-mono truncate">
                                                        {model}
                                                    </span>
                                                    <Badge variant="outline" className="font-default">{count}</Badge>
                                                </div>
                                            ))}
                                        {Object.keys(stats.models).length === 0 && (
                                            <p className="text-sm text-muted-foreground">No models used yet</p>
                                        )}
                                    </div>
                                </div>

                                {/* Agents Usage */}
                                <div className="rounded-lg border bg-card p-4">
                                    <div className="text-sm font-semibold mb-3">Agents Used</div>
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                        {Object.entries(stats.agents)
                                            .sort(([, a], [, b]) => b - a)
                                            .map(([agent, count]) => (
                                                <div key={agent} className="flex items-center justify-between">
                                                    <span className="text-sm capitalize">{agent}</span>
                                                    <Badge variant="outline" className="font-default">{count}</Badge>
                                                </div>
                                            ))}
                                        {Object.keys(stats.agents).length === 0 && (
                                            <p className="text-sm text-muted-foreground">No agents used yet</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                </div>
            )}

            {/* Filters */}
            <div className="border-b px-4 py-3 bg-background">
                <div className="flex flex-wrap gap-3 items-center">
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-muted-foreground">Agent:</label>
                        <Select value={filterAgent} onValueChange={setFilterAgent}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="All Agents" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Agents</SelectItem>
                                {uniqueAgents.map((agent) => (
                                    <SelectItem key={agent} value={agent}>
                                        {agent.charAt(0).toUpperCase() + agent.slice(1)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-muted-foreground">Model:</label>
                        <Select value={filterModel} onValueChange={setFilterModel}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="All Models" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Models</SelectItem>
                                {uniqueModels.map((model) => (
                                    <SelectItem key={model} value={model}>
                                        {model}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-muted-foreground">Status:</label>
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="All Statuses" />
                            </SelectTrigger>
                            <SelectContent>
                                {statusOptions.map((status) => (
                                    <SelectItem key={status} value={status}>
                                        {status === "all" ? "All Statuses" : status.charAt(0).toUpperCase() + status.slice(1)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {(filterAgent !== "all" || filterModel !== "all" || filterStatus !== "all") && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setFilterAgent("all");
                                setFilterModel("all");
                                setFilterStatus("all");
                            }}
                        >
                            Clear Filters
                        </Button>
                    )}
                </div>
            </div>

            {/* Sessions Table */}
            <div className="flex-1 overflow-auto px-6 py-6">
                <div className="rounded-xl border bg-card shadow-sm">
                    <Table>
                        <TableCaption>
                            Showing <span className="font-default">{filteredSessions?.length || 0}</span> of <span className="font-default">{sessions?.length || 0}</span> sessions
                        </TableCaption>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[180px]">Session ID</TableHead>
                                <TableHead>Instruction</TableHead>
                                <TableHead>Agents</TableHead>
                                <TableHead>Models</TableHead>
                                <TableHead className="w-[140px]">Created</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {!sessions && (
                                <TableRow>
                                    <TableCell colSpan={5}>
                                        <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                                            Loading sessions…
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}

                            {sessions && filteredSessions.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5}>
                                        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                                            <p className="text-sm font-medium text-foreground">
                                                {filterAgent !== "all" || filterModel !== "all" || filterStatus !== "all"
                                                    ? "No sessions match the filters"
                                                    : "No sessions yet"}
                                            </p>
                                            {filterAgent === "all" && filterModel === "all" && filterStatus === "all" && (
                                                <>
                                                    <p className="text-sm text-muted-foreground max-w-sm">
                                                        Start a new session to see it listed here once agents finish running.
                                                    </p>
                                                    <Button asChild size="sm">
                                                        <Link href="/">Create session</Link>
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}

                            {filteredSessions &&
                                filteredSessions.map((session: SessionRow) => {
                                    const sessionAgents = agentsBySession.get(session._id) || [];
                                    const modelsUsed = Array.from(
                                        new Set(sessionAgents.map((a) => a.model).filter(Boolean))
                                    );

                                    return (
                                        <TableRow key={session._id}>
                                            <TableCell className="font-mono text-xs">
                                                <Link
                                                    href={`/session/${session._id}`}
                                                    className="text-primary underline-offset-2 hover:underline"
                                                >
                                                    {session._id.slice(-8)}
                                                </Link>
                                            </TableCell>
                                            <TableCell className="max-w-xl">
                                                <Link
                                                    href={`/session/${session._id}`}
                                                    className="text-foreground hover:text-primary transition-colors"
                                                >
                                                    <div className="truncate font-default">{session.instruction}</div>
                                                </Link>
                                            </TableCell>
                                            <TableCell>
                                                <SessionAgentsDisplay agents={sessionAgents} />
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {modelsUsed.length > 0 ? (
                                                        modelsUsed.map((model) => (
                                                            <Badge
                                                                key={model}
                                                                variant="secondary"
                                                                className="text-xs font-mono"
                                                            >
                                                                {model}
                                                            </Badge>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">—</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {formatDate(session.createdAt)}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </SidebarInset>
    );
}

function SessionAgentsDisplay({
    agents,
}: {
    agents: Array<{
        _id: Id<"agents">;
        name: string;
        status: string;
        model?: string;
    }>;
}) {
    const getStatusColor = (status: string) => {
        switch (status) {
            case "completed":
                return "bg-emerald-500";
            case "running":
                return "bg-sky-500";
            case "failed":
                return "bg-red-500";
            default:
                return "bg-muted-foreground/60";
        }
    };

    if (!agents || agents.length === 0) {
        return <span className="text-xs text-muted-foreground">No agents</span>;
    }

    return (
        <div className="flex flex-wrap gap-2">
            {agents.map((agent) => (
                <Badge
                    key={agent._id}
                    variant="outline"
                    className="flex items-center gap-1 capitalize"
                >
                    <span
                        className={`size-1.5 rounded-full ${getStatusColor(agent.status)}`}
                        aria-hidden="true"
                    />
                    {agent.name}
                </Badge>
            ))}
        </div>
    );
}

