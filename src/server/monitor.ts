import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import { getGeoLocation } from "@/lib/geoip";

let isMonitoringStarted = false;

// Format IP Address (Jellyfin returns IPv6 or with port like "192.168.1.1:8096")
function cleanIpAddress(ip: string | undefined | null) {
    if (!ip) return "127.0.0.1";
    // Si format IPv6 local (::ffff:192.168.1.1)
    if (ip.includes("::ffff:")) return ip.split("::ffff:")[1];
    // Sinon on nettoie le port éventuel si c'est de l'IPv4
    return ip.split(":")[0];
}

export async function startMonitoring() {
    if (isMonitoringStarted) return;
    isMonitoringStarted = true;

    console.log("[Monitor] Démarrage du polling autonome Jellyfin (5s)...");

    setInterval(async () => {
        try {
            await pollJellyfinSessions();
        } catch (error) {
            console.error("[Monitor] Erreur lors du polling:", error);
        }
    }, 5000);
}

async function pollJellyfinSessions() {
    const baseUrl = process.env.JELLYFIN_URL;
    const apiKey = process.env.JELLYFIN_API_KEY;

    if (!baseUrl || !apiKey) {
        console.warn("[Monitor] Jellyfin URL or API Key missing.");
        return;
    }

    const response = await fetch(`${baseUrl}/Sessions?api_key=${apiKey}`);
    if (!response.ok) return;

    const sessions = await response.json();

    // Only care about active playing sessions
    const activeSessions = sessions.filter((s: any) => s.NowPlayingItem && s.PlayState);

    // Fetch existing active streams from Redis to compute deltas
    const activeKeys = await redis.keys("stream:*");
    const activeRedisSessions = await Promise.all(activeKeys.map(k => redis.get(k)));

    const previousSessionIds = new Set(
        activeRedisSessions
            .filter((s): s is string => s !== null)
            .map(s => JSON.parse(s).SessionId)
    );

    const currentSessionIds = new Set(activeSessions.map((s: any) => s.Id));

    // Handle Start & Progress
    for (const session of activeSessions) {
        const SessionId = session.Id;
        const UserId = session.UserId;
        const UserName = session.UserName;
        const Item = session.NowPlayingItem;
        const ItemId = Item?.Id;
        const ItemName = Item?.Name;
        const ItemType = Item?.Type;
        const ClientName = session.Client;
        const DeviceName = session.DeviceName;
        const IpAddress = cleanIpAddress(session.RemoteEndPoint);

        const PlayState = session.PlayState;
        const PlayMethod = PlayState?.PlayMethod || "DirectPlay";
        const PlaybackPositionTicks = PlayState?.PositionTicks;

        const TranscodingInfo = session.TranscodingInfo;
        const VideoCodec = TranscodingInfo ? TranscodingInfo.VideoCodec : null;
        const AudioCodec = TranscodingInfo ? TranscodingInfo.AudioCodec : null;
        const TranscodeFps = TranscodingInfo ? TranscodingInfo.Framerate : null;
        const Bitrate = TranscodingInfo ? TranscodingInfo.Bitrate : null;

        const isNew = !previousSessionIds.has(SessionId);

        // Ensure User exists in DB
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

        // Ensure Media exists in DB
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

        // Compute GeoIP
        const geoData = getGeoLocation(IpAddress);

        // Redis Payload
        const redisPayload = {
            SessionId,
            UserId,
            UserName,
            ItemId,
            ItemName,
            ItemType,
            ClientName,
            DeviceName,
            IpAddress,
            PlayMethod,
            PlaybackPositionTicks,
            Country: geoData.country,
            City: geoData.city,
        };

        // Cache for 30s (will be refreshed every 5s anyway)
        await redis.setex(`stream:${SessionId}`, 30, JSON.stringify(redisPayload));

        // DB Upsert (Active Stream)
        if (UserId && ItemId) {
            await prisma.activeStream.upsert({
                where: { sessionId: SessionId },
                update: {
                    positionTicks: PlaybackPositionTicks || null,
                    playMethod: PlayMethod,
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
                    playMethod: PlayMethod,
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

        // Handle PlaybackStart Logic
        if (isNew && UserId && ItemId) {
            // New Session! Add to PlaybackHistory
            await prisma.playbackHistory.create({
                data: {
                    user: { connect: { jellyfinUserId: UserId } },
                    media: { connect: { jellyfinMediaId: ItemId } },
                    playMethod: PlayMethod,
                    clientName: ClientName,
                    deviceName: DeviceName,
                    ipAddress: IpAddress,
                    country: geoData.country,
                    city: geoData.city,
                },
            });

            // Discord Notifications
            try {
                const settings = await prisma.globalSettings.findUnique({ where: { id: "global" } });
                const webhookUrl = settings?.discordWebhookUrl || process.env.DISCORD_WEBHOOK_URL;
                const isEnabled = settings?.discordAlertsEnabled;

                if (isEnabled && webhookUrl) {
                    const posterUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/jellyfin/image?itemId=${ItemId}`;

                    const discordPayload = {
                        embeds: [
                            {
                                title: `🎬 Nouvelle lecture : ${ItemName || "Média inconnu"}`,
                                color: 10181046, // Jellyfin Purple
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
                console.error("[Monitor] Failed to send Discord webhook:", discordErr);
            }
        }
    }

    // Handle PlaybackStop (Sessions that disappeared)
    for (const previousSessionId of previousSessionIds) {
        if (!currentSessionIds.has(previousSessionId)) {
            // It stopped!
            await redis.del(`stream:${previousSessionId}`);

            // We need to find the related active stream in DB to know which User/Item to update
            const activeStream = await prisma.activeStream.findUnique({
                where: { sessionId: previousSessionId }
            });

            if (activeStream) {
                // Remove from ActiveStream
                await prisma.activeStream.delete({
                    where: { sessionId: previousSessionId },
                });

                // Update the PlaybackHistory with endedAt & durationWatched
                const lastPlayback = await prisma.playbackHistory.findFirst({
                    where: {
                        userId: activeStream.userId,
                        mediaId: activeStream.mediaId,
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
    }
}
