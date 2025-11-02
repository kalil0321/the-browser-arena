"use client";

import { useEffect } from "react";

export function AppThemeApplier() {
    useEffect(() => {
        const apply = () => {
            try {
                const value = typeof window !== "undefined" ? localStorage.getItem("appTheme") : null;
                const currentTheme = document.documentElement.getAttribute("data-theme");

                // Only update DOM if value actually changed
                if (value === "pro" && currentTheme !== "pro") {
                    document.documentElement.setAttribute("data-theme", "pro");
                } else if (value !== "pro" && currentTheme === "pro") {
                    document.documentElement.removeAttribute("data-theme");
                }
            } catch {
                // no-op
            }
        };

        apply();

        const onStorage = (e: StorageEvent) => {
            if (e.key === "appTheme") apply();
        };
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, []);

    return null;
}


