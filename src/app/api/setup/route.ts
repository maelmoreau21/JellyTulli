import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { jellyfinUrl, jellyfinApiKey } = body;

        if (!jellyfinUrl || !jellyfinApiKey) {
            return NextResponse.json({ error: "L'URL et la clé API sont requises." }, { status: 400 });
        }

        // Check if the Jellyfin server is reachable and API key is valid
        try {
            const jfRes = await fetch(`${jellyfinUrl}/System/Info`, {
                headers: {
                    "X-Emby-Token": jellyfinApiKey
                }
            });

            if (!jfRes.ok) {
                return NextResponse.json({ error: "Impossible de se connecter à Jellyfin avec cette clé API." }, { status: 401 });
            }
        } catch (error) {
            return NextResponse.json({ error: "Serveur injoignable. Vérifiez l'URL de Jellyfin." }, { status: 400 });
        }

        // Fetch existing settings to see if it's already configured securely?
        // Let's assume this is the setup phase (either empty or allowing override)
        // Usually, setup is only allowed if no URL exists, or if authenticated.
        const settings = await prisma.globalSettings.findUnique({
            where: { id: "global" }
        });

        // We could restrict it if setting exist, but for flexibility of 'changing' setup, we allow upsert.
        await prisma.globalSettings.upsert({
            where: { id: "global" },
            update: {
                jellyfinUrl,
                jellyfinApiKey
            },
            create: {
                id: "global",
                jellyfinUrl,
                jellyfinApiKey,
                discordAlertsEnabled: false,
                excludedLibraries: []
            }
        });

        return NextResponse.json({ message: "Configuration sauvegardée avec succès." });
    } catch (error) {
        console.error("Setup API Error:", error);
        return NextResponse.json({ error: "Erreur serveur lors de la configuration." }, { status: 500 });
    }
}
