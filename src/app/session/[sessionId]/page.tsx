"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { SidebarInset } from "@/components/ui/sidebar";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { AgentPanel } from "@/components/agent-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BrowserUseLogo } from "@/components/logos/bu";
import { SmoothLogo } from "@/components/logos/smooth";
import { StagehandLogo } from "@/components/logos/stagehand";
import { Copy, Check } from "lucide-react";

export default function SessionPage() {
    const params = useParams();
    const sessionId = params.sessionId as string;
    const sessionIdConvex = sessionId as any;

    // View mode state: "grid" or "tabs"
    const [viewMode, setViewMode] = useState<"grid" | "tabs">("grid");

    // Copy state
    const [isCopied, setIsCopied] = useState(false);

    // Query session and agents (works for both authenticated and unauthenticated users for public sessions)
    const session = useQuery(api.queries.getSession, { sessionId: sessionIdConvex });
    const agents = useQuery(api.queries.getSessionAgents, { sessionId: sessionIdConvex });

    // Loading state while queries are loading
    if (session === undefined || agents === undefined) {
        return (
            <SidebarInset className="flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-900 dark:border-gray-700 dark:border-t-gray-300 mx-auto"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
                </div>
            </SidebarInset>
        );
    }

    // Session not found or not accessible (private session or doesn't exist)
    if (session === null) {
        return (
            <SidebarInset className="flex items-center justify-center">
                <div className="text-center max-w-md">
                    <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        Session Not Found
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        This session doesn't exist or you don't have access to it. It may be private or belong to another user.
                    </p>
                    <Button asChild>
                        <Link href="/">Go to Home</Link>
                    </Button>
                </div>
            </SidebarInset>
        );
    }

    // At this point, session must be defined (TypeScript assertion)
    if (!session) {
        return null;
    }

    // Determine grid layout based on number of agents
    const getGridCols = () => {
        if (!agents || agents.length === 0) return "grid-cols-1";
        if (agents.length === 1) return "grid-cols-1";
        if (agents.length === 2) return "grid-cols-1 md:grid-cols-2";
        if (agents.length === 3) return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
        if (agents.length === 4) return "grid-cols-1 sm:grid-cols-2"; // 2x2 grid for 4 agents
        return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"; // 5+ agents use 2 columns on small, 3 on large
    };

    // Show view mode toggle only when there are multiple agents
    const showViewToggle = agents && agents.length > 1;

    const handleCopyInstruction = () => {
        if (session?.instruction) {
            navigator.clipboard.writeText(session.instruction);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }
    };

    return (
        <SidebarInset className="flex flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-black">
            {/* Header */}
            <div className="border-b border-gray-200 dark:border-card/20 px-3 py-3 sm:px-4 sm:py-4 shrink-0">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <div className="flex items-start gap-2 group">
                            <h1 className="text-base sm:text-lg font-default font-medium text-gray-900 dark:text-gray-100 break-words flex-1" title={session.instruction}>
                                {session.instruction && session.instruction.length > 100
                                    ? session.instruction.substring(0, 100) + '...'
                                    : session.instruction}
                            </h1>
                            <button
                                onClick={handleCopyInstruction}
                                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                                title={isCopied ? "Copied!" : "Copy instruction"}
                            >
                                {isCopied ? (
                                    <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                                ) : (
                                    <Copy className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                )}
                            </button>
                        </div>
                        <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">
                            Created {new Date(session.createdAt).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                        {agents && agents.length > 0 && (
                            <div className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                {agents.filter(a => a.status === "completed").length} / {agents.length} completed
                            </div>
                        )}
                        {showViewToggle && (
                            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 sm:p-1">
                                <Button
                                    variant={viewMode === "grid" ? "default" : "ghost"}
                                    size="sm"
                                    onClick={() => setViewMode("grid")}
                                    className="h-8 sm:h-7 px-2 sm:px-3 text-[11px] sm:text-xs dark:text-white dark:hover:text-white text-black hover:text-black touch-manipulation"
                                >
                                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-0.5 sm:mr-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                                    </svg>
                                    <span className="hidden sm:inline">Grid</span>
                                </Button>
                                <Button
                                    variant={viewMode === "tabs" ? "default" : "ghost"}
                                    size="sm"
                                    onClick={() => setViewMode("tabs")}
                                    className="h-8 sm:h-7 px-2 sm:px-3 text-[11px] sm:text-xs dark:text-white dark:hover:text-white text-black hover:text-black touch-manipulation"
                                >
                                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-0.5 sm:mr-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    <span className="hidden sm:inline">Tabs</span>
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto">
                {viewMode === "grid" ? (
                    // Grid View
                    <div className="h-full">
                        <div className={`grid ${getGridCols()} h-full`}>
                            {agents && agents.length > 0 ? (
                                agents.map((agent) => (
                                    <div key={agent._id} className="min-h-[400px]">
                                        <AgentPanel agent={agent} />
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-full">
                                    <AgentPanel agent={null} />
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    // Tabs View
                    <div className="h-full">
                        {agents && agents.length > 0 ? (
                            <Tabs defaultValue={agents[0]._id} className="h-full flex flex-col gap-0">
                                <TabsList className="w-full justify-start rounded-none border-b border-gray-200 dark:border-gray-800 dark:bg-black px-2 sm:px-4 shrink-0 overflow-x-auto">
                                    {agents.map((agent) => (
                                        <TabsTrigger key={agent._id} value={agent._id} className="capitalize text-white data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:text-white data-[state=active]:underline h-10 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm touch-manipulation shrink-0">
                                            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                                                {(agent.name === "browser-use" || agent.name === "browser_use" || agent.name === "browser-use-cloud") && (
                                                    <BrowserUseLogo className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                                                )}
                                                {agent.name === "smooth" && (
                                                    <SmoothLogo className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                                                )}
                                                {agent.name === "stagehand" && (
                                                    <StagehandLogo className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                                                )}
                                                <span className="data-[state=active]:border-current transition-colors truncate max-w-[100px] sm:max-w-[120px]" title={agent.name}>
                                                    {agent.name === "browser-use-cloud" ? "BU Cloud" :
                                                        agent.name}
                                                </span>
                                                {agent.status === "completed" && (
                                                    <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                                {agent.status === "failed" && (
                                                    <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                )}
                                                {agent.status === "running" && (
                                                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                                                )}
                                            </div>
                                        </TabsTrigger>
                                    ))}
                                </TabsList>
                                {agents.map((agent) => (
                                    <TabsContent key={agent._id} value={agent._id} className="flex-1 m-0">
                                        <div className="h-full">
                                            <AgentPanel agent={agent} />
                                        </div>
                                    </TabsContent>
                                ))}
                            </Tabs>
                        ) : (
                            <div className="p-4">
                                <AgentPanel agent={null} />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </SidebarInset>
    );
}
