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
import { Trophy, Map } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

const teams = [
    { id: "1", name: "Alpha Inc.", logo: IconSmall, plan: "Free" },
    { id: "2", name: "Beta Corp.", logo: IconSmall, plan: "Free" },
    { id: "3", name: "Gamma Tech", logo: IconSmall, plan: "Free" },
];

export function DashboardSidebar() {
    const { state } = useSidebar();
    const isCollapsed = state === "collapsed";
    const { isAuthenticated } = useConvexAuth();
    const sessions = useQuery(api.queries.getUserSessions, isAuthenticated ? {} : "skip");
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
                    <a href="/" className="flex items-center gap-2">
                        <IconFull dark={!useWhiteLogo} width={80} height={60} />
                    </a>
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
                    (!isAuthenticated ? <SessionsNav sessions={[]} /> :
                        sessions === undefined ? (
                            <div className="flex flex-col gap-3">
                                <div className="px-2 py-1.5">
                                    <div className="flex items-center justify-between">
                                        <Skeleton className="h-4 w-20" />
                                        <Skeleton className="h-8 w-8 rounded-md" />
                                    </div>
                                </div>
                                <SidebarMenu className="px-2">
                                    {[1, 2, 3].map((i) => (
                                        <SidebarMenuItem key={i} className="px-0">
                                            <div className="flex h-9 items-center gap-2 rounded-md px-2">
                                                <Skeleton className="size-4 rounded-md" />
                                                <Skeleton className="h-4 flex-1 max-w-[80%]" />
                                            </div>
                                        </SidebarMenuItem>
                                    ))}
                                </SidebarMenu>
                            </div>
                        ) : (
                            <SessionsNav sessions={sessions} />
                        ))
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
