import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { createReadStream, existsSync, readdirSync, unlinkSync, rmdirSync } from "fs";
import path from "path";
const JSONStream = require("JSONStream");

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const UPLOAD_DIR = "/tmp/jellytulli-uploads";

/**
 * Duck-Typing : détecte si un objet JSON ressemble à une session Jellystat.
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

    let uploadPath = "";

    try {
        const body = await req.json();
        const { uploadId, totalChunks, fileName } = body;

        if (!uploadId) {
            return NextResponse.json({ error: "Missing upload ID" }, { status: 400 });
        }

        uploadPath = path.join(UPLOAD_DIR, uploadId);

        if (!existsSync(uploadPath)) {
            return NextResponse.json({ error: "Upload directory not found. Chunks may have expired." }, { status: 404 });
        }

        // Verify all chunks are present
        const chunkFiles = readdirSync(uploadPath).filter(f => f.startsWith("chunk-")).sort();
        console.log(`[Jellystat Finalize] Found ${chunkFiles.length}/${totalChunks} chunks for ${uploadId}`);

        if (chunkFiles.length < totalChunks) {
            return NextResponse.json({ 
                error: `Chunks manquants: ${chunkFiles.length}/${totalChunks} reçus.` 
            }, { status: 400 });
        }

        // Merge all chunks into a single file
        const mergedPath = path.join(uploadPath, "merged.json");
        const writeStream = require("fs").createWriteStream(mergedPath);
        
        for (const chunkFile of chunkFiles) {
            const chunkData = require("fs").readFileSync(path.join(uploadPath, chunkFile));
            writeStream.write(chunkData);
        }
        
        await new Promise<void>((resolve, reject) => {
            writeStream.end(() => resolve());
            writeStream.on("error", reject);
        });

        console.log(`[Jellystat Finalize] Merged file created, starting JSONStream deep-scan import...`);

        let importedSess = 0;
        let skipped = 0;
        let errors = 0;
        let processedCount = 0;
        const CHUNK_SIZE = 200;
        let currentChunk: any[] = [];

        const fileStream = createReadStream(mergedPath);
        const jsonStream = fileStream.pipe(JSONStream.parse('..'));

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
                    if (durationWatched > 10000000) durationWatched = Math.floor(durationWatched / 10000000);
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
                    console.error("[Jellystat Finalize] Line error:", err);
                }
            }
        };

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
                            console.log(`[Jellystat Finalize] Progress: ${processedCount} valeurs lues, ${importedSess} sessions importées...`);
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

        console.log(`[Jellystat Finalize] Terminé: ${importedSess} sessions importées, ${skipped} valeurs ignorées, ${errors} erreurs.`);

        // Cleanup temp files
        try {
            for (const f of readdirSync(uploadPath)) {
                unlinkSync(path.join(uploadPath, f));
            }
            rmdirSync(uploadPath);
        } catch (cleanupErr) {
            console.warn("[Jellystat Finalize] Cleanup warning:", cleanupErr);
        }

        return NextResponse.json({
            success: true,
            message: `Importation terminée. ${importedSess} sessions traitées (${skipped} valeurs ignorées, ${errors} erreurs).`
        });

    } catch (e: any) {
        console.error("[Jellystat Finalize] Failed:", e);
        // Attempt cleanup on error too
        try {
            if (uploadPath && existsSync(uploadPath)) {
                for (const f of readdirSync(uploadPath)) {
                    unlinkSync(path.join(uploadPath, f));
                }
                rmdirSync(uploadPath);
            }
        } catch {}
        return NextResponse.json({ error: e.message || "Erreur critique lors de la finalisation." }, { status: 500 });
    }
}
