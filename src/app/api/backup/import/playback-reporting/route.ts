import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await prisma.globalSettings.findUnique({ where: { id: "global" } });
    const JELLYFIN_URL = settings?.jellyfinUrl?.replace(/\/+$/, '');
    const API_KEY = settings?.jellyfinApiKey;

    if (!JELLYFIN_URL || !API_KEY) {
        return NextResponse.json({ error: "Le serveur Jellyfin n'est pas configuré. Rendez-vous dans les Paramètres." }, { status: 500 });
    }

    try {
        // The Plugin Playback Reporting exposes data via its own API on Jellyfin.
        // Known structure: /PlaybackReporting/ReportData?api_key=XXX -> but it's often a heavy JSON payload directly
        // Some users access it as an sqlite DB, but if it has JSON endpoints:

        const prUrl = `${JELLYFIN_URL}/PlaybackReporting/ReportData`;

        let importedSess = 0;
        let errors = 0;

        // Fetching Playback Reporting might return everything in one massive array since the plugin doesn't natively expose good pagination
        // However, we stream it securely here locally into our Next.js backend and process in memory chunks instead of blowing up the client browser.
        const res = await fetch(prUrl, {
            headers: {
                "X-Emby-Token": API_KEY,
                "Content-Type": "application/json"
            }
        });

        if (!res.ok) {
            return NextResponse.json({ error: "Impossible de joindre le plugin Playback Reporting sur le serveur Jellyfin. Vérifiez qu'il est bien installé." }, { status: 400 });
        }

        const data = await res.json();
        const entries = Array.isArray(data) ? data : (data.Items || []);

        if (entries.length === 0) {
            return NextResponse.json({ error: "Aucune donnée trouvée dans Playback Reporting." }, { status: 400 });
        }

        // Processing via memory chunks to avoid Prisma transaction blocking issues
        const CHUNK_SIZE = 500;

        for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
            const chunk = entries.slice(i, i + CHUNK_SIZE);

            for (const row of chunk) {
                try {
                    // Playback Reporting internal keys
                    const jellyfinUserId = row.UserId;
                    const username = row.UserName || "Unknown User";

                    const jellyfinMediaId = row.ItemId;
                    const mediaTitle = row.ItemName || "Unknown Media";
                    const mediaType = row.ItemType || "Movie";

                    if (!jellyfinUserId || !jellyfinMediaId) {
                        continue;
                    }

                    // Upsert User
                    const user = await prisma.user.upsert({
                        where: { jellyfinUserId: jellyfinUserId },
                        update: {},
                        create: {
                            jellyfinUserId: jellyfinUserId,
                            username: username,
                        }
                    });

                    // Upsert Media
                    const media = await prisma.media.upsert({
                        where: { jellyfinMediaId: jellyfinMediaId },
                        update: {},
                        create: {
                            jellyfinMediaId: jellyfinMediaId,
                            title: mediaTitle,
                            type: mediaType,
                        }
                    });

                    const playMethod = row.PlayMethod || "DirectPlay";
                    const clientName = row.ClientName || "Playback Reporting";
                    const deviceName = row.DeviceName || "Unknown Device";

                    let durationWatched = parseInt(row.PlayDuration || "0");
                    if (durationWatched > 10000000) {
                        durationWatched = Math.floor(durationWatched / 10000000); // Ticks to seconds if necessary
                    }
                    if (isNaN(durationWatched)) durationWatched = 0;

                    const startedAt = row.DateCreated || new Date().toISOString();

                    await prisma.playbackHistory.create({
                        data: {
                            userId: user.id,
                            mediaId: media.id,
                            playMethod: String(playMethod),
                            clientName: String(clientName),
                            deviceName: String(deviceName),
                            durationWatched: durationWatched,
                            startedAt: new Date(startedAt),
                        }
                    });

                    importedSess++;
                } catch (err) {
                    errors++;
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: `Synchronisation Playback Reporting terminée. ${importedSess} sessions ajoutées en local.`
        }, { status: 200 });

    } catch (e: any) {
        console.error("[PR APISync] Failed:", e);
        return NextResponse.json({ error: e.message || "Echec de connexion à Playback Reporting API" }, { status: 500 });
    }
}
