import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";

export const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_SITE_URL || 
             (typeof window !== "undefined" ? window.location.origin : "https://thebrowserarena.com"),
    plugins: [convexClient()],
});