import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { getToken } from "@/lib/auth/server";
import { badRequest, serverMisconfigured, unauthorized, providerUnavailable } from "@/lib/http-errors";
import { computeBrowserCost, createBrowserSession } from "@/lib/browser";

// Create a lightweight session specifically for interactive browser profile usage
export async function POST(_request: NextRequest) {
    try {
        const token = await getToken();
        if (!token) {
            return unauthorized();
        }

        if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
            return serverMisconfigured("Missing NEXT_PUBLIC_CONVEX_URL");
        }

        const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
        convex.setAuth(token);

        // Ensure user exists (and to get user id for profile naming)
        const user = await convex.query(api.auth.getCurrentUser, {});
        if (!user) {
            return unauthorized();
        }

        // Prepare profile and timeouts
        const profileName = `profile-${user._id}`;

        // 10 minutes max, 3 minutes idle as specified
        const { liveViewUrl } = await createBrowserSession({
            session: {
                timeout: {
                    max_duration: 10,
                    idle_timeout: 3,
                },
                // Persist a per-user browser profile
                profile: {
                    name: profileName,
                    persist: true,
                },
            },
        } as any, { navBar: true });

        // Add usage cost: prorated for 10 minutes
        const cost = computeBrowserCost(10);
        await convex.mutation(api.mutations.addUsageCost, { cost });

        return NextResponse.json({ url: liveViewUrl }, { status: 200 });
    } catch (error: any) {
        // Normalize common error shapes
        const message = error?.message || "Failed to create profile session";
        return badRequest(message);
    }
}