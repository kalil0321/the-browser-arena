import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { authComponent, createAuth } from "./auth";
import { api } from "./_generated/api";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

/**
 * HTTP action to upload recording from Python backend
 * POST /upload-recording
 * Headers:
 *   - X-API-Key: Backend API key for authentication
 * Body: multipart/form-data with:
 *   - agentId: string (Convex agent ID)
 *   - file: binary (recording file)
 */
http.route({
    path: "/upload-recording",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
        try {
            // Authenticate using API key from header
            const apiKey = request.headers.get("X-API-Key");
            const expectedApiKey = process.env.BACKEND_API_KEY;
            
            if (!expectedApiKey) {
                console.error("BACKEND_API_KEY not configured");
                return new Response(
                    JSON.stringify({ error: "Server misconfigured" }),
                    {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    }
                );
            }
            
            if (!apiKey || apiKey !== expectedApiKey) {
                return new Response(
                    JSON.stringify({ error: "Unauthorized" }),
                    {
                        status: 401,
                        headers: { "Content-Type": "application/json" },
                    }
                );
            }

            const formData = await request.formData();
            const agentId = formData.get("agentId") as string;
            const file = formData.get("file") as File;

            if (!agentId) {
                return new Response(
                    JSON.stringify({ error: "Missing agentId" }),
                    {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    }
                );
            }

            if (!file) {
                return new Response(
                    JSON.stringify({ error: "Missing file" }),
                    {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    }
                );
            }

            // Validate file type - only allow video files
            const allowedTypes = ['video/mp4', 'video/webm'];
            if (!allowedTypes.includes(file.type)) {
                return new Response(
                    JSON.stringify({ 
                        error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}` 
                    }),
                    {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    }
                );
            }

            // Validate file size - maximum 100MB
            const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
            if (file.size > MAX_FILE_SIZE) {
                return new Response(
                    JSON.stringify({ 
                        error: `File too large. Maximum size: ${MAX_FILE_SIZE / (1024 * 1024)}MB` 
                    }),
                    {
                        status: 413,
                        headers: { "Content-Type": "application/json" },
                    }
                );
            }

            // Verify agent exists before allowing upload
            const agent = await ctx.runQuery(api.queries.getAgentById, {
                agentId: agentId as any,
            });
            if (!agent) {
                return new Response(
                    JSON.stringify({ error: "Agent not found" }),
                    {
                        status: 404,
                        headers: { "Content-Type": "application/json" },
                    }
                );
            }

            // Store file in Convex storage
            const storageId = await ctx.storage.store(file);

            // Generate URL for the stored file
            const recordingUrl = await ctx.storage.getUrl(storageId);

            // Update agent with recording URL
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
            // Don't expose internal error details to client
            const errorMessage = error instanceof Error ? error.message : String(error);
            const isNotFound = errorMessage.includes("not found");
            return new Response(
                JSON.stringify({ 
                    error: isNotFound ? "Agent not found" : "Internal server error" 
                }),
                {
                    status: isNotFound ? 404 : 500,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }
    }),
});

export default http;