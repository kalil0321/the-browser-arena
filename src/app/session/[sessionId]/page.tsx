"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SidebarInset } from "@/components/ui/sidebar";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { AgentPanel } from "@/components/agent-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

export default function SessionPage() {
    const params = useParams();
    const router = useRouter();
    const sessionId = params.sessionId as string;
    const sessionIdConvex = sessionId as any;

    // View mode state: "grid" or "tabs"
    const [viewMode, setViewMode] = useState<"grid" | "tabs">("grid");

    const session = useQuery(api.queries.getSession, {
        sessionId: sessionIdConvex
    });

    const agents = useQuery(api.queries.getSessionAgents, {
        sessionId: sessionIdConvex
    });

    useEffect(() => {
        if (session === null && session !== undefined) {
            setTimeout(() => {
                router.push("/");
            }, 2000);
        }
    }, [session, router]);

    if (session === undefined) {
        return (
            <SidebarInset className="flex items-center justify-center bg-white dark:bg-gray-950">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-900 dark:border-gray-700 dark:border-t-gray-300 mx-auto"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
                </div>
            </SidebarInset>
        );
    }

    if (session === null) {
        return (
            <SidebarInset className="flex items-center justify-center bg-white dark:bg-gray-950">
                <div className="text-center">
                    <p className="text-gray-900 dark:text-gray-100 mb-2">Session not found</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Redirecting...</p>
                </div>
            </SidebarInset>
        );
    }

    // Determine grid layout based on number of agents
    const getGridCols = () => {
        if (!agents || agents.length === 0) return "grid-cols-1";
        if (agents.length === 1) return "grid-cols-1";
        if (agents.length === 2) return "grid-cols-1 lg:grid-cols-2";
        if (agents.length === 3) return "grid-cols-1 lg:grid-cols-3";
        return "grid-cols-1 lg:grid-cols-3"; // 4+ agents still use 3 columns
    };

    // Show view mode toggle only when there are multiple agents
    const showViewToggle = agents && agents.length > 1;

    return (
        <SidebarInset className="flex flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
            {/* Header */}
            <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-4 shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-lg font-default font-medium text-gray-900 dark:text-gray-100">
                            {session.instruction}
                        </h1>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Created {new Date(session.createdAt).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        {agents && agents.length > 0 && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                {agents.filter(a => a.status === "completed").length} / {agents.length} completed
                            </div>
                        )}
                        {showViewToggle && (
                            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                                <Button
                                    variant={viewMode === "grid" ? "default" : "ghost"}
                                    size="sm"
                                    onClick={() => setViewMode("grid")}
                                    className="h-7 px-3 text-xs dark:text-white dark:hover:text-white text-black hover:text-black"
                                >
                                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                                    </svg>
                                    Grid
                                </Button>
                                <Button
                                    variant={viewMode === "tabs" ? "default" : "ghost"}
                                    size="sm"
                                    onClick={() => setViewMode("tabs")}
                                    className="h-7 px-3 text-xs dark:text-white dark:hover:text-white text-black hover:text-black"
                                >
                                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    Tabs
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
                                <TabsList className="w-full justify-start rounded-none border-b border-gray-200 dark:border-gray-800 dark:bg-gray-900 px-4 shrink-0">
                                    {agents.map((agent) => (
                                        <TabsTrigger key={agent._id} value={agent._id} className="capitalize text-white data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:text-white data-[state=active]:underline">
                                            <div className="flex items-center gap-2">
                                                <span className="data-[state=active]:border-current transition-colors">{agent.name}</span>
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
