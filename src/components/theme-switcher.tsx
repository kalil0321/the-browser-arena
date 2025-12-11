"use client";

import { MonitorIcon, MoonStarIcon, SunIcon } from "lucide-react";
import { motion } from "motion/react";
import { useTheme } from "next-themes";
import type { JSX } from "react";
import { memo, useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const ThemeOption = memo(function ThemeOption({
    icon,
    value,
    isActive,
    onClick,
}: {
    icon: JSX.Element;
    value: string;
    isActive?: boolean;
    onClick: (value: string) => void;
}) {
    return (
        <button
            className={cn(
                "relative flex size-9 sm:size-8 cursor-default items-center justify-center rounded-full transition-[color] [&_svg]:size-4 touch-manipulation",
                isActive
                    ? "text-zinc-950 dark:text-zinc-50"
                    : "text-zinc-400 hover:text-zinc-950 dark:text-zinc-500 dark:hover:text-zinc-50"
            )}
            role="radio"
            aria-checked={isActive}
            aria-label={`Switch to ${value} theme`}
            onClick={() => onClick(value)}
        >
            {icon}

            {isActive && (
                <motion.div
                    layoutId="theme-option"
                    transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
                    className="absolute inset-0 rounded-full border border-zinc-200 dark:border-zinc-700"
                />
            )}
        </button>
    );
});

const THEME_OPTIONS = [
    {
        icon: <MonitorIcon />,
        value: "system",
    },
    {
        icon: <SunIcon />,
        value: "light",
    },
    {
        icon: <MoonStarIcon />,
        value: "dark",
    },
];

function ThemeSwitcher() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    if (!mounted) {
        // Render a stable placeholder to avoid server/client mismatches
        return (
            <div
                className="inline-flex items-center overflow-hidden rounded-full bg-white ring-1 ring-zinc-200 ring-inset dark:bg-zinc-950 dark:ring-zinc-700 w-fit"
                role="presentation"
                aria-hidden="true"
            >
                {THEME_OPTIONS.map((option) => (
                    <button
                        key={option.value}
                        className="relative flex size-9 sm:size-8 cursor-default items-center justify-center rounded-full transition-[color] [&_svg]:size-4 touch-manipulation text-zinc-400 dark:text-zinc-500"
                        type="button"
                        tabIndex={-1}
                    >
                        {option.icon}
                    </button>
                ))}
            </div>
        );
    }

    return (
        <div
            className="inline-flex items-center overflow-hidden rounded-full bg-white ring-1 ring-zinc-200 ring-inset dark:bg-zinc-950 dark:ring-zinc-700 w-fit"
            role="radiogroup"
        >
            {THEME_OPTIONS.map((option) => (
                <ThemeOption
                    key={option.value}
                    icon={option.icon}
                    value={option.value}
                    isActive={theme === option.value}
                    onClick={setTheme}
                />
            ))}
        </div>
    );
}

export { ThemeSwitcher };
