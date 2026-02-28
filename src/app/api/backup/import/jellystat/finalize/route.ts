import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { existsSync, readdirSync, readFileSync, unlinkSync, rmdirSync } from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const UPLOAD_DIR = "/tmp/jellytulli-uploads";

/** Extraction brute-force Regex : extrait un champ string depuis un segment de texte JSON brut. */
function extractStr(segment: string, ...fields: string[]): string | null {
    for (const f of fields) {
        const m = segment.match(new RegExp(`"${f}"\\s*:\\s*"([^"]*)"`, "i"));
        if (m) return m[1];
    }
    return null;
}

/** Extraction brute-force Regex : extrait un champ numérique depuis un segment de texte JSON brut. */
function extractNum(segment: string, ...fields: string[]): number {
    for (const f of fields) {
        const m = segment.match(new RegExp(`"${f}"\\s*:\\s*(\\d+)`, "i"));
        if (m) return parseInt(m[1]);
    }
    return 0;
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

        console.log(`[Jellystat Finalize] Merged file created, starting brute-force regex import...`);

        // Lecture brute-force du fichier mergé
        const rawText = readFileSync(mergedPath, "utf-8");
        console.log(`[Jellystat Finalize] Fichier mergé: ${(rawText.length / 1024 / 1024).toFixed(2)} Mo`);

        const uidRegex = /"(?:UserId|userid|user_id)"\s*:\s*"([^"]+)"/gi;
        let uidMatch: RegExpExecArray | null;
        let importedSess = 0;
        let skipped = 0;
        let errors = 0;
        let totalFound = 0;
        const BATCH = 200;
        let batch: any[] = [];

        const processBatch = async (items: any[]) => {
            for (const s of items) {
                try {
                    const user = await prisma.user.upsert({
                        where: { jellyfinUserId: s.userId },
                        update: {},
                        create: { jellyfinUserId: s.userId, username: s.username },
                    });
                    const media = await prisma.media.upsert({
                        where: { jellyfinMediaId: s.itemId },
                        update: {},
                        create: { jellyfinMediaId: s.itemId, title: s.title, type: s.type },
                    });
                    const existing = await prisma.playbackHistory.findFirst({
                        where: { userId: user.id, mediaId: media.id, startedAt: s.startedAt },
                    });
                    if (existing) {
                        await prisma.playbackHistory.update({
                            where: { id: existing.id },
                            data: { durationWatched: s.duration, playMethod: s.playMethod, clientName: s.client, deviceName: s.device },
                        });
                    } else {
                        await prisma.playbackHistory.create({
                            data: { userId: user.id, mediaId: media.id, playMethod: s.playMethod, clientName: s.client, deviceName: s.device, durationWatched: s.duration, startedAt: s.startedAt },
                        });
                    }
                    importedSess++;
                } catch (err) {
                    errors++;
                    if (errors <= 3) console.error("[Jellystat Finalize] Erreur ligne:", err);
                }
            }
        };

        while ((uidMatch = uidRegex.exec(rawText)) !== null) {
            const userId = uidMatch[1];
            const pos = uidMatch.index;

            let open = pos;
            while (open > 0 && rawText[open] !== "{") open--;
            let close = pos;
            while (close < rawText.length && rawText[close] !== "}") close++;
            const window = rawText.substring(open, close + 1);

            const itemId = extractStr(window, "NowPlayingItemId", "ItemId", "itemid", "item_id", "MediaId", "mediaid", "media_id");
            if (!itemId) { skipped++; continue; }

            totalFound++;
            if (totalFound === 1) console.log(`[Jellystat Finalize] 1re session:`, window.substring(0, 500));

            const username = extractStr(window, "UserName", "username", "user_name") || "Utilisateur Supprimé";
            const title = extractStr(window, "NowPlayingItemName", "ItemName", "itemname", "item_name", "Title", "title") || "Unknown Media";
            const type = extractStr(window, "ItemType", "itemtype", "item_type", "Type", "type") || "Movie";
            let duration = extractNum(window, "PlayDuration", "play_duration", "playduration");
            if (duration > 10_000_000) duration = Math.floor(duration / 10_000_000);
            const dateStr = extractStr(window, "DateCreated", "date_created", "datecreated", "StartedAt", "started_at", "startedat") || new Date().toISOString();
            const playMethod = extractStr(window, "PlayMethod", "play_method", "playmethod") || "DirectPlay";
            const client = extractStr(window, "Client", "ClientName", "client_name", "clientname") || "Jellystat Import";
            const device = extractStr(window, "DeviceName", "device_name", "devicename") || "Unknown Device";

            batch.push({ userId, itemId, username, title, type, duration, startedAt: new Date(dateStr), playMethod, client, device });

            if (batch.length >= BATCH) {
                await processBatch(batch);
                batch = [];
                if (totalFound % 1000 === 0) console.log(`[Jellystat Finalize] Progress: ${totalFound} trouvées, ${importedSess} importées...`);
            }
        }

        if (batch.length > 0) await processBatch(batch);

        console.log(`[Jellystat Finalize] Terminé: ${importedSess} sessions, ${skipped} ignorés, ${errors} erreurs (${totalFound} regex).`);

        // Cleanup: fix ghost users from previous imports
        const cleaned = await prisma.user.updateMany({
            where: { username: { in: ["Unknown User", "Unknown", "unknown"] } },
            data: { username: "Utilisateur Supprimé" }
        });
        if (cleaned.count > 0) {
            console.log(`[Jellystat Finalize] Nettoyage: ${cleaned.count} utilisateurs fantômes corrigés.`);
        }

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
            message: `Import brute-force terminé. ${importedSess} sessions (${skipped} ignorés, ${errors} erreurs).`,
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
