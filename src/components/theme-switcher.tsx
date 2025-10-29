"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";

export function ThemeSwitcher() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton disabled>
                        <Sun className="size-4" />
                        <span className="text-sm">Theme</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        );
    }

    const isDark = theme === "dark";

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton
                    onClick={() => setTheme(isDark ? "light" : "dark")}
                    className="w-full justify-start"
                >
                    {isDark ? (
                        <>
                            <Moon className="size-4" />
                            <span className="text-sm">Dark</span>
                        </>
                    ) : (
                        <>
                            <Sun className="size-4" />
                            <span className="text-sm">Light</span>
                        </>
                    )}
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
