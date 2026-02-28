import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Allow 5 minutes of execution for large APIs

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { jellystatUrl, jellystatApiKey } = await req.json();

        if (!jellystatUrl || !jellystatApiKey) {
            return NextResponse.json({ error: "L'URL et la clé API Jellystat sont obligatoires." }, { status: 400 });
        }

        // Clean trailing slashes and /api if present so we can append predictably
        const baseUrl = jellystatUrl.replace(/\/api\/?$/, "").replace(/\/+$/, "");

        // Setup headers
        const headers = {
            "x-api-token": jellystatApiKey, // Assuming Jellystat uses this header. Sometimes it's Authorization: Bearer
            "Content-Type": "application/json"
        };

        // First, check if connection works by calling a basic endpoint
        const testRes = await fetch(`${baseUrl}/api/getUsers`, { headers });
        if (!testRes.ok) {
            const errText = await testRes.text();
            console.error("[Jellystat] API /getUsers error:", testRes.status, errText);
            return NextResponse.json({ error: "Impossible de se connecter à Jellystat. Vérifiez l'URL ou la clé API." }, { status: 400 });
        }

        const usersData = await testRes.json();
        const usersArray = Array.isArray(usersData) ? usersData : [];
        let importedSess = 0;
        let errors = 0;

        // Since Jellystat API structure varies, we'll try to fetch playback data via their /api/getPlays endpoint or similar.
        // If not standard, you might have to adjust the endpoint path.
        let skip = 0;
        const take = 500; // Batch size
        let hasMore = true;

        while (hasMore) {
            // e.g: GET /api/getPlays?skip=0&take=500 -> Adapt this endpoint if Jellystat exposes history differently.
            const historyRes = await fetch(`${baseUrl}/api/getPlays?skip=${skip}&take=${take}`, { headers });

            if (!historyRes.ok) {
                const errText = await historyRes.text();
                console.error("[Jellystat] API /getPlays error:", historyRes.status, errText);
                if (historyRes.status === 404) {
                    throw new Error("L'endpoint /api/getPlays n'existe pas ou la structure API de Jellystat a changé.");
                }
                break;
            }

            const historyBatch = await historyRes.json();
            const entries = Array.isArray(historyBatch) ? historyBatch : (historyBatch.data || historyBatch.result || []);

            if (entries.length === 0) {
                hasMore = false;
                break;
            }

            // Mappages et Upsert par Batch pour ce lot
            for (const row of entries) {
                try {
                    const jellyfinUserId = row.UserId || row.userId;
                    const username = row.UserName || row.userName || "Unknown User";

                    const jellyfinMediaId = row.NowPlayingItemId || row.ItemId || row.itemId || row.mediaId;
                    const mediaTitle = row.ItemName || row.itemName || row.title || "Unknown Media";
                    const mediaType = row.ItemType || row.itemType || row.type || "Movie";

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

                    const playMethod = row.PlayMethod || row.playMethod || "DirectPlay";
                    const clientName = row.Client || row.client || "Jellystat Import";
                    const deviceName = row.DeviceName || row.deviceName || "Unknown Device";
                    let durationWatched = parseInt(row.PlayDuration || row.playDuration) || 0;

                    if (durationWatched > 10000000) {
                        durationWatched = Math.floor(durationWatched / 10000000);
                    }

                    if (isNaN(durationWatched)) durationWatched = 0;

                    const startedAt = row.DateCreated || row.dateCreated || row.startedAt || new Date().toISOString();

                    await prisma.playbackHistory.create({
                        data: {
                            userId: user.id,
                            mediaId: media.id,
                            playMethod: playMethod,
                            clientName: clientName,
                            deviceName: deviceName,
                            durationWatched: durationWatched,
                            startedAt: new Date(startedAt),
                        }
                    });

                    importedSess++;
                } catch (err) {
                    errors++;
                }
            }

            // Si moins d'éléments reçus que le blocksize, c'était la dernière page
            if (entries.length < take) {
                hasMore = false;
            } else {
                skip += take;
            }
        }

        return NextResponse.json({
            success: true,
            message: `Synchronisation Jellystat terminée. ${importedSess} sessions importées par API distante.`
        }, { status: 200 });

    } catch (e: any) {
        console.error("[JellystatAPISync] Failed:", e);
        return NextResponse.json({ error: e.message || "Failed to sync with Jellystat API" }, { status: 500 });
    }
}
