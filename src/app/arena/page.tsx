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
import type { Id, Doc } from "../../../convex/_generated/dataModel";
import { BrowserUseLogo } from "@/components/logos/bu";
import { SmoothLogo } from "@/components/logos/smooth";
import { StagehandLogo } from "@/components/logos/stagehand";
import { ClaudeLogo } from "@/components/logos/claude";
import { OpenAI } from "@/components/logos/openai";
import { PlaywrightLogo } from "@/components/logos/playwright";
import { ChromeDevtoolsLogo } from "@/components/logos/chrome-devtools";
import { AGENT_LABELS } from "@/components/chat-input/types";
import { useMemo, useState } from "react";
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
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import type { ArenaStats } from "@/types/arena";

const PAGE_SIZE = 25;

type SessionRow = Doc<"sessions">;

export default function ArenaPage() {
    const [filterAgent, setFilterAgent] = useState<string>("all");
    const [filterModel, setFilterModel] = useState<string>("all");
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [isStatsOpen, setIsStatsOpen] = useState<boolean>(false);
    const [cursor, setCursor] = useState<string | null>(null);
    const [allSessions, setAllSessions] = useState<SessionRow[]>([]);

    // Sessions-only query for 2-step loading (fast initial render)
    const paginatedData = useQuery(api.queries.getArenaSessionsPaginated, {
        paginationOpts: {
            numItems: PAGE_SIZE,
            cursor: cursor,
        },
    });

    // Separate query for stats (loads independently)
    const stats = useQuery(api.queries.getArenaStatsOptimized) as ArenaStats | undefined;

    // Combine current page with previously loaded sessions
    const { sessions, isDoneLoading, canLoadMore } = useMemo(() => {
        if (!paginatedData) {
            return {
                sessions: allSessions,
                isDoneLoading: false,
                canLoadMore: false,
            };
        }

        // Merge new page with existing sessions
        const currentSessions = cursor === null ? paginatedData.page : [...allSessions, ...paginatedData.page];

        return {
            sessions: currentSessions,
            isDoneLoading: paginatedData.isDone,
            canLoadMore: !paginatedData.isDone,
        };
    }, [paginatedData, allSessions, cursor]);

    // Handle load more
    const handleLoadMore = () => {
        if (paginatedData && paginatedData.continueCursor) {
            setAllSessions(sessions);
            setCursor(paginatedData.continueCursor);
        }
    };

    // Reset on filter change
    const handleFilterChange = (setter: (value: string) => void, value: string) => {
        setter(value);
        setCursor(null);
        setAllSessions([]);
    };

    // Get unique values for filters from stats
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

    const isLoading = paginatedData === undefined;
    const hasFilters = filterAgent !== "all" || filterModel !== "all" || filterStatus !== "all";

    // Loading state while initial query is loading
    if (isLoading && sessions.length === 0) {
        return (
            <SidebarInset className="flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-900 dark:border-gray-700 dark:border-t-gray-300 mx-auto"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
                </div>
            </SidebarInset>
        );
    }

    return (
        <SidebarInset className="flex flex-1 flex-col overflow-hidden bg-background">
            <header className="flex items-center justify-between border-b px-4 py-4">
                <div>
                    <h1 className="text-xl font-semibold text-foreground">Arena</h1>
                    <p className="text-sm text-muted-foreground">
                        View all crowdsourced sessions, models, and agents.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button asChild>
                        <Link href="/" prefetch={true}>New Session</Link>
                    </Button>
                </div>
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
                            <div className="grid md:grid-cols-3 gap-4 pt-2 pb-1">
                                {/* Agent Breakdown */}
                                <div className="rounded-lg border bg-card p-4">
                                    <h4 className="text-sm font-semibold mb-3">Agent Breakdown</h4>
                                    <div className="space-y-2">
                                        {Object.entries(stats.agents).map(([agent, count]) => (
                                            <div key={agent} className="flex items-center justify-between text-sm">
                                                <span className="capitalize">{agent}</span>
                                                <Badge variant="secondary">{count}</Badge>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {/* Model Breakdown */}
                                <div className="rounded-lg border bg-card p-4">
                                    <h4 className="text-sm font-semibold mb-3">Model Breakdown</h4>
                                    <div className="space-y-2 max-h-40 overflow-y-auto">
                                        {Object.entries(stats.models).map(([model, count]) => (
                                            <div key={model} className="flex items-center justify-between text-sm">
                                                <span className="font-mono text-xs truncate max-w-[180px]" title={model}>{model}</span>
                                                <Badge variant="secondary">{count}</Badge>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {/* Status Breakdown */}
                                <div className="rounded-lg border bg-card p-4">
                                    <h4 className="text-sm font-semibold mb-3">Status Breakdown</h4>
                                    <div className="space-y-2">
                                        {Object.entries(stats.statusCounts).map(([status, count]) => (
                                            <div key={status} className="flex items-center justify-between text-sm">
                                                <span className="capitalize">{status}</span>
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        status === "completed"
                                                            ? "border-emerald-500 text-emerald-600"
                                                            : status === "failed"
                                                                ? "border-red-500 text-red-600"
                                                                : status === "running"
                                                                    ? "border-sky-500 text-sky-600"
                                                                    : undefined
                                                    }
                                                >
                                                    {count as number}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                </div>
            )}

            {/* Filters */}
            <div className="flex items-center gap-3 border-b px-4 py-3 flex-wrap">
                <span className="text-sm font-medium text-muted-foreground">Filter by:</span>
                <div className="flex gap-2 flex-wrap">
                    <Select
                        value={filterAgent}
                        onValueChange={(v) => handleFilterChange(setFilterAgent, v)}
                    >
                        <SelectTrigger className="w-[160px] h-8">
                            <SelectValue placeholder="Agent" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Agents</SelectItem>
                            {uniqueAgents.map((agent) => (
                                <SelectItem key={agent} value={agent} className="capitalize">{agent}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select
                        value={filterModel}
                        onValueChange={(v) => handleFilterChange(setFilterModel, v)}
                    >
                        <SelectTrigger className="w-[180px] h-8">
                            <SelectValue placeholder="Model" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Models</SelectItem>
                            {uniqueModels.map((model) => (
                                <SelectItem key={model} value={model} className="font-mono text-xs">{model}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select
                        value={filterStatus}
                        onValueChange={(v) => handleFilterChange(setFilterStatus, v)}
                    >
                        <SelectTrigger className="w-[140px] h-8">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            {statusOptions.map((status) => (
                                <SelectItem key={status} value={status} className="capitalize">{status}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {hasFilters && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                handleFilterChange(setFilterAgent, "all");
                                handleFilterChange(setFilterModel, "all");
                                handleFilterChange(setFilterStatus, "all");
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
                            Showing <span className="font-default">{sessions?.length || 0}</span> sessions
                            {stats && <span className="text-muted-foreground"> of {stats.totalSessions} total</span>}
                        </TableCaption>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Instruction</TableHead>
                                <TableHead>Agents</TableHead>
                                <TableHead className="w-[180px]">Models</TableHead>
                                <TableHead className="w-[140px]">Created</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sessions && sessions.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4}>
                                        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                                            <p className="text-sm font-medium text-foreground">
                                                {hasFilters
                                                    ? "No sessions match the filters"
                                                    : "No sessions yet"}
                                            </p>
                                            {!hasFilters && (
                                                <>
                                                    <p className="text-sm text-muted-foreground max-w-sm">
                                                        Start a new session to see it listed here once agents finish running.
                                                    </p>
                                                    <Button asChild size="sm">
                                                        <Link href="/" prefetch={true}>Create session</Link>
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}

                            {sessions &&
                                sessions.map((session: SessionRow) => (
                                    <SessionRowComponent
                                        key={session._id}
                                        session={session}
                                        filterAgent={filterAgent === "all" ? undefined : filterAgent}
                                        filterModel={filterModel === "all" ? undefined : filterModel}
                                        filterStatus={filterStatus === "all" ? undefined : filterStatus}
                                        formatDate={formatDate}
                                    />
                                ))}
                        </TableBody>
                    </Table>

                    {/* Load More Button */}
                    {canLoadMore && (
                        <div className="flex justify-center py-4 border-t">
                            <Button
                                variant="outline"
                                onClick={handleLoadMore}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="size-4 animate-spin mr-2" />
                                        Loading...
                                    </>
                                ) : (
                                    "Load More Sessions"
                                )}
                            </Button>
                        </div>
                    )}

                    {isDoneLoading && sessions.length > 0 && (
                        <div className="flex justify-center py-4 border-t text-sm text-muted-foreground">
                            All sessions loaded
                        </div>
                    )}
                </div>
            </div>
        </SidebarInset>
    );
}

// Session row with 2-step loading - agents are fetched separately
function SessionRowComponent({
    session,
    filterAgent,
    filterModel,
    filterStatus,
    formatDate,
}: {
    session: SessionRow;
    filterAgent?: string;
    filterModel?: string;
    filterStatus?: string;
    formatDate: (timestamp: number) => string;
}) {
    // Fetch agents for this session (2-step loading)
    const agents = useQuery(api.queries.getSessionAgents, {
        sessionId: session._id,
    });

    // Apply filters to agents
    const filteredAgents = useMemo(() => {
        if (!agents) return [];
        let result = agents;
        if (filterAgent) {
            result = result.filter((a) => a.name === filterAgent);
        }
        if (filterModel) {
            result = result.filter((a) => a.model === filterModel);
        }
        if (filterStatus) {
            result = result.filter((a) => a.status === filterStatus);
        }
        return result;
    }, [agents, filterAgent, filterModel, filterStatus]);

    // If filters active and no matching agents, don't render row
    const hasFilters = filterAgent || filterModel || filterStatus;
    if (hasFilters && agents !== undefined && filteredAgents.length === 0) {
        return null;
    }

    const modelsUsed: string[] = agents
        ? Array.from(
            new Set(
                (hasFilters ? filteredAgents : agents)
                    .map((agent) => agent.model)
                    .filter((model): model is string => Boolean(model))
            )
        )
        : [];

    return (
        <TableRow>
            <TableCell className="max-w-xl">
                <Link
                    href={`/session/${session._id}`}
                    prefetch={true}
                    className="text-foreground hover:text-primary transition-colors"
                >
                    <div className="truncate font-default">{session.instruction}</div>
                </Link>
            </TableCell>
            <TableCell>
                <SessionAgentsDisplay agents={hasFilters ? filteredAgents : agents} />
            </TableCell>
            <TableCell className="max-w-[180px]">
                <div className="flex flex-wrap gap-1">
                    {agents === undefined ? (
                        <span className="text-xs text-muted-foreground">Loading...</span>
                    ) : modelsUsed.length > 0 ? (
                        <>
                            {modelsUsed.slice(0, 2).map((model: string) => (
                                <Badge
                                    key={model}
                                    variant="secondary"
                                    className="text-xs font-mono max-w-[140px] truncate"
                                    title={model}
                                >
                                    {model.length > 20 ? model.slice(0, 18) + "..." : model}
                                </Badge>
                            ))}
                            {modelsUsed.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                    +{modelsUsed.length - 2}
                                </Badge>
                            )}
                        </>
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
}

function SessionAgentsDisplay({
    agents,
}: {
    agents?: Array<{
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

    if (agents === undefined) {
        return <span className="text-xs text-muted-foreground">Loading...</span>;
    }

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
                    {(agent.name === "browser-use" || agent.name === "browser_use" || agent.name === "browser-use-cloud") && (
                        <BrowserUseLogo className="h-3 w-3" />
                    )}
                    {agent.name === "smooth" && (
                        <SmoothLogo className="h-3 w-3" />
                    )}
                    {agent.name === "stagehand" && (
                        <StagehandLogo className="h-3 w-3" />
                    )}
                    {agent.name === "claude-code" && (
                        <ClaudeLogo className="h-3 w-3" />
                    )}
                    {agent.name === "codex" && (
                        <OpenAI className="h-3 w-3" />
                    )}
                    {agent.name === "playwright-mcp" && (
                        <PlaywrightLogo className="h-3 w-3" />
                    )}
                    {agent.name === "chrome-devtools-mcp" && (
                        <ChromeDevtoolsLogo className="h-3 w-3" />
                    )}
                    {Object.hasOwn(AGENT_LABELS, agent.name) ? AGENT_LABELS[agent.name as keyof typeof AGENT_LABELS] : agent.name}
                </Badge>
            ))}
        </div>
    );
}
