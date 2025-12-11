/**
 * Battle Mutations and Queries
 *
 * Handles all database operations for battle mode including:
 * - Creating and updating battles
 * - Recording votes and updating ELO ratings
 * - Querying battles and leaderboards
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { getUser } from "./auth";
import { DEFAULT_ELO_RATING, calculateEloChange, getKFactor } from "./lib/battle/elo";

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new battle
 */
export const createBattle = mutation({
    args: {
        instruction: v.string(),
        agentAId: v.id("agents"),
        agentBId: v.id("agents"),
        sameFramework: v.boolean(),
    },
    handler: async (ctx, args) => {
        const user = await getUser(ctx);
        if (!user) {
            throw new Error("Not authenticated");
        }

        const now = Date.now();

        const battleId = await ctx.db.insert("battles", {
            userId: user._id,
            instruction: args.instruction,
            status: "pending",
            agentAId: args.agentAId,
            agentBId: args.agentBId,
            sameFramework: args.sameFramework,
            createdAt: now,
            updatedAt: now,
        });

        return { battleId };
    },
});

/**
 * Update battle status
 */
export const updateBattleStatus = mutation({
    args: {
        battleId: v.id("battles"),
        status: v.union(
            v.literal("pending"),
            v.literal("running"),
            v.literal("completed"),
            v.literal("voted"),
            v.literal("failed")
        ),
        completedAt: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const battle = await ctx.db.get(args.battleId);
        if (!battle) {
            throw new Error("Battle not found");
        }

        await ctx.db.patch(args.battleId, {
            status: args.status,
            completedAt: args.completedAt,
            updatedAt: Date.now(),
        });

        return { success: true };
    },
});

/**
 * Record battle vote and update ELO ratings
 */
export const recordBattleVote = mutation({
    args: {
        battleId: v.id("battles"),
        winnerId: v.optional(v.id("agents")),  // null for tie/both-bad
        voteType: v.union(
            v.literal("winner"),
            v.literal("tie"),
            v.literal("both-bad")
        ),
        agentAEloChange: v.number(),
        agentBEloChange: v.number(),
    },
    handler: async (ctx, args) => {
        const user = await getUser(ctx);
        if (!user) {
            throw new Error("Not authenticated");
        }

        const battle = await ctx.db.get(args.battleId);
        if (!battle) {
            throw new Error("Battle not found");
        }

        // Verify user owns the battle
        if (battle.userId !== user._id) {
            throw new Error("Not authorized to vote on this battle");
        }

        // Verify battle is completed
        if (battle.status !== "completed") {
            throw new Error("Battle must be completed before voting");
        }

        // Verify battle hasn't been voted on yet
        if (battle.winnerId !== undefined || battle.voteType) {
            throw new Error("Battle has already been voted on");
        }

        // Validate winnerId for "winner" vote type
        if (args.voteType === "winner" && !args.winnerId) {
            throw new Error("winnerId is required for winner vote type");
        }

        // Update battle with vote
        await ctx.db.patch(args.battleId, {
            status: "voted",
            winnerId: args.winnerId,
            voteType: args.voteType,
            votedAt: Date.now(),
            agentAEloChange: args.agentAEloChange,
            agentBEloChange: args.agentBEloChange,
            updatedAt: Date.now(),
        });

        return { success: true };
    },
});

/**
 * Initialize battle rating for an agent+model combination
 */
export const initializeBattleRating = mutation({
    args: {
        agentType: v.string(),
        model: v.optional(v.string()),
        initialRating: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        // Check if rating already exists
        const existing = await ctx.db
            .query("battleRatings")
            .withIndex("by_agent_model", q =>
                q.eq("agentType", args.agentType).eq("model", args.model)
            )
            .first();

        if (existing) {
            return { ratingId: existing._id, existed: true };
        }

        const now = Date.now();
        const ratingId = await ctx.db.insert("battleRatings", {
            agentType: args.agentType,
            model: args.model,
            eloRating: args.initialRating ?? DEFAULT_ELO_RATING,
            totalBattles: 0,
            wins: 0,
            losses: 0,
            successRate: 0,
            createdAt: now,
            updatedAt: now,
        });

        return { ratingId, existed: false };
    },
});

/**
 * Update battle rating after a battle
 */
export const updateBattleRating = mutation({
    args: {
        agentType: v.string(),
        model: v.optional(v.string()),
        eloChange: v.number(),
        won: v.boolean(),
        duration: v.optional(v.number()),
        success: v.boolean(), // Whether the agent completed successfully
    },
    handler: async (ctx, args) => {
        const rating = await ctx.db
            .query("battleRatings")
            .withIndex("by_agent_model", q =>
                q.eq("agentType", args.agentType).eq("model", args.model)
            )
            .first();

        if (!rating) {
            throw new Error(`No rating found for ${args.agentType}${args.model ? ` with model ${args.model}` : ""}`);
        }

        const newTotalBattles = rating.totalBattles + 1;
        const newWins = args.won ? rating.wins + 1 : rating.wins;
        const newLosses = !args.won ? rating.losses + 1 : rating.losses;

        // Calculate success rate (battles that completed successfully / total battles)
        // This is separate from wins/losses
        const successCount = args.success ? 1 : 0;
        const currentSuccessCount = Math.round(rating.successRate * rating.totalBattles);
        const newSuccessRate = (currentSuccessCount + successCount) / newTotalBattles;

        await ctx.db.patch(rating._id, {
            eloRating: rating.eloRating + args.eloChange,
            totalBattles: newTotalBattles,
            wins: newWins,
            losses: newLosses,
            successRate: newSuccessRate,
            updatedAt: Date.now(),
        });

        return { success: true };
    },
});

/**
 * Batch initialize battle ratings if needed - optimized for performance
 */
export const initializeBattleRatingsIfNeeded = mutation({
    args: {
        ratings: v.array(v.object({
            agentType: v.string(),
            model: v.optional(v.string()),
        })),
    },
    handler: async (ctx, args) => {
        const results: (Doc<"battleRatings"> | null)[] = [];

        for (const ratingInfo of args.ratings) {
            // Check if rating already exists
            const existing = await ctx.db
                .query("battleRatings")
                .withIndex("by_agent_model", q =>
                    q.eq("agentType", ratingInfo.agentType).eq("model", ratingInfo.model)
                )
                .first();

            if (!existing) {
                // Initialize new rating
                const now = Date.now();
                const ratingId = await ctx.db.insert("battleRatings", {
                    agentType: ratingInfo.agentType,
                    model: ratingInfo.model,
                    eloRating: DEFAULT_ELO_RATING,
                    totalBattles: 0,
                    wins: 0,
                    losses: 0,
                    successRate: 0,
                    createdAt: now,
                    updatedAt: now,
                });

                const newRating = await ctx.db.get(ratingId);
                results.push(newRating);
            } else {
                results.push(existing);
            }
        }

        return results;
    }
});

/**
 * Record battle vote with rating updates in single transaction - optimized for performance
 */
export const recordBattleVoteWithRatings = mutation({
    args: {
        battleId: v.id("battles"),
        winnerId: v.optional(v.id("agents")),
        voteType: v.union(
            v.literal("winner"),
            v.literal("tie"),
            v.literal("both-bad")
        ),
        agentAEloChange: v.number(),
        agentBEloChange: v.number(),
        ratingUpdates: v.optional(v.array(v.object({
            agentType: v.string(),
            model: v.optional(v.string()),
            eloChange: v.number(),
            won: v.boolean(),
            success: v.boolean(),
        }))),
    },
    handler: async (ctx, args) => {
        // Update battle with vote
        await ctx.db.patch(args.battleId, {
            status: "voted",
            winnerId: args.winnerId,
            voteType: args.voteType,
            votedAt: Date.now(),
            agentAEloChange: args.agentAEloChange,
            agentBEloChange: args.agentBEloChange,
            updatedAt: Date.now(),
        });

        // Update ratings if provided - optimized to fetch in parallel
        if (args.ratingUpdates) {
            // Fetch all ratings in parallel
            const ratingPromises = args.ratingUpdates.map(update =>
                ctx.db
                    .query("battleRatings")
                    .withIndex("by_agent_model", q =>
                        q.eq("agentType", update.agentType).eq("model", update.model)
                    )
                    .first()
            );

            const ratings = await Promise.all(ratingPromises);

            // Update all ratings in parallel
            const updatePromises = args.ratingUpdates.map(async (update, index) => {
                const rating = ratings[index];
                if (!rating) {
                    throw new Error(`No rating found for ${update.agentType}${update.model ? ` with model ${update.model}` : ""}`);
                }

                const newTotalBattles = rating.totalBattles + 1;
                const newWins = update.won ? rating.wins + 1 : rating.wins;
                const newLosses = !update.won ? rating.losses + 1 : rating.losses;

                const successCount = update.success ? 1 : 0;
                const currentSuccessCount = Math.round(rating.successRate * rating.totalBattles);
                const newSuccessRate = (currentSuccessCount + successCount) / newTotalBattles;

                return ctx.db.patch(rating._id, {
                    eloRating: rating.eloRating + update.eloChange,
                    totalBattles: newTotalBattles,
                    wins: newWins,
                    losses: newLosses,
                    successRate: newSuccessRate,
                    updatedAt: Date.now(),
                });
            });

            await Promise.all(updatePromises);
        }

        return { success: true };
    },
});

/**
 * Submit battle vote - comprehensive mutation that handles everything in one transaction
 * Optimized for performance: single round trip, parallel database queries
 */
export const submitBattleVote = mutation({
    args: {
        battleId: v.id("battles"),
        winnerId: v.optional(v.id("agents")),
        voteType: v.union(
            v.literal("winner"),
            v.literal("tie"),
            v.literal("both-bad")
        ),
    },
    handler: async (ctx, args) => {
        // User authentication
        const user = await getUser(ctx);
        if (!user) {
            throw new Error("Not authenticated");
        }

        // Fetch battle and both agents in parallel
        const battle = await ctx.db.get(args.battleId);
        if (!battle) {
            throw new Error("Battle not found");
        }

        // Verify user owns the battle
        if (battle.userId !== user._id) {
            throw new Error("Not authorized to vote on this battle");
        }

        // Verify battle hasn't been voted on yet
        if (battle.status === "voted" || battle.winnerId !== undefined || battle.voteType) {
            throw new Error("Battle has already been voted on");
        }

        // Validate winnerId for "winner" vote type
        if (args.voteType === "winner" && !args.winnerId) {
            throw new Error("winnerId is required for winner vote type");
        }

        // Verify winnerId is valid for "winner" vote type
        if (args.voteType === "winner" && args.winnerId && args.winnerId !== battle.agentAId && args.winnerId !== battle.agentBId) {
            throw new Error("Invalid winner ID");
        }

        // Fetch both agents in parallel
        const [agentA, agentB] = await Promise.all([
            ctx.db.get(battle.agentAId),
            ctx.db.get(battle.agentBId)
        ]);

        if (!agentA || !agentB) {
            throw new Error("Agents not found for battle");
        }

        // Check if at least one agent is completed
        const agentACompleted = agentA.status === "completed";
        const agentBCompleted = agentB.status === "completed";
        const anyCompleted = agentACompleted || agentBCompleted;

        if (!anyCompleted) {
            throw new Error(`At least one agent must complete before voting. Agent A: ${agentA.status}, Agent B: ${agentB.status}`);
        }

        // Get agent types
        const agentAType = agentA.result?.agent || agentA.name;
        const agentBType = agentB.result?.agent || agentB.name;

        // Fetch ratings in parallel
        const [ratingA, ratingB] = await Promise.all([
            ctx.db
                .query("battleRatings")
                .withIndex("by_agent_model", q =>
                    q.eq("agentType", agentAType).eq("model", agentA.model)
                )
                .first(),
            ctx.db
                .query("battleRatings")
                .withIndex("by_agent_model", q =>
                    q.eq("agentType", agentBType).eq("model", agentB.model)
                )
                .first()
        ]);

        // Initialize missing ratings if needed
        let finalRatingA = ratingA;
        let finalRatingB = ratingB;

        if (!ratingA || !ratingB) {
            const now = Date.now();

            // Initialize rating A if missing
            if (!ratingA) {
                const existingA = await ctx.db
                    .query("battleRatings")
                    .withIndex("by_agent_model", q =>
                        q.eq("agentType", agentAType).eq("model", agentA.model)
                    )
                    .first();

                if (existingA) {
                    finalRatingA = existingA;
                } else {
                    const ratingIdA = await ctx.db.insert("battleRatings", {
                        agentType: agentAType,
                        model: agentA.model,
                        eloRating: DEFAULT_ELO_RATING,
                        totalBattles: 0,
                        wins: 0,
                        losses: 0,
                        successRate: 0,
                        createdAt: now,
                        updatedAt: now,
                    });
                    const newRatingA = await ctx.db.get(ratingIdA);
                    if (newRatingA) {
                        finalRatingA = newRatingA;
                    }
                }
            }

            // Initialize rating B if missing
            if (!ratingB) {
                const existingB = await ctx.db
                    .query("battleRatings")
                    .withIndex("by_agent_model", q =>
                        q.eq("agentType", agentBType).eq("model", agentB.model)
                    )
                    .first();

                if (existingB) {
                    finalRatingB = existingB;
                } else {
                    const ratingIdB = await ctx.db.insert("battleRatings", {
                        agentType: agentBType,
                        model: agentB.model,
                        eloRating: DEFAULT_ELO_RATING,
                        totalBattles: 0,
                        wins: 0,
                        losses: 0,
                        successRate: 0,
                        createdAt: now,
                        updatedAt: now,
                    });
                    const newRatingB = await ctx.db.get(ratingIdB);
                    if (newRatingB) {
                        finalRatingB = newRatingB;
                    }
                }
            }
        }

        if (!finalRatingA || !finalRatingB) {
            throw new Error("Failed to initialize battle ratings");
        }

        // Update battle status to "completed" if needed
        if (battle.status !== "completed") {
            await ctx.db.patch(args.battleId, {
                status: "completed",
                completedAt: Date.now(),
                updatedAt: Date.now(),
            });
        }

        // Determine outcome based on vote type
        let outcome: number;
        let shouldUpdateElo = true;

        if (args.voteType === "winner") {
            // 1 if A wins, 0 if B wins
            outcome = args.winnerId === battle.agentAId ? 1 : 0;
        } else if (args.voteType === "tie") {
            // 0.5 for both (draw)
            outcome = 0.5;
        } else {
            // both-bad: Don't update ELO
            outcome = 0.5;
            shouldUpdateElo = false;
        }

        // Get K-factors based on battle count
        const kFactorA = getKFactor(finalRatingA.totalBattles);
        const kFactorB = getKFactor(finalRatingB.totalBattles);

        // Use average K-factor for fairness
        const avgKFactor = Math.round((kFactorA + kFactorB) / 2);

        // Calculate ELO changes
        const eloResult = shouldUpdateElo ? calculateEloChange(
            finalRatingA.eloRating,
            finalRatingB.eloRating,
            outcome,
            avgKFactor
        ) : {
            agentANewRating: finalRatingA.eloRating,
            agentBNewRating: finalRatingB.eloRating,
            agentAChange: 0,
            agentBChange: 0,
        };

        // Determine wins/losses based on vote type
        let agentAWon: boolean;
        let agentBWon: boolean;

        if (args.voteType === "winner") {
            agentAWon = outcome === 1;
            agentBWon = outcome === 0;
        } else if (args.voteType === "tie") {
            // Tie: both win
            agentAWon = true;
            agentBWon = true;
        } else {
            // both-bad: both lose
            agentAWon = false;
            agentBWon = false;
        }

        const agentASuccess = agentA.status === "completed";
        const agentBSuccess = agentB.status === "completed";

        // Update battle with vote
        await ctx.db.patch(args.battleId, {
            status: "voted",
            winnerId: args.winnerId,
            voteType: args.voteType,
            votedAt: Date.now(),
            agentAEloChange: eloResult.agentAChange,
            agentBEloChange: eloResult.agentBChange,
            updatedAt: Date.now(),
        });

        // Update both ratings in parallel if ELO should be updated
        if (shouldUpdateElo) {
            const updatePromises: Promise<void>[] = [];

            // Update rating A
            const newTotalBattlesA = finalRatingA.totalBattles + 1;
            const newWinsA = agentAWon ? finalRatingA.wins + 1 : finalRatingA.wins;
            const newLossesA = !agentAWon ? finalRatingA.losses + 1 : finalRatingA.losses;
            const successCountA = agentASuccess ? 1 : 0;
            const currentSuccessCountA = Math.round(finalRatingA.successRate * finalRatingA.totalBattles);
            const newSuccessRateA = (currentSuccessCountA + successCountA) / newTotalBattlesA;

            updatePromises.push(
                ctx.db.patch(finalRatingA._id, {
                    eloRating: finalRatingA.eloRating + eloResult.agentAChange,
                    totalBattles: newTotalBattlesA,
                    wins: newWinsA,
                    losses: newLossesA,
                    successRate: newSuccessRateA,
                    updatedAt: Date.now(),
                })
            );

            // Update rating B
            const newTotalBattlesB = finalRatingB.totalBattles + 1;
            const newWinsB = agentBWon ? finalRatingB.wins + 1 : finalRatingB.wins;
            const newLossesB = !agentBWon ? finalRatingB.losses + 1 : finalRatingB.losses;
            const successCountB = agentBSuccess ? 1 : 0;
            const currentSuccessCountB = Math.round(finalRatingB.successRate * finalRatingB.totalBattles);
            const newSuccessRateB = (currentSuccessCountB + successCountB) / newTotalBattlesB;

            updatePromises.push(
                ctx.db.patch(finalRatingB._id, {
                    eloRating: finalRatingB.eloRating + eloResult.agentBChange,
                    totalBattles: newTotalBattlesB,
                    wins: newWinsB,
                    losses: newLossesB,
                    successRate: newSuccessRateB,
                    updatedAt: Date.now(),
                })
            );

            // Execute both rating updates in parallel
            await Promise.all(updatePromises);
        }

        // Return complete vote result
        return {
            success: true,
            voteType: args.voteType,
            agentA: {
                name: agentAType,
                model: agentA.model,
                oldRating: finalRatingA.eloRating,
                newRating: eloResult.agentANewRating,
                eloChange: eloResult.agentAChange,
                won: agentAWon,
            },
            agentB: {
                name: agentBType,
                model: agentB.model,
                oldRating: finalRatingB.eloRating,
                newRating: eloResult.agentBNewRating,
                eloChange: eloResult.agentBChange,
                won: agentBWon,
            }
        };
    },
});

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get battle by ID
 * Returns battle with masked identities if not voted yet
 */
export const getBattle = query({
    args: { battleId: v.id("battles") },
    handler: async (ctx, args) => {
        const battle = await ctx.db.get(args.battleId);
        if (!battle) {
            return null;
        }

        // Get both agents
        const agentA = await ctx.db.get(battle.agentAId);
        const agentB = await ctx.db.get(battle.agentBId);

        if (!agentA || !agentB) {
            throw new Error("Agents not found for battle");
        }

        // Check if user owns the battle
        const user = await getUser(ctx);
        const isOwner = user && battle.userId === user._id;

        // Return battle with agents
        // If not voted yet, mask agent identities
        const hasVoted = battle.status === "voted" || !!battle.winnerId;

        return {
            ...battle,
            agentA: {
                ...agentA,
                // Mask name and model if not voted yet
                name: hasVoted ? agentA.name : "Agent A",
                model: hasVoted ? agentA.model : undefined,
            },
            agentB: {
                ...agentB,
                name: hasVoted ? agentB.name : "Agent B",
                model: hasVoted ? agentB.model : undefined,
            },
            isOwner,
        };
    },
});

/**
 * Get user's battles
 */
export const getUserBattles = query({
    args: {},
    handler: async (ctx) => {
        const user = await getUser(ctx);
        if (!user) {
            return [];
        }

        const battles = await ctx.db
            .query("battles")
            .withIndex("by_user", q => q.eq("userId", user._id))
            .order("desc")
            .collect();

        // Fetch agent details for each battle
        const battlesWithAgents = await Promise.all(
            battles.map(async (battle) => {
                const agentA = await ctx.db.get(battle.agentAId);
                const agentB = await ctx.db.get(battle.agentBId);
                return {
                    ...battle,
                    agentA,
                    agentB,
                };
            })
        );

        return battlesWithAgents;
    },
});

/**
 * Get all public battles (voted battles for /battles page)
 */
export const getAllBattles = query({
    args: {
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        // Only return voted battles
        const battles = await ctx.db
            .query("battles")
            .withIndex("by_status", q => q.eq("status", "voted"))
            .order("desc")
            .take(args.limit ?? 100);

        // Fetch agent details for each battle
        const battlesWithAgents = await Promise.all(
            battles.map(async (battle) => {
                const agentA = await ctx.db.get(battle.agentAId);
                const agentB = await ctx.db.get(battle.agentBId);
                const winner = battle.winnerId ? await ctx.db.get(battle.winnerId) : null;

                return {
                    ...battle,
                    agentA,
                    agentB,
                    winner,
                };
            })
        );

        return battlesWithAgents;
    },
});

/**
 * Get leaderboard (top rated agents)
 */
export const getLeaderboard = query({
    args: {
        agentType: v.optional(v.string()),
        minBattles: v.optional(v.number()),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        let ratings = await ctx.db
            .query("battleRatings")
            .withIndex("by_elo")
            .order("desc")
            .collect();

        // Filter by agent type if specified
        if (args.agentType) {
            ratings = ratings.filter(r => r.agentType === args.agentType);
        }

        // Filter by minimum battles if specified
        if (args.minBattles !== undefined) {
            const minBattles = args.minBattles;
            ratings = ratings.filter(r => r.totalBattles >= minBattles);
        }

        // Sort by ELO rating (descending)
        ratings.sort((a, b) => b.eloRating - a.eloRating);

        // Limit results
        if (args.limit) {
            ratings = ratings.slice(0, args.limit);
        }

        // Add rank
        const rankedRatings = ratings.map((rating, index) => ({
            ...rating,
            rank: index + 1,
            winRate: rating.totalBattles > 0 ? (rating.wins / rating.totalBattles) * 100 : 0,
        }));

        return rankedRatings;
    },
});

/**
 * Get battle rating for specific agent+model
 */
export const getBattleRating = query({
    args: {
        agentType: v.string(),
        model: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const rating = await ctx.db
            .query("battleRatings")
            .withIndex("by_agent_model", q =>
                q.eq("agentType", args.agentType).eq("model", args.model)
            )
            .first();

        return rating;
    },
});

/**
 * Get battle statistics
 */
export const getBattleStats = query({
    args: {},
    handler: async (ctx) => {
        const allBattles = await ctx.db.query("battles").collect();
        const votedBattles = allBattles.filter(b => b.status === "voted");
        const activeBattles = allBattles.filter(b => b.status === "running");

        return {
            totalBattles: allBattles.length,
            votedBattles: votedBattles.length,
            activeBattles: activeBattles.length,
        };
    },
});

/**
 * Find matching agents for a battle
 */
export const findMatchingAgents = query({
    args: {},
    handler: async (ctx) => {
        const matchmakingConfig = {
            maxEloDifference: 200,
            preferSameFramework: false,
            kFactor: 32,
            kFactorThreshold: 30,
            eligibleAgents: ["stagehand", "browser-use"],
            requiredAgent: "stagehand"
        };

        // Get all battle ratings (acceptable for now, we don't have many agents yet)
        const allRatings = await ctx.db.query("battleRatings").collect();

        if (allRatings.length === 0) {
            throw new Error("No battle ratings found. Please initialize battle ratings first.");
        }

        // Filter to only eligible agents
        const eligibleRatings = allRatings.filter(rating =>
            matchmakingConfig.eligibleAgents.some(agent => rating.agentType.includes(agent))
        );

        if (eligibleRatings.length < 2) {
            throw new Error(`Not enough eligible agents for matchmaking. Found ${eligibleRatings.length}, need at least 2.`);
        }

        // Helper to get framework
        const getFramework = (agentType: string): string => {
            if (agentType.includes("browser-use")) return "browser-use";
            if (agentType.includes("stagehand")) return "stagehand";
            if (agentType === "smooth") return "smooth";
            if (agentType === "notte") return "notte";
            return agentType;
        };

        // Check if requiredAgent is set
        const hasRequiredAgent = matchmakingConfig.requiredAgent && matchmakingConfig.requiredAgent.trim() !== "";

        interface PotentialPair {
            agentA: typeof eligibleRatings[0];
            agentB: typeof eligibleRatings[0];
            eloDiff: number;
            sameFramework: boolean;
        }

        const potentialPairs: PotentialPair[] = [];

        if (hasRequiredAgent) {
            // Require the specified agent in every match
            const isRequiredAgent = (agentType: string): boolean => {
                return agentType.includes(matchmakingConfig.requiredAgent!);
            };

            // Separate required agents from others
            const requiredAgentRatings = eligibleRatings.filter(rating => isRequiredAgent(rating.agentType));
            const otherAgentRatings = eligibleRatings.filter(rating => !isRequiredAgent(rating.agentType));

            if (requiredAgentRatings.length === 0) {
                throw new Error(`No ${matchmakingConfig.requiredAgent} agents found. At least one ${matchmakingConfig.requiredAgent} agent is required for matchmaking.`);
            }

            if (otherAgentRatings.length === 0) {
                throw new Error(`No other eligible agents found. Need at least one non-${matchmakingConfig.requiredAgent} agent for matchmaking.`);
            }

            // Sort by ELO rating (descending)
            const sortedRequiredRatings = requiredAgentRatings.sort((a, b) => b.eloRating - a.eloRating);
            const sortedOtherRatings = otherAgentRatings.sort((a, b) => b.eloRating - a.eloRating);

            // Create pairs: required agent (A) vs other agent (B)
            for (const requiredAgent of sortedRequiredRatings) {
                for (const otherAgent of sortedOtherRatings) {
                    const eloDiff = Math.abs(requiredAgent.eloRating - otherAgent.eloRating);

                    if (eloDiff <= matchmakingConfig.maxEloDifference) {
                        const frameworkA = getFramework(requiredAgent.agentType);
                        const frameworkB = getFramework(otherAgent.agentType);
                        const sameFramework = frameworkA === frameworkB;

                        potentialPairs.push({
                            agentA: requiredAgent,
                            agentB: otherAgent,
                            eloDiff,
                            sameFramework
                        });
                    }
                }
            }

            if (potentialPairs.length === 0) {
                throw new Error(`No valid matchups found within max ELO difference of ${matchmakingConfig.maxEloDifference}. Ensure there are ${matchmakingConfig.requiredAgent} agents that can be matched with other eligible agents.`);
            }
        } else {
            const sortedRatings = eligibleRatings.sort((a, b) => b.eloRating - a.eloRating);

            for (let i = 0; i < sortedRatings.length; i++) {
                for (let j = i + 1; j < sortedRatings.length; j++) {
                    const agentA = sortedRatings[i];
                    const agentB = sortedRatings[j];
                    const eloDiff = Math.abs(agentA.eloRating - agentB.eloRating);

                    if (eloDiff <= matchmakingConfig.maxEloDifference) {
                        const frameworkA = getFramework(agentA.agentType);
                        const frameworkB = getFramework(agentB.agentType);
                        const sameFramework = frameworkA === frameworkB;

                        potentialPairs.push({
                            agentA,
                            agentB,
                            eloDiff,
                            sameFramework
                        });
                    }
                }
            }

            if (potentialPairs.length === 0) {
                throw new Error(`No valid matchups found within max ELO difference of ${matchmakingConfig.maxEloDifference}`);
            }
        }

        // Filter out cross-framework pairs with different models
        // Same-framework pairs are always allowed, but cross-framework pairs must use the same model
        const validPairs = potentialPairs.filter(pair => {
            // Same-framework pairs are always valid
            if (pair.sameFramework) {
                return true;
            }

            // Cross-framework pairs: only valid if models match
            const modelA = pair.agentA.model;
            const modelB = pair.agentB.model;

            // Both undefined (agents without models) is considered a match
            if (modelA === undefined && modelB === undefined) {
                return true;
            }

            // Both must be defined and equal
            return modelA !== undefined && modelB !== undefined && modelA === modelB;
        });

        if (validPairs.length === 0) {
            throw new Error(`No valid cross-framework matchups found. Cross-framework battles require both agents to use the same model.`);
        }

        // If preferSameFramework, prioritize same framework pairs
        let selectedPairs = validPairs;
        if (matchmakingConfig.preferSameFramework) {
            const sameFrameworkPairs = validPairs.filter(p => p.sameFramework);
            if (sameFrameworkPairs.length > 0) {
                selectedPairs = sameFrameworkPairs;
            }
        }

        // Sort by ELO difference and pick from top 3
        selectedPairs.sort((a, b) => a.eloDiff - b.eloDiff);
        const topPairs = selectedPairs.slice(0, Math.min(3, selectedPairs.length));
        const selectedPair = topPairs[Math.floor(Math.random() * topPairs.length)];

        return {
            agentA: {
                type: selectedPair.agentA.agentType,
                model: selectedPair.agentA.model,
                rating: selectedPair.agentA.eloRating
            },
            agentB: {
                type: selectedPair.agentB.agentType,
                model: selectedPair.agentB.model,
                rating: selectedPair.agentB.eloRating
            }
        };
    },
});
