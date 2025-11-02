"use client";

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarTrigger,
    useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { IconFull, IconSmall } from "./logo";
import { UserInfo } from "./user-info";
import { SessionsNav, type Session } from "./nav-sessions";
import { ThemeSwitcher } from "./theme-switcher";
import { HelpButton } from "./help-button";
import { SettingsButton } from "@/components/settings-button";
import { Separator } from "@/components/ui/separator";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Trophy, Map, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useTheme } from "next-themes";
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { getClientFingerprint } from "@/lib/fingerprint";

const teams = [
    { id: "1", name: "Alpha Inc.", logo: IconSmall, plan: "Free" },
    { id: "2", name: "Beta Corp.", logo: IconSmall, plan: "Free" },
    { id: "3", name: "Gamma Tech", logo: IconSmall, plan: "Free" },
];

export function DashboardSidebar() {
    const { state } = useSidebar();
    const isCollapsed = state === "collapsed";
    const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
    const [localStorageSessions, setLocalStorageSessions] = useState<Session[]>([]);
    const [clientFingerprint, setClientFingerprint] = useState<string | null>(null);

    // Get authenticated user sessions
    const authSessions = useQuery(api.queries.getUserSessions, isAuthenticated ? {} : "skip");

    // Get demo sessions from DB
    const dbDemoSessions = useQuery(
        api.queries.getDemoUserSessions,
        !isAuthenticated && clientFingerprint ? { clientFingerprint } : "skip"
    );

    // Function to load sessions from localStorage
    const loadLocalStorageSessions = useCallback(() => {
        try {
            const stored = localStorage.getItem("demo_sessions");
            if (stored) {
                const parsed = JSON.parse(stored);
                setLocalStorageSessions(parsed);
            } else {
                setLocalStorageSessions([]);
            }
        } catch (error) {
            console.error("Failed to load sessions from localStorage:", error);
            setLocalStorageSessions([]);
        }
    }, []);

    // Function to sync sessions from DB to localStorage
    const syncFromDatabase = useCallback(async () => {
        try {
            // Generate fingerprint if not available
            let fingerprint = clientFingerprint;
            if (!fingerprint) {
                fingerprint = await getClientFingerprint();
                setClientFingerprint(fingerprint);
            }

            // Wait for dbDemoSessions to be available if not already
            if (dbDemoSessions === undefined) {
                return;
            }

            if (dbDemoSessions && dbDemoSessions.length > 0) {
                setLocalStorageSessions(dbDemoSessions);
                // Store in localStorage
                localStorage.setItem("demo_sessions", JSON.stringify(dbDemoSessions));
            } else {
                // Load from localStorage as fallback
                loadLocalStorageSessions();
            }
        } catch (error) {
            console.error("Failed to sync from database:", error);
            // Fallback to localStorage
            loadLocalStorageSessions();
        }
    }, [clientFingerprint, dbDemoSessions, loadLocalStorageSessions]);

    // Generate fingerprint for unauthenticated users
    useEffect(() => {
        if (!isAuthLoading && !isAuthenticated) {
            const generateFingerprint = async () => {
                try {
                    const fingerprint = await getClientFingerprint();
                    setClientFingerprint(fingerprint);
                } catch (error) {
                    console.error("Failed to generate fingerprint:", error);
                }
            };
            generateFingerprint();
        }
    }, [isAuthLoading, isAuthenticated]);

    // Load sessions from localStorage on mount and when not authenticated
    useEffect(() => {
        if (!isAuthenticated) {
            loadLocalStorageSessions();
        }
    }, [isAuthenticated, loadLocalStorageSessions]);

    // Use authenticated sessions if logged in, otherwise use localStorage sessions
    const sessions = isAuthenticated ? authSessions : localStorageSessions;

    const { resolvedTheme } = useTheme();
    const [isProTheme, setIsProTheme] = useState(() => {
        // Initialize from DOM on mount
        try {
            return typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "pro";
        } catch {
            return false;
        }
    });

    useEffect(() => {
        const apply = () => {
            try {
                const isPro = document.documentElement.getAttribute("data-theme") === "pro";
                setIsProTheme(prev => prev !== isPro ? isPro : prev);
            } catch {
                setIsProTheme(false);
            }
        };
        apply();
        const onStorage = (e: StorageEvent) => {
            if (e.key === "appTheme") apply();
        };
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, []);

    const useWhiteLogo = isProTheme ? resolvedTheme === "dark" : true;

    return (
        <Sidebar variant="inset" collapsible="offcanvas">
            {/* Header - Logo */}
            <SidebarHeader
                className={cn(
                    "flex md:pt-3.5",
                    isCollapsed
                        ? "flex-row items-center justify-between gap-y-4 md:flex-col md:items-start md:justify-start"
                        : "flex-row items-center justify-between"
                )}
            >
                <div className="flex items-center justify-between gap-2 w-full">
                    <Link href="/" prefetch className="flex items-center gap-2">
                        <IconFull dark={!useWhiteLogo} width={80} height={60} />
                    </Link>
                    <motion.div
                        key={isCollapsed ? "header-collapsed" : "header-expanded"}
                        className={cn(
                            "flex items-center gap-2",
                            isCollapsed ? "flex-row md:flex-col-reverse" : "flex-row"
                        )}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.8 }}
                    >
                        <SidebarTrigger />
                    </motion.div>
                </div>
            </SidebarHeader>



            {/* Content - Arena & Sessions */}
            <SidebarContent className="flex flex-col gap-4 px-0 flex-1 overflow-y-auto">
                {/* Arena Link */}
                <div className="px-2">
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton tooltip="Arena" asChild>
                                <Link
                                    href="/arena"
                                    prefetch={true}
                                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-sidebar-muted hover:text-foreground transition-colors"
                                >
                                    <Trophy className="size-4" />
                                    {!isCollapsed && <span>Arena</span>}
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </div>

                {/* Roadmap Link */}
                <div className="px-2">
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton tooltip="Roadmap" asChild>
                                <Link
                                    href="/roadmap"
                                    prefetch={true}
                                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-sidebar-muted hover:text-foreground transition-colors"
                                >
                                    <Map className="size-4" />
                                    {!isCollapsed && <span>Roadmap</span>}
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </div>

                {!isCollapsed && (
                    (isAuthLoading || (isAuthenticated && authSessions === undefined)) ? (
                        <div className="flex flex-col gap-3">
                            <div className="px-2 py-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        Sessions
                                    </span>
                                    <button
                                        className="inline-flex items-center justify-center rounded-md p-1 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                                        title="New session"
                                        onClick={() => window.location.href = '/'}
                                    >
                                        <Plus className="size-4" />
                                    </button>
                                </div>
                            </div>
                            <SidebarMenu className="px-2">
                                {[1, 2, 3].map((i) => (
                                    <SidebarMenuItem key={i} className="px-0">
                                        <Skeleton className="h-9 w-full rounded-lg" />
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </div>
                    ) : (
                        <SessionsNav
                            sessions={sessions}
                            isDemo={!isAuthenticated}
                        />
                    )
                )}
            </SidebarContent>

            {/* Footer - Help & Theme Switcher */}
            <SidebarFooter className="px-2 pb-2 gap-2">
                <SettingsButton />
                <HelpButton />
                <ThemeSwitcher />
                <Separator className="mx-2" />
                <UserInfo />
            </SidebarFooter>
        </Sidebar>
    );
}
