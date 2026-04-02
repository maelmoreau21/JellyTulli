import { requireAdmin, isAuthError } from "@/lib/auth";
import PluginHealthCenterClient from "./PluginHealthCenterClient";

export const dynamic = "force-dynamic";

export default async function PluginHealthPage() {
    const auth = await requireAdmin();
    if (isAuthError(auth)) return auth;

    return <PluginHealthCenterClient />;
}
