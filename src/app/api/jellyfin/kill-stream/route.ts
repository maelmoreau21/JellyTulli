import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(req: NextRequest) {
    // Only allow authenticated users to kill a stream
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { sessionId } = await req.json();
        if (!sessionId) {
            return NextResponse.json({ error: "Session ID required" }, { status: 400 });
        }

        const baseUrl = process.env.JELLYFIN_URL;
        const apiKey = process.env.JELLYFIN_API_KEY;

        if (!baseUrl || !apiKey) {
            return NextResponse.json({ error: "JELLYFIN_URL ou JELLYFIN_API_KEY non configurées." }, { status: 500 });
        }

        // POST /Sessions/{sessionId}/Playing/Stop
        const jellyfinUrl = `${baseUrl}/Sessions/${sessionId}/Playing/Stop?api_key=${apiKey}`;
        const res = await fetch(jellyfinUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            }
        });

        if (!res.ok) {
            console.error("[KillStream] Failed to stop session:", res.status, await res.text());
            return NextResponse.json({ error: "Echec de l'arrêt du flux côté serveur Jellyfin." }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Flux arrêté avec succès." }, { status: 200 });
    } catch (e: any) {
        console.error("[KillStream] Exception:", e);
        return NextResponse.json({ error: e.message || "Erreur interne" }, { status: 500 });
    }
}
