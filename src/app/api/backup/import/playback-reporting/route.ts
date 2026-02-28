import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import Papa from "papaparse";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
        }

        const text = await file.text();

        // Use PapaParse to safely traverse the CSV
        const parsed = Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true, // Attempts to parse numbers/booleans
        });

        if (parsed.errors.length > 0 && parsed.data.length === 0) {
            return NextResponse.json({ error: "CSV parsing failed." }, { status: 400 });
        }

        let importedSess = 0;
        let errors = 0;

        for (const row of parsed.data as any[]) {
            try {
                // Playback Reporting CSV Columns typical headers:
                // DateCreated, UserId, UserName, ItemId, ItemName, ItemType, PlayMethod, ClientName, DeviceName, PlayDuration
                const jellyfinUserId = row["UserId"] || row["User Id"] || row["userid"];
                const username = row["UserName"] || row["User Name"] || row["username"] || "Unknown User";

                const jellyfinMediaId = row["ItemId"] || row["Item Id"] || row["itemid"];
                const mediaTitle = row["ItemName"] || row["Item Name"] || row["itemname"] || "Unknown Media";
                const mediaType = row["ItemType"] || row["Item Type"] || row["itemtype"] || "Movie";

                if (!jellyfinUserId || !jellyfinMediaId) {
                    continue; // Skip invalid records without breaking the process
                }

                // Upsert User
                const user = await prisma.user.upsert({
                    where: { jellyfinUserId: String(jellyfinUserId) },
                    update: {},
                    create: {
                        jellyfinUserId: String(jellyfinUserId),
                        username: String(username),
                    }
                });

                // Upsert Media
                const media = await prisma.media.upsert({
                    where: { jellyfinMediaId: String(jellyfinMediaId) },
                    update: {},
                    create: {
                        jellyfinMediaId: String(jellyfinMediaId),
                        title: String(mediaTitle),
                        type: String(mediaType),
                    }
                });

                const playMethod = row["PlayMethod"] || row["Play Method"] || "DirectPlay";
                const clientName = row["ClientName"] || row["Client Name"] || "Playback Reporting";
                const deviceName = row["DeviceName"] || row["Device Name"] || "Unknown Device";

                let durationWatched = parseInt(row["PlayDuration"] || row["PlaybackDuration"] || "0");
                if (isNaN(durationWatched)) durationWatched = 0;

                if (durationWatched > 10000000) {
                    durationWatched = Math.floor(durationWatched / 10000000); // Ticks to seconds if necessary
                }

                const startedAt = row["DateCreated"] || row["Date"] || row["startedAt"] || new Date().toISOString();

                await prisma.playbackHistory.create({
                    data: {
                        userId: user.id,
                        mediaId: media.id,
                        playMethod: String(playMethod),
                        clientName: String(clientName),
                        deviceName: String(deviceName),
                        durationWatched: durationWatched,
                        startedAt: new Date(startedAt),
                    }
                });

                importedSess++;
            } catch (err) {
                errors++;
            }
        }

        return NextResponse.json({
            success: true,
            message: `Playback Reporting CSV import completed. ${importedSess} sessions imported. ${errors} errors skipped.`
        }, { status: 200 });

    } catch (e: any) {
        console.error("[PlaybackReportingImport] Failed:", e);
        return NextResponse.json({ error: e.message || "Failed to process PR CSV" }, { status: 500 });
    }
}
