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

    const settings = await prisma.globalSettings.findUnique({ where: { id: "global" } });
    const JELLYFIN_URL = settings?.jellyfinUrl?.replace(/\/+$/, '');
    const API_KEY = settings?.jellyfinApiKey;

    if (!JELLYFIN_URL || !API_KEY) {
        return NextResponse.json({ error: "Le serveur Jellyfin n'est pas configuré. Rendez-vous dans les Paramètres." }, { status: 500 });
    }

    try {
        const exportUrl = `${JELLYFIN_URL}/PlaybackReporting/Export`;
        const res = await fetch(exportUrl, {
            headers: {
                "X-Emby-Token": API_KEY,
            }
        });

        if (!res.ok) {
            return NextResponse.json({ error: "Impossible de générer l'export Playback Reporting depuis le serveur Jellyfin." }, { status: 400 });
        }

        const text = await res.text();

        // Parse CSV with PapaParse
        const parsed = Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
        });

        const rows = parsed.data as any[];

        if (!rows || rows.length === 0) {
            return NextResponse.json({ error: "Le fichier CSV est vide ou invalide." }, { status: 400 });
        }

        let importedSess = 0;
        let errors = 0;

        const CHUNK_SIZE = 500;

        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
            const chunk = rows.slice(i, i + CHUNK_SIZE);

            for (const row of chunk) {
                try {
                    // PapaParse keeps original header casing, we can make it case-insensitive by looking up keys or just match the known fields from PB Reporting
                    // Usually: Date,UserId,User,ItemId,ItemType,ItemName,PlaybackMethod,ClientName,DeviceName,PlayDuration
                    const jellyfinUserId = row["UserId"];
                    const username = row["User"] || row["UserName"] || "Unknown User";
                    const jellyfinMediaId = row["ItemId"];
                    const mediaTitle = row["ItemName"] || row["Item"] || "Unknown Media";
                    const mediaType = row["ItemType"] || "Movie";

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

                    const playMethod = row["PlaybackMethod"] || row["PlayMethod"] || "DirectPlay";
                    const clientName = row["ClientName"] || "Playback Reporting";
                    const deviceName = row["DeviceName"] || "Unknown Device";

                    let durationWatched = parseInt(row["PlayDuration"] || "0", 10);
                    if (durationWatched > 10000000) {
                        durationWatched = Math.floor(durationWatched / 10000000); // Ticks to seconds if necessary
                    }

                    let startedAt = new Date();
                    const dateStr = row["Date"] || row["DateCreated"];
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
