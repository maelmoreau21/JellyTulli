import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import { getGeoLocation } from "@/lib/geoip";

export const dynamic = "force-dynamic";

// Webhook Jellyfin attendu
// Permet de forcer la route en mode dynamique et éviter les erreurs de compilation statiques Next.js (SSG) liées à Redis ou Prisma
export async function GET(req: NextRequest) {
    return NextResponse.json({ status: "webhook listening" }, { status: 200 });
}

export async function POST(req: NextRequest) {
    try {
        const payload = await req.json();

        const {
            NotificationType,
            SessionId,
            UserId,
            ItemId,
            ItemName,
            ItemType,
            ClientName,
            DeviceName,
            IpAddress,
            PlayMethod,
            PlaybackPositionTicks,
            VideoCodec,
            AudioCodec,
            TranscodeFps,
            Bitrate,
            UserName,
        } = payload;

        // Seuls les événements de lecture nous intéressent ici
        const validEvents = ["PlaybackStart", "PlaybackProgress", "PlaybackStop"];
        if (!validEvents.includes(NotificationType)) {
            return NextResponse.json({ status: "ignored event" }, { status: 200 });
        }

        // Upsert générique de l'utilisateur (pour lier la DB sans synchro préalable complète)
        if (UserId) {
            await prisma.user.upsert({
                where: { jellyfinUserId: UserId },
                update: { username: UserName || "Unknown" },
                create: {
                    jellyfinUserId: UserId,
                    username: UserName || "Unknown",
                },
            });
        }

        // Upsert du média (simplifié pour l'exemple)
        if (ItemId) {
            await prisma.media.upsert({
                where: { jellyfinMediaId: ItemId },
                update: { title: ItemName || "Unknown", type: ItemType || "Unknown" },
                create: {
                    jellyfinMediaId: ItemId,
                    title: ItemName || "Unknown",
                    type: ItemType || "Unknown",
                },
            });
        }

        // Gestion de l'état du flux actif selon l'événement
        if (NotificationType === "PlaybackStart" || NotificationType === "PlaybackProgress") {
            const geoData = getGeoLocation(IpAddress);

            // Stockage temps réel dans Redis étendu avec GeoIP
            const redisPayload = {
                ...payload,
                Country: geoData.country,
                City: geoData.city,
            };

            await redis.setex(`stream:${SessionId}`, 180, JSON.stringify(redisPayload));

            if (UserId && ItemId) {
                // Sauvegarde DB pour ActiveStream
                await prisma.activeStream.upsert({
                    where: { sessionId: SessionId },
                    update: {
                        positionTicks: PlaybackPositionTicks || null,
                        playMethod: PlayMethod || "Unknown",
                        lastPingAt: new Date(),
                        videoCodec: VideoCodec,
                        audioCodec: AudioCodec,
                        transcodeFps: TranscodeFps ? parseFloat(TranscodeFps) : null,
                        bitrate: Bitrate ? parseInt(Bitrate, 10) : null,
                        country: geoData.country,
                        city: geoData.city,
                    },
                    create: {
                        sessionId: SessionId,
                        user: { connect: { jellyfinUserId: UserId } },
                        media: { connect: { jellyfinMediaId: ItemId } },
                        playMethod: PlayMethod || "Unknown",
                        clientName: ClientName,
                        deviceName: DeviceName,
                        ipAddress: IpAddress,
                        videoCodec: VideoCodec,
                        audioCodec: AudioCodec,
                        transcodeFps: TranscodeFps ? parseFloat(TranscodeFps) : null,
                        bitrate: Bitrate ? parseInt(Bitrate, 10) : null,
                        positionTicks: PlaybackPositionTicks || null,
                        country: geoData.country,
                        city: geoData.city,
                    },
                });
            }
        } else if (NotificationType === "PlaybackStop") {
            // Suppression du flux actif
            await redis.del(`stream:${SessionId}`);
            try {
                await prisma.activeStream.delete({
                    where: { sessionId: SessionId },
                });
            } catch (e) {
                // Le flux a peut-être déjà été supprimé ou jamais créé en bd
                console.warn("Could not delete missing active stream:", SessionId);
            }

            // Historisation (PlaybackHistory) : Si on avait besoin, on calcule ici ou au start
            // Note: Idealement, un enregistrement PlaybackHistory est créé au Start, et mis à jour (endedAt) au Stop.
            if (UserId && ItemId) {
                // On trouvera la dernière entrée de lecture non terminée pour cette session / user
                const lastPlayback = await prisma.playbackHistory.findFirst({
                    where: {
                        user: { jellyfinUserId: UserId },
                        media: { jellyfinMediaId: ItemId },
                        endedAt: null,
                    },
                    orderBy: { startedAt: 'desc' },
                });

                if (lastPlayback) {
                    const endedAt = new Date();
                    const durationS = Math.floor((endedAt.getTime() - lastPlayback.startedAt.getTime()) / 1000);
                    await prisma.playbackHistory.update({
                        where: { id: lastPlayback.id },
                        data: { endedAt, durationWatched: durationS },
                    });
                }
            }
        }

        // Gestion du PlaybackStart pour l'historique étendu avec GeoIP
        if (NotificationType === "PlaybackStart" && UserId && ItemId) {
            const geoData = getGeoLocation(IpAddress);

            await prisma.playbackHistory.create({
                data: {
                    user: { connect: { jellyfinUserId: UserId } },
                    media: { connect: { jellyfinMediaId: ItemId } },
                    playMethod: PlayMethod || "Unknown",
                    clientName: ClientName,
                    deviceName: DeviceName,
                    ipAddress: IpAddress,
                    country: geoData.country,
                    city: geoData.city,
                },
            });

            // --- Notifications Discord ---
            try {
                // Fetch settings
                const settings = await prisma.globalSettings.findUnique({ where: { id: "global" } });
                const webhookUrl = settings?.discordWebhookUrl || process.env.DISCORD_WEBHOOK_URL;
                const isEnabled = settings?.discordAlertsEnabled;

                if (isEnabled && webhookUrl) {
                    const posterUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/jellyfin/image?itemId=${ItemId}`;

                    const discordPayload = {
                        embeds: [
                            {
                                title: `🎬 Nouvelle lecture : ${ItemName || "Média inconnu"}`,
                                color: 10181046, // Jellyfin Purple/Blue approx #9B59B6
                                fields: [
                                    { name: "👤 Utilisateur", value: UserName || "Inconnu", inline: true },
                                    { name: "📱 Appareil", value: `${ClientName || "Inconnu"} (${DeviceName || "Inconnu"})`, inline: true },
                                    { name: "🌍 Localisation", value: geoData.country !== "Unknown" ? `${geoData.city}, ${geoData.country}` : "Inconnue", inline: true },
                                    { name: "⚙️ Qualité", value: PlayMethod || "Inconnue", inline: true }
                                ],
                                thumbnail: { url: posterUrl },
                                timestamp: new Date().toISOString()
                            }
                        ]
                    };

                    await fetch(webhookUrl, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(discordPayload)
                    });
                }
            } catch (discordErr) {
                console.error("Failed to send Discord webhook:", discordErr);
            }
            // ------------------------------
        }

        return NextResponse.json({ status: "success" }, { status: 200 });
    } catch (error) {
        console.error("Webhook processing error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
