import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface SessionPageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function SessionPage({ params }: SessionPageProps) {
    const { id } = await params;

    if (!id || id.length < 3) {
        notFound();
    }

    return (
        <div className="flex h-screen flex-col">
            {/* Header */}
            <header className="flex items-center justify-between border-b bg-background/95 px-6 py-3 backdrop-blur supports-backdrop-filter:bg-background/60">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/">
                            <svg
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 19l-7-7 7-7"
                                />
                            </svg>
                        </Link>
                    </Button>
                    <div>
                        <h1 className="font-semibold">Battle Session</h1>
                        <p className="text-xs text-muted-foreground">
                            {id.slice(0, 8)}...
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="inline-flex items-center gap-2 rounded-md border bg-muted px-3 py-1">
                        <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                        <span className="text-xs font-medium">Live</span>
                    </div>
                </div>
            </header>

            {/* Split view */}
            <div className="grid flex-1 overflow-hidden lg:grid-cols-2">
                {/* Agent 1 */}
                <div className="flex flex-col border-r">
                    {/* Agent header */}
                    <div className="border-b bg-muted/50 p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-md border bg-background">
                                    <span className="text-sm font-semibold">A</span>
                                </div>
                                <div>
                                    <h2 className="font-medium">Agent Alpha</h2>
                                    <p className="text-xs text-muted-foreground">GPT-4</p>
                                </div>
                            </div>
                            <div className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
                                Running
                            </div>
                        </div>
                    </div>

                    {/* Agent workspace */}
                    <div className="flex flex-1 items-center justify-center bg-muted/20 p-8">
                        <div className="text-center">
                            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-lg border bg-background">
                                <svg
                                    className="h-8 w-8 animate-spin text-muted-foreground"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="3"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    />
                                </svg>
                            </div>
                            <p className="font-medium">Initializing...</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Agent is starting the task
                            </p>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 border-t bg-muted/30">
                        <div className="border-r p-3 text-center">
                            <div className="text-xs text-muted-foreground">Time</div>
                            <div className="mt-1 font-mono text-sm font-semibold">0.0s</div>
                        </div>
                        <div className="border-r p-3 text-center">
                            <div className="text-xs text-muted-foreground">Steps</div>
                            <div className="mt-1 font-mono text-sm font-semibold">0</div>
                        </div>
                        <div className="p-3 text-center">
                            <div className="text-xs text-muted-foreground">Progress</div>
                            <div className="mt-1 font-mono text-sm font-semibold">0%</div>
                        </div>
                    </div>
                </div>

                {/* Agent 2 */}
                <div className="flex flex-col">
                    {/* Agent header */}
                    <div className="border-b bg-muted/50 p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-md border bg-background">
                                    <span className="text-sm font-semibold">B</span>
                                </div>
                                <div>
                                    <h2 className="font-medium">Agent Beta</h2>
                                    <p className="text-xs text-muted-foreground">Claude</p>
                                </div>
                            </div>
                            <div className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
                                Running
                            </div>
                        </div>
                    </div>

                    {/* Agent workspace */}
                    <div className="flex flex-1 items-center justify-center bg-muted/20 p-8">
                        <div className="text-center">
                            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-lg border bg-background">
                                <svg
                                    className="h-8 w-8 animate-spin text-muted-foreground"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="3"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    />
                                </svg>
                            </div>
                            <p className="font-medium">Initializing...</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Agent is starting the task
                            </p>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 border-t bg-muted/30">
                        <div className="border-r p-3 text-center">
                            <div className="text-xs text-muted-foreground">Time</div>
                            <div className="mt-1 font-mono text-sm font-semibold">0.0s</div>
                        </div>
                        <div className="border-r p-3 text-center">
                            <div className="text-xs text-muted-foreground">Steps</div>
                            <div className="mt-1 font-mono text-sm font-semibold">0</div>
                        </div>
                        <div className="p-3 text-center">
                            <div className="text-xs text-muted-foreground">Progress</div>
                            <div className="mt-1 font-mono text-sm font-semibold">0%</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Task description */}
            <div className="border-t bg-muted/30 p-4">
                <div className="mx-auto max-w-4xl">
                    <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-md border bg-background">
                            <svg
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                                />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm font-medium">Task</h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                                The task prompt will appear here once connected to the agent
                                API.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
