import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import Papa from "papaparse";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

        const text = await file.text();

        // Detect delimiter based on file extension (.tsv → tab, else auto-detect)
        const isTsv = file.name?.toLowerCase().endsWith(".tsv");
        const delimiterConfig = isTsv ? "\t" : undefined;
        console.log(`[Playback Reporting Import] Fichier: ${file.name}, TSV détecté: ${isTsv}, délimiteur forcé: ${isTsv ? "TAB" : "auto"}`);

        // Parse CSV/TSV with PapaParse
        const parsed = Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
            delimiter: delimiterConfig,
        });

        // Log detected headers for debugging column mapping
        console.log("[Playback Reporting Import] Headers trouvés:", parsed.meta.fields);

        if (parsed.errors.length > 0) {
            console.warn("[Playback Reporting Import] PapaParse errors:", parsed.errors.slice(0, 5));
        }

        const rows = parsed.data as any[];
        console.log(`[Playback Reporting Import] Lignes parsées: ${rows.length}`);

        if (!rows || rows.length === 0) {
            return NextResponse.json({ error: "Le fichier CSV/TSV est vide ou invalide. Vérifiez le format du fichier." }, { status: 400 });
        }

        let importedSess = 0;
        let errors = 0;

        const CHUNK_SIZE = 500;

        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
            const chunk = rows.slice(i, i + CHUNK_SIZE);

            for (const row of chunk) {
                try {
                    // Case-insensitive column lookup helper
                    const get = (r: any, ...keys: string[]) => {
                        for (const key of keys) {
                            if (r[key] !== undefined && r[key] !== null && r[key] !== "") return r[key];
                        }
                        // Fallback: case-insensitive search
                        const rowKeys = Object.keys(r);
                        for (const key of keys) {
                            const found = rowKeys.find(k => k.toLowerCase() === key.toLowerCase());
                            if (found && r[found] !== undefined && r[found] !== null && r[found] !== "") return r[found];
                        }
                        return undefined;
                    };

                    // Playback Reporting columns: Date, UserId, User, ItemId, ItemType, ItemName, PlaybackMethod, ClientName, DeviceName, PlayDuration
                    // Also supports "User Id", "Item Id", "Item Name" (spaced variants)
                    const jellyfinUserId = get(row, "UserId", "User Id", "userid");
                    const username = get(row, "User", "UserName", "User Name", "username") || "Unknown User";
                    const jellyfinMediaId = get(row, "ItemId", "Item Id", "itemid");
                    const mediaTitle = get(row, "ItemName", "Item Name", "ItemTitle", "Item", "itemname") || "Unknown Media";
                    const mediaType = get(row, "ItemType", "Item Type", "itemtype") || "Movie";

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

                    const playMethod = get(row, "PlaybackMethod", "PlayMethod", "Playback Method", "Play Method") || "DirectPlay";
                    const clientName = get(row, "ClientName", "Client Name", "Client") || "Playback Reporting";
                    const deviceName = get(row, "DeviceName", "Device Name", "Device") || "Unknown Device";

                    let durationWatched = parseInt(get(row, "PlayDuration", "Play Duration", "Duration") || "0", 10);
                    if (durationWatched > 10000000) {
                        durationWatched = Math.floor(durationWatched / 10000000); // Ticks to seconds if necessary
                    }

                    let startedAt = new Date();
                    const dateStr = get(row, "Date", "DateCreated", "Date Created", "StartDate");
                    if (dateStr) {
                        const parsedDate = new Date(dateStr);
                        if (!isNaN(parsedDate.getTime())) {
                            startedAt = parsedDate;
                        }
                    }

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
                                startedAt: startedAt,
                                durationWatched: durationWatched,
                                playMethod: playMethod,
                                clientName: clientName,
                                deviceName: deviceName,
                            }
                        });
                    }

                    importedSess++;

                } catch (e) {
                    errors++;
                    console.error("[Playback Reporting Import] Line error", e);
                }
            }
        }

        return NextResponse.json({ message: `Importation terminée. ${importedSess} sessions ajoutées ou mises à jour (${errors} erreurs).` });

    } catch (error) {
        console.error("[Playback Reporting API] Error fetching backend plugin:", error);
        return NextResponse.json({ error: "Erreur lors du traitement distant du CSV." }, { status: 500 });
    }
}
