/**
 * ELO Rating System for Battle Mode
 *
 * Standard ELO calculation used in competitive games and chess.
 * Default starting rating: 800
 * K-factor: 32 for new players (< 30 battles), 16 for established players
 */

export interface EloCalculationResult {
    agentANewRating: number;
    agentBNewRating: number;
    agentAChange: number;
    agentBChange: number;
}

/**
 * Calculate ELO rating changes after a battle
 *
 * @param ratingA Current ELO rating of Agent A
 * @param ratingB Current ELO rating of Agent B
 * @param outcome 1 if A wins, 0 if B wins, 0.5 for tie
 * @param kFactor K-factor (32 for new players, 16 for established)
 * @returns New ratings and changes for both agents
 *
 * Formula:
 * - Expected score = 1 / (1 + 10^((opponent rating - your rating) / 400))
 * - New rating = old rating + K * (actual score - expected score)
 */
export function calculateEloChange(
    ratingA: number,
    ratingB: number,
    outcome: number,
    kFactor: number = 32
): EloCalculationResult {
    // Calculate expected scores using ELO formula
    const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
    const expectedB = 1 / (1 + Math.pow(10, (ratingA - ratingB) / 400));

    // Actual scores based on outcome
    const actualA = outcome;
    const actualB = 1 - outcome;

    // Calculate rating changes
    const changeA = Math.round(kFactor * (actualA - expectedA));
    const changeB = Math.round(kFactor * (actualB - expectedB));

    return {
        agentANewRating: ratingA + changeA,
        agentBNewRating: ratingB + changeB,
        agentAChange: changeA,
        agentBChange: changeB,
    };
}

/**
 * Get appropriate K-factor based on number of battles
 *
 * @param totalBattles Number of battles the agent has participated in
 * @param threshold Number of battles before using lower K-factor (default: 30)
 * @returns K-factor (32 for new, 16 for established)
 */
export function getKFactor(totalBattles: number, threshold: number = 30): number {
    return totalBattles < threshold ? 32 : 16;
}

/**
 * Calculate win probability for Agent A against Agent B
 *
 * @param ratingA ELO rating of Agent A
 * @param ratingB ELO rating of Agent B
 * @returns Probability (0-1) that Agent A will win
 */
export function calculateWinProbability(ratingA: number, ratingB: number): number {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Default initial ELO rating for new agents
 */
export const DEFAULT_ELO_RATING = 800;

/**
 * Default K-factor for new agents
 */
export const DEFAULT_K_FACTOR = 32;

/**
 * Default K-factor threshold (battles before using lower K-factor)
 */
export const DEFAULT_K_FACTOR_THRESHOLD = 30;
