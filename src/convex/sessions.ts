import { query } from "convex/server";

// List recent automation sessions for the current user (or all if unauthenticated).
// Returns a lightweight shape for sidebar rendering.
export const list = query(async ({ db, auth }) => {
    // If you later add auth, you can filter by userId here.
    // const identity = await auth.getUserIdentity();

    // Order by creation time descending; Convex supports ordering on _creationTime.
    const sessions = await db
        .query("sessions")
        .order("desc")
        .take(25);

    return sessions.map((s: any) => ({
        _id: s._id,
        title: s.title ?? "Untitled session",
        createdAt: s.createdAt ?? s._creationTime,
    }));
});


