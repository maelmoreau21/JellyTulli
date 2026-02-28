'use server';

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { Readable } from "stream";
import { chain } from "stream-chain";
import { parser } from "stream-json";
import { streamArray } from "stream-json/streamers/StreamArray";

/**
 * Server Action for Jellystat JSON import.
 * Unlike Route Handlers, Server Actions respect the `bodySizeLimit: '500mb'`
 * setting from next.config.ts, allowing uploads well beyond 10MB.
 */
export async function importJellystatAction(formData: FormData): Promise<{ success?: boolean; message?: string; error?: string }> {
    const session = await getServerSession(authOptions);
    if (!session) {
        return { error: "Non autorisé. Veuillez vous reconnecter." };
    }

    try {
        const file = formData.get("file") as File | null;
        if (!file) {
            return { error: "Aucun fichier fourni." };
        }

        console.log(`[Jellystat Import] Démarrage de l'import en flux pour ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} Mo)`);

        let importedSess = 0;
        let errors = 0;
        let processedCount = 0;
        const CHUNK_SIZE = 200;
        let currentChunk: any[] = [];

        // Stream the File blob through stream-json for incremental parsing
        const nodeStream = Readable.fromWeb(file.stream() as any);
        const pipeline = chain([
            nodeStream,
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

        // Incremental stream processing — processes 200 records at a time
        for await (const data of pipeline) {
            currentChunk.push(data.value);
            processedCount++;

            if (currentChunk.length >= CHUNK_SIZE) {
                await processChunk(currentChunk);
                currentChunk = [];
                console.log(`[Jellystat Import] Progress: ${processedCount} sessions traitées...`);
            }
        }

        // Process remaining records
        if (currentChunk.length > 0) {
            await processChunk(currentChunk);
        }

        console.log(`[Jellystat Import] Terminé: ${importedSess} sessions importées, ${errors} erreurs.`);

        return {
            success: true,
            message: `Importation terminée. ${importedSess} sessions traitées (${errors} erreurs).`
        };

    } catch (e: any) {
        console.error("[Jellystat Import] Failed:", e);
        return { error: e.message || "Erreur critique lors de l'import Jellystat." };
    }
}
