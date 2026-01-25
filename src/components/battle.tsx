"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SidebarInset } from "@/components/ui/sidebar";
import { GitHubStarButton } from "@/components/github-star-button";
import { IconFull } from "@/components/logo";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { ModeToggle } from "@/components/mode-toggle";

export function Battle() {
    const router = useRouter();
    const [instruction, setInstruction] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [instruction]);

    const handleStartBattle = async () => {
        if (!instruction.trim()) {
            toast.error("Please enter an instruction");
            return;
        }

        setIsCreating(true);

        try {
            const response = await fetch("/api/battle/create", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ instruction }),
            });

            if (!response.ok) {
                const data = await response.json();
                // Error message is nested under error.message in the response
                const errorMessage = data.error?.message || data.message || "Failed to create battle";
                throw new Error(errorMessage);
            }

            const data = await response.json();
            console.log("Battle created:", data);

            // Redirect to battle page
            router.push(`/battle/${data.battleId}`);
        } catch (err) {
            console.error("Battle creation error:", err);
            toast.error(err instanceof Error ? err.message : "Failed to create battle");
            setIsCreating(false);
        }
    };

    return (
        <SidebarInset className="flex flex-1 flex-col items-center justify-center overflow-hidden">
            <div className="absolute inset-0 bg-[url('/bg.jpeg')] bg-cover bg-center will-change-transform" />
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />

            {/* Mode Toggle - Top Left */}
            <div className="absolute top-4 left-4 z-20 sm:top-6 sm:left-6">
                <ModeToggle />
            </div>

            {/* GitHub Star Button - Top Right */}
            <div className="absolute top-4 right-4 z-20 sm:top-6 sm:right-6">
                <GitHubStarButton />
            </div>

            <div className="relative z-10 flex w-full max-w-4xl flex-col items-center px-4 text-center sm:px-6 md:px-12">
                {/* Main content area - centered vertically */}
                <div className="flex w-full flex-col items-center gap-3 py-4 sm:py-6">
                    <div className="w-[120px] sm:w-[140px] md:w-[160px] mb-2">
                        <IconFull dark={false} width={120} height={75} className="w-full h-auto" />
                    </div>

                    <div className="w-full max-w-2xl flex flex-col items-center">
                        {/* Input - centered */}
                        <div className="container mx-auto max-w-3xl px-3 sm:px-4 font-mono text-white w-full">
                            <div className="bg-background rounded-4xl w-full space-y-2 px-3 py-3 sm:px-4 sm:py-4 relative">
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        handleStartBattle();
                                    }}
                                    className="relative mx-auto overflow-visible mb-2 min-h-16 w-full max-w-full bg-background shadow-none"
                                >
                                    <textarea
                                        ref={textareaRef}
                                        placeholder="Automate your tasks..."
                                        className={cn(
                                            "sm:text font-default relative z-0 w-full border-none bg-background pr-20 sm:pr-28 text-sm tracking-tight text-primary focus:outline-none focus:ring-0 dark:text-white resize-none overflow-hidden min-h-16 py-3",
                                        )}
                                        value={instruction}
                                        onChange={(e) => setInstruction(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleStartBattle();
                                            }
                                        }}
                                        rows={1}
                                        disabled={isCreating}
                                    />
                                    <div className="absolute right-1 sm:right-0 top-2.5 sm:top-3 flex items-center gap-1.5 sm:gap-1 z-20 pointer-events-auto">
                                        <button
                                            type="submit"
                                            disabled={!instruction.trim() || isCreating}
                                            className="flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-black text-white border border-black/10 dark:border-white/10 shadow-sm transition-transform duration-150 hover:scale-[1.03] hover:bg-black/90 disabled:bg-gray-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:disabled:bg-zinc-800"
                                        >
                                            {isCreating ? (
                                                <Loader2 className="h-4 w-4 animate-spin text-white dark:text-gray-200" />
                                            ) : (
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    width="24"
                                                    height="24"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    className="h-4 w-4 text-white dark:text-gray-200"
                                                >
                                                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                                    <path d="M5 12l14 0" strokeDasharray="50%" strokeDashoffset="50%" />
                                                    <path d="M13 18l6 -6" />
                                                    <path d="M13 6l6 6" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>

                        {/* Info icon and Leaderboard link - positioned above input */}
                        <div className="flex items-center mt-4 gap-2 w-full max-w-3xl px-3 sm:px-4 mb-3">
                            <Dialog open={isInfoOpen} onOpenChange={setIsInfoOpen}>
                                <DialogTrigger asChild>
                                    <Info className="h-4 w-4 text-zinc-700 dark:text-zinc-200" />
                                </DialogTrigger>
                                <DialogContent className="max-w-md">
                                    <DialogHeader>
                                        <DialogTitle>How it works</DialogTitle>
                                    </DialogHeader>
                                    <ol className="space-y-2 text-sm text-muted-foreground mt-4">
                                        <li className="flex gap-2">
                                            <span className="font-bold text-foreground">1.</span>
                                            <span>Enter a task for the agents to complete</span>
                                        </li>
                                        <li className="flex gap-2">
                                            <span className="font-bold text-foreground">2.</span>
                                            <span>Two agents with similar ELO ratings are automatically matched</span>
                                        </li>
                                        <li className="flex gap-2">
                                            <span className="font-bold text-foreground">3.</span>
                                            <span>Watch them compete (identities hidden to prevent bias)</span>
                                        </li>
                                        <li className="flex gap-2">
                                            <span className="font-bold text-foreground">4.</span>
                                            <span>Vote for the better performer after both complete</span>
                                        </li>
                                        <li className="flex gap-2">
                                            <span className="font-bold text-foreground">5.</span>
                                            <span>ELO ratings update based on your vote</span>
                                        </li>
                                    </ol>
                                </DialogContent>
                            </Dialog>

                            <a
                                href="/leaderboard"
                                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                                View Leaderboard →
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </SidebarInset>
    );
}