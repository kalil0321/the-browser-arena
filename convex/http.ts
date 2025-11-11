import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { authComponent, createAuth } from "./auth";
import { api } from "./_generated/api";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

// Allowed video file types for recordings
const ALLOWED_VIDEO_MIME_TYPES = [
    "video/mp4",
    "video/webm",
    "video/quicktime", // .mov
    "video/x-msvideo", // .avi
    "video/x-matroska", // .mkv
];

const ALLOWED_VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".avi", ".mkv"];

/**
 * Validates video file type by checking both MIME type and file extension
 * If MIME type is present, it must be valid. Extension must always be valid.
 */
function isValidVideoFile(file: File): boolean {
    // Check file extension (required)
    const fileName = file.name.toLowerCase();
    const hasValidExtension = ALLOWED_VIDEO_EXTENSIONS.some((ext) =>
        fileName.endsWith(ext.toLowerCase())
    );

    if (!hasValidExtension) {
        return false;
    }

    // If MIME type is provided, it must also be valid
    const mimeType = file.type.toLowerCase();
    if (mimeType) {
        const hasValidMimeType = ALLOWED_VIDEO_MIME_TYPES.some(
            (allowed) => mimeType === allowed.toLowerCase()
        );
        return hasValidMimeType;
    }

    // If no MIME type provided, extension validation is sufficient
    return true;
}

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

            // Validate file type (must be a video file)
            if (!isValidVideoFile(file)) {
                return new Response(
                    JSON.stringify({
                        error: "Invalid file type",
                        message: `File type "${file.type}" with extension "${file.name.split('.').pop()}" is not allowed. Only video files (MP4, WebM, MOV, AVI, MKV) are allowed for recordings.`,
                    }),
                    {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    }
                );
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