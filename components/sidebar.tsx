"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function Sidebar() {
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <aside
            className={`flex h-screen flex-col border-r bg-muted/40 transition-all duration-300 ${isCollapsed ? "w-16" : "w-64"
                }`}
        >
            {/* Header */}
            <div className="flex items-center gap-3 p-4">
                {!isCollapsed && (
                    <Link href="/" className="group flex flex-1 items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
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
                                    d="M13 10V3L4 14h7v7l9-11h-7z"
                                />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <div className="font-semibold leading-none">Arena</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                                Agent battles
                            </div>
                        </div>
                    </Link>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                >
                    <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        {isCollapsed ? (
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                            />
                        ) : (
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 19l-7-7 7-7"
                            />
                        )}
                    </svg>
                </Button>
            </div>

            <Separator />

            {/* New Battle Button */}
            <div className="p-3">
                <Button
                    asChild
                    className="w-full"
                    size={isCollapsed ? "icon" : "default"}
                >
                    <Link href="/">
                        {!isCollapsed ? (
                            <>
                                <svg
                                    className="mr-2 h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 4v16m8-8H4"
                                    />
                                </svg>
                                New Battle
                            </>
                        ) : (
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
                                    d="M12 4v16m8-8H4"
                                />
                            </svg>
                        )}
                    </Link>
                </Button>
            </div>

            {/* Session History */}
            <div className="flex-1 overflow-y-auto px-3">
                {!isCollapsed && (
                    <div className="mb-2 px-2 text-xs font-medium text-muted-foreground">
                        Recent
                    </div>
                )}
                <div className="space-y-1">
                    {/* Placeholder */}
                    <div className="rounded-md p-3 text-center text-sm text-muted-foreground">
                        {isCollapsed ? (
                            <div className="flex justify-center">
                                <div className="h-2 w-2 rounded-full bg-muted-foreground/20" />
                            </div>
                        ) : (
                            <p>No battles yet</p>
                        )}
                    </div>
                </div>
            </div>

            <Separator />

            {/* Footer */}
            <div className="p-3">
                <div className="flex items-center gap-2 rounded-md bg-muted p-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-background">
                        <svg
                            className="h-4 w-4 text-muted-foreground"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                        </svg>
                    </div>
                    {!isCollapsed && (
                        <div className="flex-1 overflow-hidden">
                            <p className="truncate text-sm font-medium">Guest</p>
                            <p className="text-xs text-muted-foreground">Anonymous</p>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
}
