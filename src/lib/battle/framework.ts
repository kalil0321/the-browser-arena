/**
 * Framework Detection Utilities
 *
 * Determines agent frameworks and checks if agents use the same framework.
 * Used to decide whether to show browser live views during battles.
 */

export type Framework = "browser-use" | "stagehand" | "smooth" | "notte";

/**
 * Get framework from agent type
 *
 * @param agentType Agent type string (e.g., "browser-use", "browser-use-cloud", "stagehand-bb-cloud")
 * @returns Framework identifier
 */
export function getFramework(agentType: string): Framework {
    if (agentType.includes("browser-use")) return "browser-use";
    if (agentType.includes("stagehand")) return "stagehand";
    if (agentType === "smooth") return "smooth";
    if (agentType === "notte") return "notte";
    throw new Error(`Unknown agent type: ${agentType}`);
}

/**
 * Check if two agents use the same framework
 *
 * @param agentA First agent type
 * @param agentB Second agent type
 * @returns true if both use the same framework
 */
export function hasSameFramework(agentA: string, agentB: string): boolean {
    try {
        const frameworkA = getFramework(agentA);
        const frameworkB = getFramework(agentB);
        return frameworkA === frameworkB;
    } catch {
        return false;
    }
}

/**
 * Get display name for agent (short version for UI)
 *
 * @param agentType Agent type string
 * @returns Short display name
 */
export function getAgentDisplayName(agentType: string): string {
    if (agentType === "browser-use-cloud") return "BU Cloud";
    if (agentType === "stagehand-bb-cloud") return "SH BB Cloud";
    if (agentType === "stagehand-cloud") return "SH Cloud";
    if (agentType === "browser-use") return "Browser-Use";
    if (agentType === "stagehand") return "Stagehand";
    if (agentType === "smooth") return "Smooth";
    if (agentType === "notte") return "Notte";
    return agentType;
}

/**
 * Get all supported frameworks
 */
export const SUPPORTED_FRAMEWORKS: Framework[] = [
    "browser-use",
    "stagehand",
    "smooth",
    "notte"
];

/**
 * Get all agent types for a given framework
 *
 * @param framework Framework identifier
 * @returns Array of agent type strings
 */
export function getAgentTypesForFramework(framework: Framework): string[] {
    switch (framework) {
        case "browser-use":
            return ["browser-use", "browser-use-cloud"];
        case "stagehand":
            return ["stagehand", "stagehand-bb-cloud", "stagehand-cloud"];
        case "smooth":
            return ["smooth"];
        case "notte":
            return ["notte"];
    }
}
