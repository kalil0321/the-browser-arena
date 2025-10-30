"use client";

import { Settings } from "lucide-react";
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useRouter } from "next/navigation";

export function SettingsButton() {
    const router = useRouter();

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton
                    onClick={() => {
                        router.push("/settings");
                    }}
                    className="w-full justify-start"
                >
                    <Settings className="size-4" />
                    <span className="text-sm">Settings</span>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}

