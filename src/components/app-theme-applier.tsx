"use client";

import { useEffect } from "react";

export function AppThemeApplier() {
    useEffect(() => {
        const apply = () => {
            try {
                const value = typeof window !== "undefined" ? localStorage.getItem("appTheme") : null;
                if (value === "pro") {
                    document.documentElement.setAttribute("data-theme", "pro");
                } else {
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


