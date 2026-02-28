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
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });
        }

        // Use Buffer to read the full file reliably to prevent "Unterminated string in JSON" from next.js text limits
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const fileContent = buffer.toString('utf-8');

        let jsonData;
        try {
            jsonData = JSON.parse(fileContent);
        } catch (err: any) {
            console.error("[Jellystat Import] Failed to parse JSON", err);
            return NextResponse.json({ error: "Fichier JSON invalide. (JSON.parse failed)" }, { status: 400 });
        }

        const entries = Array.isArray(jsonData) ? jsonData : (jsonData.data || jsonData.result || []);

        if (entries.length === 0) {
            return NextResponse.json({ error: "Le fichier JSON est vide ou invalide." }, { status: 400 });
        }

        let importedSess = 0;
        let errors = 0;
        const CHUNK_SIZE = 500;

        for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
            const chunk = entries.slice(i, i + CHUNK_SIZE);

            for (const row of chunk) {
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

                    const startedAtStr = row.DateCreated || row.dateCreated || row.startedAt || new Date().toISOString();
                    const startedAt = new Date(startedAtStr);

                    // Re-using findFirst and update/create to avoid missing unique constraint errors on PlaybackHistory
                    const existingHistory = await prisma.playbackHistory.findFirst({
                        where: {
                            userId: user.id,
                            mediaId: media.id,
                            startedAt: startedAt,
                        }
                    });

                    if (existingHistory) {
                        await prisma.playbackHistory.update({
                            where: { id: existingHistory.id },
                            data: {
                                durationWatched: durationWatched,
                                playMethod: playMethod,
                                clientName: clientName,
                                deviceName: deviceName,
                            }
                        });
                    } else {
                        await prisma.playbackHistory.create({
                            data: {
                                userId: user.id,
                                mediaId: media.id,
                                playMethod: playMethod,
                                clientName: clientName,
                                deviceName: deviceName,
                                durationWatched: durationWatched,
                                startedAt: startedAt,
                            }
                        });
                    }

                    importedSess++;
                } catch (err) {
                    errors++;
                    console.error("[Jellystat Import] Line error:", err);
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: `Importation terminée. ${importedSess} sessions traitées (${errors} erreurs).`
        }, { status: 200 });

    } catch (e: any) {
        console.error("[Jellystat Import] Failed:", e);
        return NextResponse.json({ error: e.message || "Erreur critique lors de l'import Jellystat." }, { status: 500 });
    }
}
