import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import { getGeoLocation } from "@/lib/geoip";

let isMonitoringStarted = false;
let monitorTimeoutId: ReturnType<typeof setTimeout> | null = null;
const POLL_INTERVAL_ACTIVE = 1000;   // 1s when sessions are active
const POLL_INTERVAL_IDLE   = 5000;   // 5s when idle

// Format IP Address (Jellyfin returns IPv6 or with port like "192.168.1.1:8096")
// We keep the raw IP (no more masking local IPs) for full visibility.
function cleanIpAddress(ip: string | undefined | null) {
    if (!ip) return "Unknown";
    let cleaned = ip.trim();
    // Strip IPv6-mapped prefix (::ffff:192.168.1.1)
    if (cleaned.includes("::ffff:")) cleaned = cleaned.split("::ffff:")[1];
    // Strip port for plain IPv4 (e.g. 192.168.1.1:8096)
    else if (cleaned.includes(":") && !cleaned.includes("::")) cleaned = cleaned.split(":")[0];
    return cleaned;
}

export async function startMonitoring() {
    if (isMonitoringStarted) return;
    isMonitoringStarted = true;

    console.log("[Monitor] Démarrage du polling autonome Jellyfin (adaptatif: 1s actif / 5s veille)...");

    // Startup cleanup: close all orphan ActiveStreams and their open PlaybackHistory entries
    // This handles app restarts where Redis state was lost but DB ActiveStreams persist
    try {
        const orphanStreams = await prisma.activeStream.findMany();
        if (orphanStreams.length > 0) {
            console.log(`[Monitor] Nettoyage au démarrage: ${orphanStreams.length} session(s) orpheline(s) trouvée(s).`);
            for (const orphan of orphanStreams) {
                const openPlayback = await prisma.playbackHistory.findFirst({
                    where: { userId: orphan.userId, mediaId: orphan.mediaId, endedAt: null },
                    orderBy: { startedAt: 'desc' },
                });
                if (openPlayback) {
                    const endedAt = new Date();
                    let durationS: number;
                    if (orphan.positionTicks && BigInt(orphan.positionTicks) > 0n) {
                        durationS = Math.floor(Number(BigInt(orphan.positionTicks)) / 10_000_000);
                    } else {
                        durationS = Math.floor((endedAt.getTime() - openPlayback.startedAt.getTime()) / 1000);
                    }
                    await prisma.playbackHistory.update({
                        where: { id: openPlayback.id },
                        data: { endedAt, durationWatched: durationS },
                    });
                }
                await prisma.activeStream.delete({ where: { id: orphan.id } });
                await redis.del(`stream:${orphan.sessionId}`);
            }
            console.log(`[Monitor] Nettoyage au démarrage terminé.`);
        }
    } catch (err) {
        console.error("[Monitor] Erreur nettoyage au démarrage:", err);
    }

    // Clear previous timeout if any (HMR safety)
    if (monitorTimeoutId) {
        clearTimeout(monitorTimeoutId);
    }

    // Adaptive polling loop: 1s with active sessions, 5s when idle
    async function scheduleNextPoll() {
        try {
            const hasActive = await pollJellyfinSessions();
            const interval = hasActive ? POLL_INTERVAL_ACTIVE : POLL_INTERVAL_IDLE;
            monitorTimeoutId = setTimeout(scheduleNextPoll, interval);
        } catch (error) {
            console.error("[Monitor] Erreur lors du polling:", error);
            monitorTimeoutId = setTimeout(scheduleNextPoll, POLL_INTERVAL_IDLE);
        }
    }
    scheduleNextPoll();
}

async function pollJellyfinSessions(): Promise<boolean> {
    const baseUrl = process.env.JELLYFIN_URL;
    const apiKey = process.env.JELLYFIN_API_KEY;

    if (!baseUrl || !apiKey) {
        console.warn("[Monitor] JELLYFIN_URL or JELLYFIN_API_KEY env vars missing.");
        return false;
    }

    const response = await fetch(`${baseUrl}/Sessions?api_key=${apiKey}`);
    if (!response.ok) return false;

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

        // Parent chain metadata (for enriched display: "Episode — Season — Series")
        const SeriesName = Item?.SeriesName || null;
        const SeasonName = Item?.SeasonName || null;
        const AlbumName = Item?.Album || null;
        const AlbumArtist = Item?.AlbumArtist || Item?.AlbumArtists?.[0] || null;
        const AlbumId = Item?.AlbumId || null;
        const SeriesId = Item?.SeriesId || null;
        const SeasonId = Item?.SeasonId || null;
        const RunTimeTicks = Item?.RunTimeTicks || null;

        const PlayState = session.PlayState;
        const PlayMethod = PlayState?.PlayMethod || "DirectPlay";
        const PlaybackPositionTicks = PlayState?.PositionTicks;

        const TranscodingInfo = session.TranscodingInfo;
        const VideoCodec = TranscodingInfo ? TranscodingInfo.VideoCodec : null;
        const AudioCodec = TranscodingInfo ? TranscodingInfo.AudioCodec : null;
        const TranscodeFps = TranscodingInfo ? TranscodingInfo.Framerate : null;
        const Bitrate = TranscodingInfo ? TranscodingInfo.Bitrate : null;

        // Telemetry: Audio & Subtitles Extraction + Resolution
        let AudioLanguage: string | null = null;
        let SubtitleLanguage: string | null = null;
        let SubtitleCodec: string | null = null;
        let DetectedResolution: string | null = null;

        if (session.NowPlayingItem && session.NowPlayingItem.MediaStreams) {
            const streams: any[] = session.NowPlayingItem.MediaStreams;
            // Native active streams are usually denoted by IsActive usually index matching PlayState.SubtitleStreamIndex/AudioStreamIndex
            const audioStreamIndex = PlayState?.AudioStreamIndex;
            const subtitleStreamIndex = PlayState?.SubtitleStreamIndex;

            if (audioStreamIndex !== undefined && audioStreamIndex !== null) {
                const audioStream = streams.find(s => s.Index === audioStreamIndex && s.Type === "Audio");
                if (audioStream) AudioLanguage = audioStream.Language || "Unknown";
            } else {
                // Fallback to first active audio
                const audioStream = streams.find(s => s.Type === "Audio" /* && s.IsDefault */);
                if (audioStream) AudioLanguage = audioStream.Language || "Unknown";
            }

            if (subtitleStreamIndex !== undefined && subtitleStreamIndex !== null && subtitleStreamIndex >= 0) {
                const subStream = streams.find(s => s.Index === subtitleStreamIndex && s.Type === "Subtitle");
                if (subStream) {
                    SubtitleLanguage = subStream.Language || "Unknown";
                    SubtitleCodec = subStream.Codec || "Unknown";
                }
            }

            // Extract video resolution from the stream (fills resolution for media that sync missed)
            const videoStream = streams.find((s: any) => s.Type === "Video");
            if (videoStream && videoStream.Width) {
                const w = videoStream.Width;
                if (w >= 3800) DetectedResolution = "4K";
                else if (w >= 1900) DetectedResolution = "1080p";
                else if (w >= 1200) DetectedResolution = "720p";
                else DetectedResolution = "SD";
            }
        }

        const isNew = !previousSessionIds.has(SessionId);

        // Detect item change within same session (e.g., auto-play next episode)
        let itemChanged = false;
        if (!isNew) {
            const redisData = await redis.get(`stream:${SessionId}`);
            if (redisData) {
                const prev = JSON.parse(redisData);
                if (prev.ItemId && prev.ItemId !== ItemId) {
                    itemChanged = true;
                    // Close the previous item's PlaybackHistory
                    const prevMedia = await prisma.media.findUnique({ where: { jellyfinMediaId: prev.ItemId } });
                    const prevUser = UserId ? await prisma.user.findUnique({ where: { jellyfinUserId: UserId } }) : null;
                    if (prevMedia && prevUser) {
                        const prevPlayback = await prisma.playbackHistory.findFirst({
                            where: { userId: prevUser.id, mediaId: prevMedia.id, endedAt: null },
                            orderBy: { startedAt: 'desc' },
                        });
                        if (prevPlayback) {
                            const endedAt = new Date();
                            // For item changes, always use wall clock duration
                            // (PlaybackPositionTicks belongs to the NEW item, not the old one)
                            const durationS = Math.floor((endedAt.getTime() - prevPlayback.startedAt.getTime()) / 1000);
                            await prisma.playbackHistory.update({
                                where: { id: prevPlayback.id },
                                data: { endedAt, durationWatched: durationS },
                            });
                            console.log(`[Monitor] Item changed in session ${SessionId}: closed ${prev.ItemId} (${durationS}s), now playing ${ItemId}`);
                        }
                    }
                }
            }
        }

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

        // Ensure Media exists in DB (and update resolution if we detected one from the stream)
        if (ItemId) {
            const updateData: any = { title: ItemName || "Unknown", type: ItemType || "Unknown" };
            if (DetectedResolution) updateData.resolution = DetectedResolution;
            await prisma.media.upsert({
                where: { jellyfinMediaId: ItemId },
                update: updateData,
                create: {
                    jellyfinMediaId: ItemId,
                    title: ItemName || "Unknown",
                    type: ItemType || "Unknown",
                    resolution: DetectedResolution,
                },
            });
        }

        // Compute GeoIP
        const geoData = getGeoLocation(IpAddress);

        // Redis Payload (enriched with parent chain + progress info)
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
            RunTimeTicks,
            IsPaused: PlayState?.IsPaused === true,
            SeriesName,
            SeasonName,
            AlbumName,
            AlbumArtist,
            AlbumId,
            SeriesId,
            SeasonId,
            Country: geoData.country,
            City: geoData.city,
        };

        // Cache for 60s (refreshed every 5s, extra margin prevents premature expiry)
        await redis.setex(`stream:${SessionId}`, 60, JSON.stringify(redisPayload));

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
                    audioLanguage: AudioLanguage,
                    subtitleCodec: SubtitleCodec,
                    subtitleLanguage: SubtitleLanguage,
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
                    audioLanguage: AudioLanguage,
                    subtitleCodec: SubtitleCodec,
                    subtitleLanguage: SubtitleLanguage,
                    transcodeFps: TranscodeFps ? parseFloat(TranscodeFps) : null,
                    bitrate: Bitrate ? parseInt(Bitrate, 10) : null,
                    positionTicks: PlaybackPositionTicks || null,
                    country: geoData.country,
                    city: geoData.city,
                },
            });
        }

        // Telemetry tracking for ongoing sessions (pause/audio/subtitle changes)
        if (!isNew && UserId && ItemId) {
            const user = await prisma.user.findUnique({ where: { jellyfinUserId: UserId } });
            const media = await prisma.media.findUnique({ where: { jellyfinMediaId: ItemId } });
            if (user && media) {
                const openPlayback = await prisma.playbackHistory.findFirst({
                    where: { userId: user.id, mediaId: media.id, endedAt: null },
                    orderBy: { startedAt: 'desc' },
                });
                if (openPlayback) {
                    const updates: any = {};
                    const isPaused = PlayState?.IsPaused === true;

                    // Track pause state transitions
                    const pauseKey = `pause:${openPlayback.id}`;
                    const prevPauseState = await redis.get(pauseKey);
                    if (isPaused && prevPauseState !== "paused") {
                        updates.pauseCount = { increment: 1 };
                        await redis.setex(pauseKey, 3600, "paused");
                    } else if (!isPaused && prevPauseState === "paused") {
                        await redis.setex(pauseKey, 3600, "playing");
                    }

                    // Track audio stream changes
                    const audioStreamIndex = PlayState?.AudioStreamIndex;
                    if (audioStreamIndex !== undefined && audioStreamIndex !== null) {
                        const audioKey = `audio:${openPlayback.id}`;
                        const prevAudio = await redis.get(audioKey);
                        if (prevAudio !== null && prevAudio !== String(audioStreamIndex)) {
                            updates.audioChanges = { increment: 1 };
                        }
                        await redis.setex(audioKey, 3600, String(audioStreamIndex));
                    }

                    // Track subtitle stream changes
                    const subtitleStreamIndex = PlayState?.SubtitleStreamIndex;
                    if (subtitleStreamIndex !== undefined && subtitleStreamIndex !== null) {
                        const subKey = `sub:${openPlayback.id}`;
                        const prevSub = await redis.get(subKey);
                        if (prevSub !== null && prevSub !== String(subtitleStreamIndex)) {
                            updates.subtitleChanges = { increment: 1 };
                        }
                        await redis.setex(subKey, 3600, String(subtitleStreamIndex));
                    }

                    if (Object.keys(updates).length > 0) {
                        await prisma.playbackHistory.update({
                            where: { id: openPlayback.id },
                            data: updates,
                        });
                    }
                }
            }
        }

        // Handle PlaybackStart Logic (new session or item changed within session)
        if ((isNew || itemChanged) && UserId && ItemId) {
            const pastIpCount = await prisma.playbackHistory.count({
                where: { user: { jellyfinUserId: UserId }, ipAddress: IpAddress }
            });
            const isNewIp = pastIpCount === 0;

            // Dedup guard: only create PlaybackHistory if no open session exists for this user+media
            // (the webhook PlaybackStart may have already created one)
            const user = await prisma.user.findUnique({ where: { jellyfinUserId: UserId } });
            const media = await prisma.media.findUnique({ where: { jellyfinMediaId: ItemId } });
            let alreadyExists = false;
            if (user && media) {
                const existingOpen = await prisma.playbackHistory.findFirst({
                    where: { userId: user.id, mediaId: media.id, endedAt: null },
                });
                alreadyExists = !!existingOpen;
            }

            if (!alreadyExists) {
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
                        audioCodec: AudioCodec,
                        audioLanguage: AudioLanguage,
                        subtitleCodec: SubtitleCodec,
                        subtitleLanguage: SubtitleLanguage,
                    },
                });
            }

            // Discord Notifications
            try {
                const settings = await prisma.globalSettings.findUnique({ where: { id: "global" } });
                const webhookUrl = settings?.discordWebhookUrl;
                const isEnabled = settings?.discordAlertsEnabled;
                const condition = settings?.discordAlertCondition || "ALL";

                let shouldSend = true;
                if (condition === "TRANSCODE_ONLY") {
                    shouldSend = PlayMethod === "Transcode";
                } else if (condition === "NEW_IP_ONLY") {
                    shouldSend = isNewIp;
                }

                if (isEnabled && webhookUrl && shouldSend) {
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
                    // Use positionTicks from the last known ActiveStream state if available
                    let durationS: number;
                    if (activeStream.positionTicks && BigInt(activeStream.positionTicks) > 0n) {
                        durationS = Math.floor(Number(BigInt(activeStream.positionTicks)) / 10_000_000);
                    } else {
                        durationS = Math.floor((endedAt.getTime() - lastPlayback.startedAt.getTime()) / 1000);
                    }
                    await prisma.playbackHistory.update({
                        where: { id: lastPlayback.id },
                        data: { endedAt, durationWatched: durationS },
                    });
                }
            }
        }
    }

    // Stale session cleanup: close ActiveStreams that haven't been updated in 2+ minutes
    // This catches orphan sessions from app restarts, network issues, etc.
    const staleThreshold = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
    const staleSessions = await prisma.activeStream.findMany({
        where: { lastPingAt: { lt: staleThreshold } }
    });

    for (const stale of staleSessions) {
        console.log(`[Monitor] Nettoyage session orpheline: ${stale.sessionId} (dernier ping: ${stale.lastPingAt.toISOString()})`);

        // Clean Redis key if it exists
        await redis.del(`stream:${stale.sessionId}`);

        // Close the open PlaybackHistory
        const openPlayback = await prisma.playbackHistory.findFirst({
            where: { userId: stale.userId, mediaId: stale.mediaId, endedAt: null },
            orderBy: { startedAt: 'desc' },
        });

        if (openPlayback) {
            const endedAt = new Date();
            let durationS: number;
            if (stale.positionTicks && BigInt(stale.positionTicks) > 0n) {
                durationS = Math.floor(Number(BigInt(stale.positionTicks)) / 10_000_000);
            } else {
                durationS = Math.floor((endedAt.getTime() - openPlayback.startedAt.getTime()) / 1000);
            }
            await prisma.playbackHistory.update({
                where: { id: openPlayback.id },
                data: { endedAt, durationWatched: durationS },
            });
        }

        // Delete the stale ActiveStream
        await prisma.activeStream.delete({ where: { id: stale.id } });
    }

    // Return whether there are active sessions (drives adaptive polling interval)
    return activeSessions.length > 0;
}
