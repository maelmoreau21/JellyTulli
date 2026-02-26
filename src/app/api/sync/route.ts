import { NextResponse } from "next/server";
import { syncJellyfinLibrary } from "@/lib/sync";

export async function POST() {
    try {
        // Déclenche la synchronisation manuellement
        const result = await syncJellyfinLibrary();

        if (result.success) {
            return NextResponse.json({
                status: "success",
                message: `Synchronisation terminée. ${result.users} utilisateurs et ${result.media} médias à jour.`
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
