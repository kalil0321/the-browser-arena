import { NextRequest, NextResponse } from "next/server";
import { getToken } from "@/lib/auth/server";
import { unauthorized } from "@/lib/http-errors";

// Python agent server URL
const AGENT_SERVER_URL = process.env.AGENT_SERVER_URL || "http://localhost:8080";

// Allowed file types for uploads
const ALLOWED_MIME_TYPES = [
    // PDFs
    "application/pdf",
    // Images
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    // Documents
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
    // Text files
    "text/plain",
    "text/csv",
    "text/html",
    "text/css",
    "text/javascript",
    "application/json",
    "application/xml",
    "text/xml",
];

const ALLOWED_EXTENSIONS = [
    ".pdf",
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".svg",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".txt",
    ".csv",
    ".html",
    ".htm",
    ".css",
    ".js",
    ".json",
    ".xml",
];

/**
 * Validates file type by checking both MIME type and file extension
 * If MIME type is present, it must be valid. Extension must always be valid.
 */
function isValidFileType(file: File): boolean {
    // Check file extension (required)
    const fileName = file.name.toLowerCase();
    const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) =>
        fileName.endsWith(ext.toLowerCase())
    );

    if (!hasValidExtension) {
        return false;
    }

    // If MIME type is provided, it must also be valid
    const mimeType = file.type.toLowerCase();
    if (mimeType) {
        const hasValidMimeType = ALLOWED_MIME_TYPES.some(
            (allowed) => mimeType === allowed.toLowerCase()
        );
        return hasValidMimeType;
    }

    // If no MIME type provided, extension validation is sufficient
    return true;
}

export async function POST(request: NextRequest) {
    try {
        // Get user token for auth
        const token = await getToken();
        if (!token) {
            return unauthorized();
        }

        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // Validate file type
        if (!isValidFileType(file)) {
            return NextResponse.json(
                {
                    error: "Invalid file type",
                    message: `File type "${file.type}" with extension "${file.name.split('.').pop()}" is not allowed. Allowed types: PDF, images, documents (Word, Excel, PowerPoint), text files, CSV, JSON, XML.`,
                },
                { status: 400 }
            );
        }

        // Forward file to Python server
        const agentServerApiKey = process.env.AGENT_SERVER_API_KEY;
        if (!agentServerApiKey) {
            return NextResponse.json({ error: "AGENT_SERVER_API_KEY is not configured" }, { status: 500 });
        }

        const pythonFormData = new FormData();
        pythonFormData.append('file', file);

        const response = await fetch(`${AGENT_SERVER_URL}/upload-file`, {
            method: 'POST',
            headers: {
                "Authorization": `Bearer ${agentServerApiKey}`,
            },
            body: pythonFormData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json(
                { error: `Python server error: ${errorText}` },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("❌ Error uploading file:", error);
        return NextResponse.json(
            {
                error: "Internal server error",
                message: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}

