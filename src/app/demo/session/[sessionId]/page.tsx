import { SidebarInset } from "@/components/ui/sidebar";
import { AgentPanel } from "@/components/agent-panel";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getDemoSession, getDemoSessionAgents } from "./actions";

export default async function DemoSessionPage({
    params,
}: {
    params: Promise<{ sessionId: string }> | { sessionId: string };
}) {
    // Handle both sync and async params (Next.js 15+ uses Promise)
    const resolvedParams = params instanceof Promise ? await params : params;
    const sessionId = resolvedParams?.sessionId;

    // Validate sessionId
    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
        console.error("Invalid sessionId in DemoSessionPage:", { sessionId, params: resolvedParams });
        return (
            <SidebarInset className="flex items-center justify-center">
                <div className="text-center max-w-md">
                    <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        Invalid Session ID
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        The session ID provided is invalid. Please check the URL.
                    </p>
                    <Button asChild>
                        <Link href="/">Go to Home</Link>
                    </Button>
                </div>
            </SidebarInset>
        );
    }

    // Fetch data using server actions (no auth required)
    const [sessionResult, agentsResult] = await Promise.all([
        getDemoSession(sessionId.trim()),
        getDemoSessionAgents(sessionId.trim()),
    ]);

    // Handle errors
    if (!sessionResult.success) {
        return (
            <SidebarInset className="flex items-center justify-center">
                <div className="text-center max-w-md">
                    <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        Error Loading Session
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        {sessionResult.error || "Failed to load demo session"}
                    </p>
                    <Button asChild>
                        <Link href="/">Go to Home</Link>
                    </Button>
                </div>
            </SidebarInset>
        );
    }

    const session = sessionResult.data;
    const agents = agentsResult.success ? agentsResult.data : [];

    // Session not found
    if (!session) {
        return (
            <SidebarInset className="flex items-center justify-center">
                <div className="text-center max-w-md">
                    <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        Demo Session Not Found
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        This demo session doesn't exist or has been deleted. This page is for demo sessions only. If you're looking for an authenticated session, please log in.
                    </p>
                    <div className="flex gap-2 justify-center">
                        <Button asChild>
                            <Link href="/">Go to Home</Link>
                        </Button>
                        <Button asChild variant="outline">
                            <Link href="/demo/sessions">View Demo Sessions</Link>
                        </Button>
                    </div>
                </div>
            </SidebarInset>
        );
    }

    // Get the first (and only) agent for demo sessions
    const agent = agents && agents.length > 0 ? agents[0] : null;

    return (
        <SidebarInset className="flex flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-black">
            {/* Header */}
            <div className="border-b border-gray-200 dark:border-card/20 px-4 py-4 shrink-0">
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
            </div>

            {/* Content - Single Agent */}
            <div className="flex-1 overflow-auto h-full">
                <AgentPanel agent={agent} />
            </div>
        </SidebarInset>
    );
}

