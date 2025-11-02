"use client";

import { HelpCircle } from "lucide-react";
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";

export function HelpButton() {
    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton
                    onClick={() => {
                        // Open GitHub issue creation page
                        window.open("https://github.com/kalil0321/the-browser-arena/issues/new", "_blank");
                    }}
                    className="w-full justify-start touch-manipulation min-h-[44px] sm:min-h-0"
                >
                    <HelpCircle className="size-4 shrink-0" />
                    <span className="text-sm">Help</span>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
