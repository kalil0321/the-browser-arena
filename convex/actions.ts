"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { api } from "./_generated/api";

const MAX_RECORDING_BYTES = 200 * 1024 * 1024; // 200MB safety cap
const DEFAULT_MIME_TYPE = "video/webm";
const DEFAULT_ANCHOR_BASE_URL = "https://api.anchorbrowser.io";

type StorageCtx = Pick<ActionCtx, "storage">;

async function uploadRecordingToConvexStorage(
    ctx: StorageCtx,
    buffer: ArrayBuffer,
    {
        mimeType = DEFAULT_MIME_TYPE,
        agentId,
        anchorSessionId,
    }: { mimeType?: string; agentId: string; anchorSessionId: string }
): Promise<string> {
    const blob = buffer instanceof Blob ? buffer : new Blob([buffer], { type: mimeType });

    if (blob.size === 0) {
        throw new Error("Recording blob is empty.");
    }

    if (blob.size > MAX_RECORDING_BYTES) {
        const sizeMb = Math.round(blob.size / (1024 * 1024));
        throw new Error(
            `Recording too large (${sizeMb}MB). Max allowed is ${MAX_RECORDING_BYTES / (1024 * 1024)}MB.`
        );
    }

    const storageId = await ctx.storage.store(blob);
    const recordingUrl = (await ctx.storage.getUrl(storageId)) ?? storageId;

    console.log("Stored recording in Convex storage", {
        storageId,
        sizeBytes: blob.size,
        agentId,
        anchorSessionId,
    });

    return recordingUrl;
}

// @ts-ignore
export const syncAgentRecordings = action({
    args: {
        limit: v.optional(v.number()),
    },
    // @ts-ignore
    handler: async (ctx, args) => {
        const anchorApiKey = process.env.ANCHOR_API_KEY;
        if (!anchorApiKey) {
            throw new Error("Missing ANCHOR_API_KEY environment variable.");
        }

        const maxAgents = Math.min(Math.max(args.limit ?? 25, 1), 100);

        // @ts-ignore
        const agents = await ctx.runQuery(api.queries.getAgentsNeedingRecordings, {
            limit: maxAgents,
        });

        if (agents.length === 0) {
            return { processed: 0, updated: 0 };
        }

        let updated = 0;

        for (const agent of agents) {
            const result = await processAgentRecording(ctx, agent, anchorApiKey);
            if (result.updated) {
                updated += 1;
            }
        }

        return {
            processed: agents.length,
            updated,
        };
    },
});

// @ts-ignore
export const syncRecordingForAgent = action({
    args: {
        agentId: v.id("agents"),
    },
    // @ts-ignore
    handler: async (ctx, args) => {
        const anchorApiKey = process.env.ANCHOR_API_KEY;
        if (!anchorApiKey) {
            throw new Error("Missing ANCHOR_API_KEY environment variable.");
        }

        // @ts-ignore
        const agent = await ctx.runQuery(api.queries.getAgentById, { agentId: args.agentId });
        if (!agent) {
            return { success: false, reason: "not_found" };
        }

        return await processAgentRecording(ctx, agent, anchorApiKey);
    },
});

type ProcessResult =
    | { success: false; updated: false; reason: string }
    | { success: true; updated: true; recordingUrl: string };

async function processAgentRecording(ctx: ActionCtx, agent: Doc<"agents">, anchorApiKey: string): Promise<ProcessResult> {
    if (agent.recordingUrl) {
        return { success: false, updated: false, reason: "already_has_recording" };
    }

    const anchorSessionId = agent.browser?.sessionId;
    if (!anchorSessionId) {
        return { success: false, updated: false, reason: "missing_anchor_session" };
    }

    try {
        const recording = await fetchAnchorRecording({
            apiKey: anchorApiKey,
            sessionId: anchorSessionId,
            baseUrl: process.env.ANCHOR_BASE_URL ?? DEFAULT_ANCHOR_BASE_URL,
        });

        if (!recording) {
            return { success: false, updated: false, reason: "recording_not_ready" };
        }

        const recordingUrl = await uploadRecordingToConvexStorage(ctx, recording.buffer, {
            mimeType: recording.mimeType ?? DEFAULT_MIME_TYPE,
            agentId: agent._id,
            anchorSessionId,
        });

        await ctx.runMutation(api.mutations.updateAgentRecordingUrlFromBackend, {
            agentId: agent._id,
            recordingUrl,
        });

        return { success: true, updated: true, recordingUrl };
    } catch (error) {
        console.error("Failed processing recording", {
            agentId: agent._id,
            anchorSessionId,
            error,
        });
        throw error;
    }
}

async function fetchAnchorRecording({
    apiKey,
    sessionId,
    baseUrl,
}: {
    apiKey: string;
    sessionId: string;
    baseUrl?: string;
}): Promise<{ buffer: ArrayBuffer; mimeType?: string } | null> {
    const resolvedBase = baseUrl?.replace(/\/$/, "") || DEFAULT_ANCHOR_BASE_URL;
    const url = `${resolvedBase}/v1/sessions/${sessionId}/recordings/primary/fetch`;

    const response = await fetch(url, {
        method: "GET",
        headers: {
            "anchor-api-key": apiKey,
            Accept: "video/mp4",
        },
    });

    if (response.status === 404) {
        return null;
    }

    if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
            `Failed to fetch recording for session ${sessionId}: ${response.status} ${response.statusText} ${text}`
        );
    }

    const buffer = await response.arrayBuffer();
    const mimeType = response.headers.get("content-type") ?? undefined;

    return { buffer, mimeType };
}

