import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { anonymous } from "better-auth/plugins";
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { betterAuth } from "better-auth";
import authSchema from "./betterAuth/schema";

const siteUrl = process.env.SITE_URL!;

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
export const authComponent = createClient<DataModel, typeof authSchema>(
    components.betterAuth,
    {
        local: {
            schema: authSchema,
        },
    }
);


export const createAuth = (
    ctx: GenericCtx<DataModel>,
    { optionsOnly } = { optionsOnly: false },
) => {
    return betterAuth({
        // disable logging when createAuth is called just to generate options.
        // this is not required, but there's a lot of noise in logs without it.
        logger: {
            disabled: optionsOnly,
        },
        baseURL: siteUrl,
        database: authComponent.adapter(ctx),
        // Configure simple, non-verified email/password to get started
        emailAndPassword: {
            enabled: true,
            requireEmailVerification: false,
        },
        plugins: [
            // The Convex plugin is required for Convex compatibility
            convex(),
            // Allow anonymous authentication
            anonymous({
                disableDeleteAnonymousUser: true,
            }),
        ],
    });
};

// Example function for getting the current user
// Feel free to edit, omit, etc.
export const getCurrentUser = query({
    args: {},
    handler: async (ctx) => {
        try {
            return await authComponent.getAuthUser(ctx);
        } catch (error) {
            // Return null if user is not authenticated
            return null;
        }
    },
});

// Helper function to get current user (can be called from mutations/queries)
export async function getUser(ctx: GenericCtx<DataModel>) {
    return authComponent.getAuthUser(ctx);
}