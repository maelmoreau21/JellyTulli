import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();

        // Check if body is an array (Common for Jellystat exports which usually export playback data as list)
        const entries = Array.isArray(body) ? body : (body.data || body.PlaybackActivity || body.history || []);

        if (!entries || entries.length === 0) {
            return NextResponse.json({ error: "No valid data found in Jellystat JSON." }, { status: 400 });
        }

        let importedSess = 0;
        let errors = 0;

        for (const row of entries) {
            try {
                // Jellystat common fields mapping heuristics
                const jellyfinUserId = row.UserId || row.userId;
                const username = row.UserName || row.userName || "Unknown User";

                const jellyfinMediaId = row.NowPlayingItemId || row.ItemId || row.itemId || row.mediaId;
                const mediaTitle = row.ItemName || row.itemName || row.title || "Unknown Media";
                const mediaType = row.ItemType || row.itemType || row.type || "Movie";

                if (!jellyfinUserId || !jellyfinMediaId) {
                    continue; // Skip invalid records
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

                // Some jellystat versions export in ticks instead of seconds
                if (durationWatched > 10000000) {
                    durationWatched = Math.floor(durationWatched / 10000000); // Ticks to seconds
                }

                // If duration is missing, default to some reasonable parsing
                if (isNaN(durationWatched)) durationWatched = 0;

                const startedAt = row.DateCreated || row.dateCreated || row.startedAt || new Date().toISOString();

                await prisma.playbackHistory.create({
                    data: {
                        userId: user.id,
                        mediaId: media.id,
                        playMethod: playMethod,
                        clientName: clientName,
                        deviceName: deviceName,
                        durationWatched: durationWatched,
                        startedAt: new Date(startedAt),
                    }
                });

                importedSess++;
            } catch (err) {
                // Ignore single row errors to not crash the transaction
                errors++;
            }
        }

        return NextResponse.json({
            success: true,
            message: `Jellystat import completed. ${importedSess} sessions imported. ${errors} errors skipped.`
        }, { status: 200 });

    } catch (e: any) {
        console.error("[JellystatImport] Failed:", e);
        return NextResponse.json({ error: e.message || "Failed to process Jellystat JSON" }, { status: 500 });
    }
}
