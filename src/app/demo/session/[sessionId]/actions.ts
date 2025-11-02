"use server";

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function getDemoSession(sessionId: string) {
    try {
        // Validate sessionId is not empty
        if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
            return {
                success: false,
                error: "Invalid session ID: sessionId is required",
            };
        }

        // Ensure we pass a valid sessionId object
        const queryArgs = {
            sessionId: sessionId.trim() as any,
        };

        const session = await convex.query(api.queries.getDemoSession, queryArgs);
        return { success: true, data: session };
    } catch (error) {
        console.error("Error fetching demo session:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        // Log the sessionId that caused the error for debugging
        console.error("SessionId that caused error:", sessionId);
        return {
            success: false,
            error: errorMessage,
        };
    }
}

export async function getDemoSessionAgents(sessionId: string) {
    try {
        // Validate sessionId is not empty
        if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
            return {
                success: false,
                error: "Invalid session ID: sessionId is required",
                data: [],
            };
        }

        // Ensure we pass a valid sessionId object
        const queryArgs = {
            sessionId: sessionId.trim() as any,
        };

        const agents = await convex.query(api.queries.getDemoSessionAgents, queryArgs);
        return { success: true, data: agents };
    } catch (error) {
        console.error("Error fetching demo session agents:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        // Log the sessionId that caused the error for debugging
        console.error("SessionId that caused error:", sessionId);
        return {
            success: false,
            error: errorMessage,
            data: [],
        };
    }
}

