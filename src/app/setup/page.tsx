import { redirect } from "next/navigation";

// The /setup wizard was removed in Phase 31. All config is via environment variables.
// This page exists only to redirect stale links/bookmarks.
export default function SetupRedirect() {
    redirect("/");
}
