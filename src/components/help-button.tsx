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
                        // Open help modal or navigate to help page
                        window.open("https://help.example.com", "_blank");
                    }}
                    className="w-full justify-start"
                >
                    <HelpCircle className="size-4" />
                    <span className="text-sm">Help</span>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
