"use client";

import React from "react";

type AnimatedHeadlineProps = {
    phrases: string[];
    typingSpeedMs?: number;
    deletingSpeedMs?: number;
    holdTimeMs?: number;
    className?: string;
};

export function AnimatedHeadline({
    phrases,
    typingSpeedMs = 65,
    deletingSpeedMs = 45,
    holdTimeMs = 900,
    className,
}: AnimatedHeadlineProps) {
    const [displayText, setDisplayText] = React.useState("");
    const [phraseIndex, setPhraseIndex] = React.useState(0);
    const [isDeleting, setIsDeleting] = React.useState(false);

    React.useEffect(() => {
        if (phrases.length === 0) return;

        const currentPhrase = phrases[phraseIndex % phrases.length];
        let timer: number | undefined;

        if (!isDeleting) {
            if (displayText.length < currentPhrase.length) {
                timer = window.setTimeout(() => {
                    setDisplayText(currentPhrase.slice(0, displayText.length + 1));
                }, typingSpeedMs);
            } else {
                timer = window.setTimeout(() => setIsDeleting(true), holdTimeMs);
            }
        } else {
            if (displayText.length > 0) {
                timer = window.setTimeout(() => {
                    setDisplayText(currentPhrase.slice(0, displayText.length - 1));
                }, deletingSpeedMs);
            } else {
                setIsDeleting(false);
                setPhraseIndex((i) => (i + 1) % phrases.length);
            }
        }

        return () => {
            if (timer) window.clearTimeout(timer);
        };
    }, [displayText, isDeleting, phraseIndex, phrases, typingSpeedMs, deletingSpeedMs, holdTimeMs]);

    return (
        <span className={className}>
            {displayText}
            <span className="ml-1 inline-block h-[1em] w-[2px] animate-pulse bg-foreground align-middle" />
        </span>
    );
}


