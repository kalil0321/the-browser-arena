import { NextRequest, NextResponse } from "next/server";
import { getToken } from "@/lib/auth/server";
import { unauthorized } from "@/lib/http-errors";

// Python agent server URL
const AGENT_SERVER_URL = process.env.AGENT_SERVER_URL || "http://localhost:8080";

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

