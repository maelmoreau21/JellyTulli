import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { Readable } from "stream";
const JSONStream = require("JSONStream");

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Duck-Typing : détecte si un objet JSON ressemble à une session Jellystat.
 * Critère : possède UserId ET (NowPlayingItemId|ItemId) ET (PlayDuration|RunTimeTicks|DateCreated).
 */
function isSessionObject(obj: any): boolean {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
    const hasUserId = !!(obj.UserId || obj.userId);
    const hasItemId = !!(obj.NowPlayingItemId || obj.ItemId || obj.itemId || obj.mediaId);
    const hasActivity = !!(
        obj.PlayDuration || obj.playDuration ||
        obj.RunTimeTicks || obj.runTimeTicks ||
        obj.DateCreated || obj.dateCreated || obj.startedAt
    );
    return hasUserId && hasItemId && hasActivity;
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = req.body;
        if (!body) {
            return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });
        }

        const fileName = req.headers.get("x-file-name") || "unknown.json";
        const fileSize = req.headers.get("x-file-size");
        const sizeMb = fileSize ? (parseInt(fileSize) / 1024 / 1024).toFixed(2) : "?";
        console.log(`[Jellystat Import] Démarrage de l'import JSONStream deep-scan pour ${fileName} (${sizeMb} Mo)`);

        let importedSess = 0;
        let skipped = 0;
        let errors = 0;
        let processedCount = 0;
        const CHUNK_SIZE = 200;
        let currentChunk: any[] = [];

        // JSONStream.parse('..') recursively emits every object/value at any depth
        const nodeStream = Readable.fromWeb(body as any);
        const jsonStream = nodeStream.pipe(JSONStream.parse('..'));

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

                    const user = await prisma.user.upsert({
                        where: { jellyfinUserId },
                        update: {},
                        create: { jellyfinUserId, username }
                    });

                    const media = await prisma.media.upsert({
                        where: { jellyfinMediaId },
                        update: {},
                        create: { jellyfinMediaId, title: mediaTitle, type: mediaType }
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
                        where: { userId: user.id, mediaId: media.id, startedAt }
                    });

                    if (existingHistory) {
                        await prisma.playbackHistory.update({
                            where: { id: existingHistory.id },
                            data: { durationWatched, playMethod, clientName, deviceName }
                        });
                    } else {
                        await prisma.playbackHistory.create({
                            data: { userId: user.id, mediaId: media.id, playMethod, clientName, deviceName, durationWatched, startedAt }
                        });
                    }

                    importedSess++;
                } catch (err) {
                    errors++;
                    console.error("[Jellystat Import] Line error:", err);
                }
            }
        };

        // Use event-based 'data' with backpressure via pause/resume
        await new Promise<void>((resolve, reject) => {
            jsonStream.on("data", async (obj: any) => {
                processedCount++;

                if (isSessionObject(obj)) {
                    currentChunk.push(obj);
                } else {
                    skipped++;
                }

                if (currentChunk.length >= CHUNK_SIZE) {
                    jsonStream.pause();
                    try {
                        await processChunk(currentChunk);
                        currentChunk = [];
                        if (processedCount % 1000 === 0) {
                            console.log(`[Jellystat Import] Progress: ${processedCount} valeurs lues, ${importedSess} sessions importées...`);
                        }
                    } catch (err) {
                        reject(err);
                        return;
                    }
                    jsonStream.resume();
                }
            });

            jsonStream.on("end", async () => {
                try {
                    if (currentChunk.length > 0) {
                        await processChunk(currentChunk);
                    }
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });

            jsonStream.on("error", reject);
        });

        console.log(`[Jellystat Import] Terminé: ${importedSess} sessions importées, ${skipped} valeurs ignorées, ${errors} erreurs.`);

        return NextResponse.json({
            success: true,
            message: `Importation terminée. ${importedSess} sessions traitées (${skipped} valeurs ignorées, ${errors} erreurs).`
        }, { status: 200 });

    } catch (e: any) {
        console.error("[Jellystat Import] Failed:", e);
        return NextResponse.json({ error: e.message || "Erreur critique lors de l'import Jellystat." }, { status: 500 });
    }
}
