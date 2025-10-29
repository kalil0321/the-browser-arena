import { after, NextRequest, NextResponse } from "next/server";
import { Stagehand } from "@browserbasehq/stagehand";
import AnchorBrowser from "anchorbrowser";

// Initialize the client
const browser = new AnchorBrowser({ apiKey: process.env.ANCHOR_API_KEY });

// For explicit headfull session configuration (optional, default to false)
const config = {
    browser: {
        headless: {
            active: false
        }
    }
};

const determineKey = (model: string | undefined) => {
    if (!model) {
        return process.env.GOOGLE_API_KEY;
    }
    const provider = model.split("/")[0];
    if (provider === "google") {
        return process.env.GOOGLE_API_KEY;
    }
    if (provider === "openai") {
        return process.env.OPENAI_API_KEY;
    }
    if (provider === "anthropic") {
        return process.env.ANTHROPIC_API_KEY;
    }

    return process.env.OPENAI_API_KEY;
}

export async function POST(request: NextRequest) {
    try {
        const { instruction, model } = await request.json();

        const session = await browser.sessions.create(config);
        const liveViewUrl = session.data?.live_view_url ?? "";
        const sessionId = session.data?.id ?? "";
        const cdpUrl = session.data?.cdp_url ?? "";

        if (!liveViewUrl) {
            console.error("❌ Failed to create session - no live_view_url");
            return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
        }

        if (!cdpUrl) {
            console.error("❌ Failed to create session - no cdp_url");
            return NextResponse.json({ error: "Failed to create session - missing cdp_url" }, { status: 500 });
        }

        const stagehand = new Stagehand({
            env: "LOCAL",
            modelName: model ?? "google/gemini-2.5-flash",
            modelClientOptions: {
                apiKey: determineKey(model),
            },
            localBrowserLaunchOptions: {
                cdpUrl: cdpUrl,
            },
        });

        after(async () => {
            try {
                await stagehand.init();
                const agent = await stagehand.agent();

                const { message, actions, usage } = await agent.execute({
                    highlightCursor: true,
                    instruction,
                });

                await stagehand.close();

                await browser.sessions.delete(sessionId);
                const {
                    duration
                } = await browser.sessions.retrieve(sessionId)

                const payload = {
                    usage,
                    duration,
                    message,
                    actions
                }

                console.log(JSON.stringify(payload, null, 2));
            } catch (error) {
                console.error("❌ Error in background execution:", error);
                try {
                    await browser.sessions.delete(sessionId);
                } catch (cleanupError) {
                    console.error("❌ Error cleaning up session:", cleanupError);
                }
            }
        });

        // return session object and live view url
        return NextResponse.json({
            session: {
                id: sessionId,
                liveViewUrl: liveViewUrl,
                cdpUrl: cdpUrl ? `${cdpUrl.substring(0, 50)}...` : "missing"
            },
            liveViewUrl: liveViewUrl,
        });
    } catch (error) {
        console.error("❌ Error in POST handler:", error);
        return NextResponse.json(
            {
                error: "Internal server error",
                message: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}