"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { SidebarInset } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

export default function ProfileBrowserPage() {
    const params = useSearchParams();
    const router = useRouter();

    const url = useMemo(() => params.get("url"), [params]);

    useEffect(() => {
        // If missing URL, send user back to settings
        if (url === null) {
            const t = setTimeout(() => router.push("/settings"), 1500);
            return () => clearTimeout(t);
        }
    }, [url, router]);

    if (!url) {
        return (
            <SidebarInset className="flex items-center justify-center">
                <div className="text-center space-y-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-900 dark:border-gray-700 dark:border-t-gray-300 mx-auto"></div>
                    <div className="text-sm text-muted-foreground">Preparing your browser profile…</div>
                    <Button size="sm" variant="outline" onClick={() => router.push("/settings")}>Back to Settings</Button>
                </div>
            </SidebarInset>
        );
    }

    return (
        <SidebarInset className="flex flex-col w-full h-full">
            <div className="flex items-center justify-between px-6 py-4 border-b">
                <div>
                    <h1 className="text-xl font-semibold">Profile Browser</h1>
                    <p className="text-sm text-muted-foreground">Interact with your persistent browser profile</p>
                </div>
                <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => router.push("/settings")}>Close</Button>
                </div>
            </div>
            <div className="flex-1 min-h-0">
                <iframe
                    title="Profile Browser"
                    src={url}
                    className="w-full h-full border-0"
                    allow="clipboard-read; clipboard-write; microphone; camera;"
                />
            </div>
        </SidebarInset>
    );
}


