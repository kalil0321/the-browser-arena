import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    // TODO: Fetch session data from database
    // For now, returning mock data
    const sessionData = {
      id,
      prompt: "Example task prompt",
      status: "pending",
      agents: [
        {
          id: "agent-1",
          name: "GPT-4",
          status: "initializing",
          steps: 0,
          time: 0,
        },
        {
          id: "agent-2",
          name: "Claude",
          status: "initializing",
          steps: 0,
          time: 0,
        },
      ],
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json(sessionData);
  } catch (error) {
    console.error("Error fetching session:", error);
    return NextResponse.json(
      { error: "Failed to fetch session" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    // TODO: Delete session from database
    // For now, just return success

    return NextResponse.json({
      success: true,
      message: "Session deleted",
    });
  } catch (error) {
    console.error("Error deleting session:", error);
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 }
    );
  }
}

