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

        // Detect delimiter: force TAB for .tsv files, auto-detect for .csv
        const isTsv = file.name?.toLowerCase().endsWith(".tsv");
        const delimiterConfig = isTsv ? "\t" : undefined;
        console.log(`[Playback Reporting Import] Fichier: ${file.name}, TSV détecté: ${isTsv}, délimiteur forcé: ${isTsv ? "TAB" : "auto"}`);

        // Parse with header: false — Playback Reporting exports have NO header row
        const parsed = Papa.parse(text, {
            header: false,
            skipEmptyLines: true,
            dynamicTyping: true,
            delimiter: delimiterConfig,
        });

        if (parsed.errors.length > 0) {
            console.warn("[Playback Reporting Import] PapaParse errors:", parsed.errors.slice(0, 5));
        }

        const rows = parsed.data as any[][];
        console.log(`[Playback Reporting Import] Lignes parsées: ${rows.length}`);
        if (rows.length > 0) {
            console.log("[Playback Reporting Import] Première ligne (sample):", rows[0]);
            console.log(`[Playback Reporting Import] Colonnes détectées: ${rows[0].length}`);
        }

        if (!rows || rows.length === 0) {
            return NextResponse.json({ error: "Le fichier TSV est vide ou invalide. Vérifiez le format du fichier." }, { status: 400 });
        }

        // Normalize UUID: Playback Reporting exports IDs without dashes (32 hex chars)
        // but Jellyfin stores them as standard UUID format (8-4-4-4-12)
        const normalizeUuid = (raw: string): string => {
            const clean = raw.trim().toLowerCase();
            // 32 hex chars without dashes → insert dashes (8-4-4-4-12)
            if (clean.length === 32 && /^[0-9a-f]{32}$/.test(clean)) {
                return clean.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
            }
            return clean;
        };

        let importedSess = 0;
        let errors = 0;
        let firstRowLogged = false;

        const CHUNK_SIZE = 500;

        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
            const chunk = rows.slice(i, i + CHUNK_SIZE);

            for (const row of chunk) {
                try {
                    // Playback Reporting TSV columns (no header row):
                    // [0]: Date  [1]: UserId  [2]: ItemId  [3]: ItemType  [4]: ItemName
                    // [5]: PlayMethod  [6]: ClientName  [7]: DeviceName  [8]: PlayDuration (seconds)
                    const dateStr = row[0];

                    // Strict UUID normalization: dashless lowercase → formatted with dashes
                    const rawUserId = String(row[1] || "").trim();
                    const rawId = rawUserId.toLowerCase().replace(/-/g, '');
                    const formattedUserId = rawId.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
                    const rawMediaId = String(row[2] || "").trim();
                    const jellyfinMediaId = normalizeUuid(rawMediaId);

                    if (!firstRowLogged) {
                        console.log(`[Playback Reporting Import] UUID normalization sample: "${rawUserId}" → "${formattedUserId}" | "${rawMediaId}" → "${jellyfinMediaId}"`);
                        firstRowLogged = true;
                    }

                    const mediaType = String(row[3] || "Movie").trim();
                    const mediaTitle = String(row[4] || "Unknown Media").trim();
                    const playMethod = String(row[5] || "DirectPlay").trim();
                    const clientName = String(row[6] || "Playback Reporting").trim();
                    const deviceName = String(row[7] || "Unknown Device").trim();

                    let durationWatched = parseInt(String(row[8] || "0"), 10);
                    if (isNaN(durationWatched)) durationWatched = 0;
                    if (durationWatched > 10000000) {
                        durationWatched = Math.floor(durationWatched / 10000000); // Ticks to seconds if necessary
                    }

                    if (!jellyfinMediaId || !formattedUserId || rawId.length < 32) {
                        continue;
                    }

                    // Force-upsert user — always create if unknown
                    const user = await prisma.user.upsert({
                        where: { jellyfinUserId: formattedUserId },
                        update: {},
                        create: { jellyfinUserId: formattedUserId, username: "Utilisateur Supprimé TSV" },
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

                    let startedAt = new Date();
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

                    const endedAt = durationWatched > 0 ? new Date(startedAt.getTime() + durationWatched * 1000) : null;

                    if (existingHistory) {
                        await prisma.playbackHistory.update({
                            where: { id: existingHistory.id },
                            data: {
                                durationWatched: durationWatched,
                                playMethod: playMethod,
                                clientName: clientName,
                                deviceName: deviceName,
                                endedAt: endedAt,
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
                                endedAt: endedAt,
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

        // Cleanup: fix ghost users from previous imports that used "Unknown User"
        const cleaned = await prisma.user.updateMany({
            where: { username: { in: ["Unknown User", "Unknown", "unknown"] } },
            data: { username: "Utilisateur Supprimé" }
        });
        if (cleaned.count > 0) {
            console.log(`[Playback Reporting Import] Nettoyage: ${cleaned.count} utilisateurs fantômes corrigés.`);
        }

        return NextResponse.json({ message: `Importation terminée. ${importedSess} sessions ajoutées ou mises à jour (${errors} erreurs).${cleaned.count > 0 ? ` ${cleaned.count} utilisateurs fantômes corrigés.` : ""}` });

    } catch (error) {
        console.error("[Playback Reporting API] Error:", error);
        return NextResponse.json({ error: "Erreur lors du traitement du fichier TSV/CSV." }, { status: 500 });
    }
}
