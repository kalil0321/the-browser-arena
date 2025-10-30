import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    // Get session from Better Auth
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    // If no session exists, create an anonymous user session
    let userId = session?.user?.id;
    if (!userId) {
      // This will be handled by Better Auth anonymous plugin
      // For now, we'll just generate a session ID
      console.log("No authenticated session found");
    }

    // Generate a unique session ID
    const sessionId = generateSessionId();

    // TODO: Store session data in database
    // For now, we're just returning the session ID
    // In production, you would:
    // 1. Save the prompt to database
    // 2. Link it to the user session
    // 3. Initialize the agent tasks
    // 4. Return the session ID

    return NextResponse.json({
      sessionId,
      prompt,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error creating session:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}

function generateSessionId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `${timestamp}-${random}`;
}

