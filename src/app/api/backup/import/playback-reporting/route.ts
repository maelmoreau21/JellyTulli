import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function parseCSVLine(text: string): string[] {
    const re = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
    return text.split(re).map(val => val.replace(/^"|"$/g, '').trim());
}

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
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");

        if (lines.length <= 1) {
            return NextResponse.json({ error: "Le fichier CSV est vide ou invalide." }, { status: 400 });
        }

        // Playback reporting CSV generally has headers.
        const headers = parseCSVLine(lines[0]);

        // Find essential indices
        const userIdIdx = headers.findIndex(h => h.toLowerCase().includes("userid"));
        const userNameIdx = headers.findIndex(h => h.toLowerCase().includes("username") || h.toLowerCase() === "user");
        const itemIdIdx = headers.findIndex(h => h.toLowerCase().includes("itemid"));
        const itemNameIdx = headers.findIndex(h => h.toLowerCase().includes("itemname") || h.toLowerCase() === "item");
        const itemTypeIdx = headers.findIndex(h => h.toLowerCase().includes("itemtype"));

        const playMethodIdx = headers.findIndex(h => h.toLowerCase().includes("playmethod"));
        const clientNameIdx = headers.findIndex(h => h.toLowerCase().includes("clientname"));
        const deviceNameIdx = headers.findIndex(h => h.toLowerCase().includes("devicename"));
        const playDurationIdx = headers.findIndex(h => h.toLowerCase().includes("playduration"));
        const dateCreatedIdx = headers.findIndex(h => h.toLowerCase().includes("datecreated") || h.toLowerCase().includes("date"));

        if (userIdIdx === -1 || itemIdIdx === -1) {
            return NextResponse.json({ error: "Colonnes 'UserId' ou 'ItemId' introuvables. Vérifiez le format du CSV." }, { status: 400 });
        }

        let importedSess = 0;
        let errors = 0;

        const CHUNK_SIZE = 500;
        const dataLines = lines.slice(1);

        for (let i = 0; i < dataLines.length; i += CHUNK_SIZE) {
            const chunk = dataLines.slice(i, i + CHUNK_SIZE);

            for (const line of chunk) {
                try {
                    const row = parseCSVLine(line);

                    const jellyfinUserId = row[userIdIdx];
                    const username = userNameIdx !== -1 ? row[userNameIdx] : "Unknown User";
                    const jellyfinMediaId = row[itemIdIdx];
                    const mediaTitle = itemNameIdx !== -1 ? row[itemNameIdx] : "Unknown Media";
                    const mediaType = itemTypeIdx !== -1 ? (row[itemTypeIdx] || "Movie") : "Movie";

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

                    const playMethod = playMethodIdx !== -1 ? (row[playMethodIdx] || "DirectPlay") : "DirectPlay";
                    const clientName = clientNameIdx !== -1 ? (row[clientNameIdx] || "Playback Reporting") : "Playback Reporting";
                    const deviceName = deviceNameIdx !== -1 ? (row[deviceNameIdx] || "Unknown Device") : "Unknown Device";

                    let durationWatched = playDurationIdx !== -1 ? parseInt(row[playDurationIdx] || "0", 10) : 0;
                    if (durationWatched > 10000000) {
                        durationWatched = Math.floor(durationWatched / 10000000); // Ticks to seconds if necessary
                    }

                    let startedAt = new Date();
                    if (dateCreatedIdx !== -1 && row[dateCreatedIdx]) {
                        const parsedDate = new Date(row[dateCreatedIdx]);
                        if (!isNaN(parsedDate.getTime())) {
                            startedAt = parsedDate;
                        }
                    }

                    await prisma.playbackHistory.upsert({
                        where: {
                            userId_mediaId_startedAt: {
                                userId: user.id,
                                mediaId: media.id,
                                startedAt: startedAt,
                            }
                        },
                        update: {
                            durationWatched: durationWatched,
                            playMethod: playMethod,
                            clientName: clientName,
                            deviceName: deviceName,
                        },
                        create: {
                            userId: user.id,
                            mediaId: media.id,
                            startedAt: startedAt,
                            durationWatched: durationWatched,
                            playMethod: playMethod,
                            clientName: clientName,
                            deviceName: deviceName,
                        }
                    });

                    importedSess++;

                } catch (e) {
                    errors++;
                    console.error("[Playback Reporting Import] Line error", e);
                }
            }
        }

        return NextResponse.json({ message: `Importation terminée. ${importedSess} sessions ajoutées ou mises à jour (${errors} erreurs).` });

    } catch (error) {
        console.error("[Playback Reporting API] Error calling backend plugin:", error);
        return NextResponse.json({ error: "Erreur lors du traitement du fichier CSV." }, { status: 500 });
    }
}
