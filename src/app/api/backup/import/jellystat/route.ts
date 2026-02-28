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
 * Normalise toutes les clés d'un objet en minuscules pour supporter
 * toutes les variantes de casse (UserId, userId, user_id, etc.).
 */
function toLowerKeys(obj: any): Record<string, any> {
    return Object.keys(obj).reduce((acc: Record<string, any>, key) => {
        acc[key.toLowerCase()] = obj[key];
        return acc;
    }, {});
}

/**
 * Duck-Typing case-insensitive : détecte si un objet JSON ressemble à une session Jellystat.
 * Critère : possède userid ET (nowplayingitemid|itemid) ET (playduration|runtimeticks|datecreated).
 */
function isSessionObject(obj: any): boolean {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
    const lk = toLowerKeys(obj);
    const hasUserId = !!(lk.userid || lk.user_id);
    const hasItemId = !!(lk.nowplayingitemid || lk.itemid || lk.item_id || lk.mediaid || lk.media_id);
    const hasActivity = !!(
        lk.playduration || lk.play_duration ||
        lk.runtimeticks || lk.runtime_ticks ||
        lk.datecreated || lk.date_created || lk.startedat || lk.started_at
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
        let firstObjLogged = false;
        const CHUNK_SIZE = 200;
        let currentChunk: any[] = [];

        // JSONStream.parse('..') recursively emits every object/value at any depth
        const nodeStream = Readable.fromWeb(body as any);
        const jsonStream = nodeStream.pipe(JSONStream.parse('..'));

        const processChunk = async (chunk: any[]) => {
            for (const row of chunk) {
                try {
                    const lk = toLowerKeys(row);
                    const jellyfinUserId = lk.userid || lk.user_id;
                    const username = lk.username || lk.user_name || "Utilisateur Supprimé";

                    const jellyfinMediaId = lk.nowplayingitemid || lk.itemid || lk.item_id || lk.mediaid || lk.media_id;
                    const mediaTitle = lk.itemname || lk.item_name || lk.title || "Unknown Media";
                    const mediaType = lk.itemtype || lk.item_type || lk.type || "Movie";

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

                    const playMethod = lk.playmethod || lk.play_method || "DirectPlay";
                    const clientName = lk.client || lk.clientname || lk.client_name || "Jellystat Import";
                    const deviceName = lk.devicename || lk.device_name || "Unknown Device";
                    let durationWatched = parseInt(lk.playduration || lk.play_duration) || 0;

                    if (durationWatched > 10000000) {
                        durationWatched = Math.floor(durationWatched / 10000000);
                    }
                    if (isNaN(durationWatched)) durationWatched = 0;

                    const startedAtStr = lk.datecreated || lk.date_created || lk.startedat || lk.started_at || new Date().toISOString();
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

                // Diagnostic: log les clés du tout premier objet scanné
                if (!firstObjLogged && obj && typeof obj === "object" && !Array.isArray(obj)) {
                    console.log(`[Jellystat Import] Exemple d'objet trouvé:`, Object.keys(obj));
                    firstObjLogged = true;
                }

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

        // Cleanup: fix ghost users from previous imports
        const cleaned = await prisma.user.updateMany({
            where: { username: { in: ["Unknown User", "Unknown", "unknown"] } },
            data: { username: "Utilisateur Supprimé" }
        });
        if (cleaned.count > 0) {
            console.log(`[Jellystat Import] Nettoyage: ${cleaned.count} utilisateurs fantômes corrigés.`);
        }

        return NextResponse.json({
            success: true,
            message: `Importation terminée. ${importedSess} sessions traitées (${skipped} valeurs ignorées, ${errors} erreurs).`
        }, { status: 200 });

    } catch (e: any) {
        console.error("[Jellystat Import] Failed:", e);
        return NextResponse.json({ error: e.message || "Erreur critique lors de l'import Jellystat." }, { status: 500 });
    }
}
