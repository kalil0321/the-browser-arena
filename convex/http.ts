import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { authComponent, createAuth } from "./auth";
import { api } from "./_generated/api";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

/**
 * HTTP action to upload recording from Python backend
 * POST /upload-recording
 * Body: multipart/form-data with:
 *   - agentId: string (Convex agent ID)
 *   - file: binary (recording file)
 */
http.route({
    path: "/upload-recording",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
        try {
            const formData = await request.formData();
            const agentId = formData.get("agentId") as string;
            const file = formData.get("file") as File;

            if (!agentId) {
                return new Response("Missing agentId", { status: 400 });
            }

            if (!file) {
                return new Response("Missing file", { status: 400 });
            }

            // Store file in Convex storage
            const storageId = await ctx.storage.store(file);

            // Generate URL for the stored file
            const recordingUrl = await ctx.storage.getUrl(storageId);

            // Update agent with recording URL (mutation will handle agent not found error)
            await ctx.runMutation(api.mutations.updateAgentRecordingUrlFromBackend, {
                agentId: agentId as any,
                recordingUrl: recordingUrl || storageId,
            });

            return new Response(
                JSON.stringify({ success: true, recordingUrl, storageId }),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                }
            );
        } catch (error) {
            console.error("Error uploading recording:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            return new Response(
                JSON.stringify({ error: errorMessage }),
                {
                    status: errorMessage.includes("not found") ? 404 : 500,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }
    }),
});

export default http;