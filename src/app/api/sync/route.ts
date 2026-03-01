import { NextRequest, NextResponse } from "next/server";
import { syncJellyfinLibrary } from "@/lib/sync";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const recentOnly = body?.mode === 'recent';

        const result = await syncJellyfinLibrary({ recentOnly });

        if (result.success) {
            const modeLabel = recentOnly ? 'récente' : 'complète';
            return NextResponse.json({
                status: "success",
                message: `Synchronisation ${modeLabel} terminée. ${result.users} utilisateurs et ${result.media} médias à jour.`
            }, { status: 200 });
        } else {
            return NextResponse.json({
                status: "error",
                message: result.error
            }, { status: 500 });
        }
    } catch (e) {
        return NextResponse.json({ status: "error", message: "Erreur Serveur Interne" }, { status: 500 });
    }
}
