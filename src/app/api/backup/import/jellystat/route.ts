import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { Readable } from "stream";
import { chain } from "stream-chain";
import { parser } from "stream-json";
import { streamArray } from "stream-json/streamers/StreamArray";

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

        console.log(`[Jellystat Import] Démarrage de l'import en flux pour ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} Mo)`);

        let importedSess = 0;
        let errors = 0;
        let processedCount = 0;
        const CHUNK_SIZE = 200;
        let currentChunk: any[] = [];

        // pipeline definitions
        const pipeline = chain([
            Readable.fromWeb(file.stream() as any),
            parser(),
            streamArray()
        ]);

        const processChunk = async (chunk: any[]) => {
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
        };

        // Standard for-await-of for streams
        for await (const data of pipeline) {
            currentChunk.push(data.value);
            processedCount++;

            if (currentChunk.length >= CHUNK_SIZE) {
                await processChunk(currentChunk);
                currentChunk = [];
                console.log(`[Jellystat Import] Progress: ${processedCount} sessions traitées...`);
            }
        }

        // Process final chunk
        if (currentChunk.length > 0) {
            await processChunk(currentChunk);
        }

        console.log(`[Jellystat Import] Terminé: ${importedSess} sessions importées, ${errors} erreurs.`);

        return NextResponse.json({
            success: true,
            message: `Importation terminée. ${importedSess} sessions traitées (${errors} erreurs).`
        }, { status: 200 });

    } catch (e: any) {
        console.error("[Jellystat Import] Failed:", e);
        return NextResponse.json({ error: e.message || "Erreur critique lors de l'import Jellystat." }, { status: 500 });
    }
}
