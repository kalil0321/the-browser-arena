"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ChatInterface() {
    const [prompt, setPrompt] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!prompt.trim() || isSubmitting) return;

        setIsSubmitting(true);

        try {
            const response = await fetch("/api/session", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ prompt: prompt.trim() }),
            });

            if (!response.ok) {
                throw new Error("Failed to create session");
            }

            const data = await response.json();
            router.push(`/session/${data.sessionId}`);
        } catch (error) {
            console.error("Failed to create session:", error);
            setIsSubmitting(false);
            alert("Failed to create session. Please try again.");
        }
    };

    return (
        <div className="flex h-full flex-col">
            {/* Main content */}
            <div className="flex flex-1 items-center justify-center p-8 md:p-12">
                <div className="w-full max-w-3xl space-y-10">
                    {/* Header */}
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 rounded-md border bg-muted px-3 py-1">
                            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                            <span className="text-sm font-medium text-muted-foreground">
                                2 agents ready
                            </span>
                        </div>
                        <h1 className="text-5xl font-bold tracking-tight md:text-6xl">
                            Agent Arena
                        </h1>
                        <p className="max-w-xl text-lg text-muted-foreground">
                            Compare AI browser agents side by side. See which one completes
                            your task better.
                        </p>
                    </div>

                    {/* Example tasks */}
                    <div className="grid gap-3 sm:grid-cols-2">
                        {examplePrompts.map((example, idx) => (
                            <button
                                key={idx}
                                onClick={() => setPrompt(example.prompt)}
                                className="group rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent"
                            >
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                        <span className="text-base">{example.icon}</span>
                                        <span>{example.category}</span>
                                    </div>
                                    <p className="text-sm leading-relaxed text-foreground">
                                        {example.prompt}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Input area */}
            <div className="border-t bg-background/95 p-6 backdrop-blur supports-backdrop-filter:bg-background/60">
                <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
                    <div className="flex gap-3">
                        <div className="relative flex-1">
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSubmit(e);
                                    }
                                }}
                                placeholder="Describe a task for the agents to complete..."
                                className="min-h-[56px] w-full resize-none rounded-lg border bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                rows={1}
                                disabled={isSubmitting}
                            />
                            {prompt.length > 0 && (
                                <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                                    {prompt.length}
                                </div>
                            )}
                        </div>
                        <Button
                            type="submit"
                            disabled={!prompt.trim() || isSubmitting}
                            size="lg"
                            className="px-8"
                        >
                            {isSubmitting ? (
                                <>
                                    <svg
                                        className="mr-2 h-4 w-4 animate-spin"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        />
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        />
                                    </svg>
                                    <span className="hidden sm:inline">Starting...</span>
                                </>
                            ) : (
                                <>
                                    <span className="hidden sm:inline">Start Arena</span>
                                    <svg
                                        className="ml-2 h-4 w-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M14 5l7 7m0 0l-7 7m7-7H3"
                                        />
                                    </svg>
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

const examplePrompts = [
    {
        category: "Research",
        icon: "🔍",
        prompt: "Find the 3 most popular AI coding tools launched this month",
    },
    {
        category: "Web Scraping",
        icon: "🌐",
        prompt: "Get the top 5 posts from Hacker News and summarize them",
    },
    {
        category: "Data",
        icon: "📊",
        prompt: "Compare pricing for the top 3 cloud hosting providers",
    },
    {
        category: "Shopping",
        icon: "🛍️",
        prompt: "Find the best-rated mechanical keyboards under $150",
    },
];

