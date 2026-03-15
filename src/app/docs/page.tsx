"use client";

import { useEffect, useRef } from "react";

export default function DocsPage() {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Load Scalar API reference
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/@scalar/api-reference";
        script.async = true;
        document.head.appendChild(script);

        return () => {
            document.head.removeChild(script);
        };
    }, []);

    return (
        <div className="min-h-screen">
            {/* @ts-expect-error Scalar custom element */}
            <scalar-api-reference
                ref={containerRef}
                data-url="/api/v1/openapi.json"
                data-theme="kepler"
            />
        </div>
    );
}
