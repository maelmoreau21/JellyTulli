import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getGeoLocation } from "@/lib/geoip";

export async function POST(req: Request) {
    try {
        const payload = await req.json();

        // Type d'événement envoyé par le plugin Webhook de Jellyfin
        // ex: "PlaybackStart", "PlaybackStop", "PlaybackProgress", "ItemAdded"
        const eventType = payload.NotificationType || payload.Notification_Type || payload.Event;

        if (!eventType) {
            return NextResponse.json({ error: "Payload non reconnu." }, { status: 400 });
        }

        console.log(`[Webhook] Événement reçu: ${eventType}`);

        // Extract real client IP from proxy headers (Docker / reverse proxy)
        const forwardedFor = req.headers.get('x-forwarded-for');
        const realIpHeader = forwardedFor?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;

        // Helper: clean IPs — keep raw value, just strip IPv6-mapped prefix
        const resolveIp = (ip: string | null | undefined): string => {
            if (!ip) return "Unknown";
            let cleaned = ip.trim();
            if (cleaned.includes("::ffff:")) cleaned = cleaned.split("::ffff:")[1];
            return cleaned;
        };

        if (eventType === "PlaybackStart") {
            // Lecture des données du Webhook
            const jellyfinUserId = payload.UserId || payload.UserId || payload.User_Id;
            const username = payload.UserName || payload.Username || "Utilisateur Inconnu";
            const jellyfinMediaId = payload.ItemId || payload.Item_Id || payload.MediaId;
            const title = payload.Name || payload.Title || payload.ItemName || "Média Inconnu";
            const type = payload.ItemType || payload.Type || "Unknown";
            const clientName = payload.ClientName || payload.Client || "Inconnu";
            const deviceName = payload.DeviceName || payload.Device || "Inconnu";

            // Prefer real IP from proxy headers, then webhook payload, then fallback
            const ipAddress = resolveIp(realIpHeader || payload.IpAddress || payload.ClientIp);
            const geoData = getGeoLocation(ipAddress);

            if (!jellyfinUserId || !jellyfinMediaId) {
                return NextResponse.json({ message: "Données incomplètes (UserId ou ItemId manquant)" }, { status: 400 });
            }

            // 1. Mise à jour ou création de l'utilisateur
            await prisma.user.upsert({
                where: { jellyfinUserId: jellyfinUserId },
                update: { username },
                create: { jellyfinUserId, username }
            });

            // 2. Mise à jour ou création du média
            await prisma.media.upsert({
                where: { jellyfinMediaId: jellyfinMediaId },
                update: { title, type },
                create: { jellyfinMediaId, title, type }
            });

            // 3. Envoi de la notification Discord
            try {
                const settings = await prisma.globalSettings.findUnique({ where: { id: "global" } });

                if (settings?.discordAlertsEnabled && settings?.discordWebhookUrl) {
                    const condition = settings.discordAlertCondition || "ALL";
                    let shouldSend = true;

                    if (condition === "TRANSCODE_ONLY") {
                        shouldSend = payload.PlayMethod === "Transcode" || payload.IsTranscoding || false;
                    } else if (condition === "NEW_IP_ONLY") {
                        const pastIpCount = await prisma.playbackHistory.count({
                            where: { user: { jellyfinUserId: jellyfinUserId }, ipAddress: ipAddress }
                        });
                        shouldSend = pastIpCount === 0;
                    }

                    if (shouldSend) {
                        // Utilisation de notre API proxy interne pour sécuriser l'URL de l'image
                        // Note: on utilise des requêtes absolues si NEXTAUTH_URL est défini, sinon un fallback minimal
                        const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
                        const posterUrl = `${appUrl}/api/jellyfin/image?itemId=${jellyfinMediaId}&type=Primary`;

                        const discordPayload = {
                            embeds: [
                                {
                                    title: `🎬 Nouvelle lecture : ${title}`,
                                    color: 10181046, // Jellyfin Purple
                                    fields: [
                                        { name: "👤 Utilisateur", value: username, inline: true },
                                        { name: "📱 Appareil", value: `${clientName} (${deviceName})`, inline: true },
                                        { name: "🌍 Localisation", value: geoData.country !== "Unknown" ? `${geoData.city}, ${geoData.country}` : "Inconnue", inline: true }
                                    ],
                                    thumbnail: { url: posterUrl },
                                    timestamp: new Date().toISOString()
                                }
                            ]
                        };

                        await fetch(settings.discordWebhookUrl, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(discordPayload)
                        });
                        console.log(`[Webhook] Alerte Discord envoyée pour ${title}.`);
                    }
                }
            } catch (err) {
                console.error("[Webhook] Erreur lors de l'envoi Discord:", err);
            }
        }

        else if (eventType === "PlaybackStop") {
            console.log(`[Webhook] Fin de lecture interceptée.`);
            const jellyfinUserId = payload.UserId || payload.User_Id;
            const jellyfinMediaId = payload.ItemId || payload.Item_Id || payload.MediaId;
            const positionTicks = payload.PlaybackPositionTicks || payload.PositionTicks || 0;

            if (jellyfinUserId && jellyfinMediaId) {
                // Find the user and media internal IDs
                const user = await prisma.user.findUnique({ where: { jellyfinUserId } });
                const media = await prisma.media.findUnique({ where: { jellyfinMediaId } });

                if (user && media) {
                    const lastPlayback = await prisma.playbackHistory.findFirst({
                        where: { userId: user.id, mediaId: media.id, endedAt: null },
                        orderBy: { startedAt: 'desc' },
                    });

                    if (lastPlayback) {
                        const endedAt = new Date();
                        // Use position ticks if available (1 sec = 10M ticks)
                        let durationS: number;
                        if (positionTicks > 0) {
                            durationS = Math.floor(positionTicks / 10_000_000);
                        } else {
                            durationS = Math.floor((endedAt.getTime() - lastPlayback.startedAt.getTime()) / 1000);
                        }
                        await prisma.playbackHistory.update({
                            where: { id: lastPlayback.id },
                            data: { endedAt, durationWatched: durationS },
                        });
                        console.log(`[Webhook] PlaybackStop: Session ${lastPlayback.id} closed, duration=${durationS}s`);
                    }
                }
            }
        }

        else if (eventType === "PlaybackProgress") {
            const jellyfinUserId = payload.UserId || payload.User_Id;
            const jellyfinMediaId = payload.ItemId || payload.Item_Id || payload.MediaId;
            const isPaused = payload.IsPaused === true || payload.PlayState?.IsPaused === true;
            const currentAudioIndex = payload.PlayState?.AudioStreamIndex ?? payload.AudioStreamIndex;
            const currentSubIndex = payload.PlayState?.SubtitleStreamIndex ?? payload.SubtitleStreamIndex;

            if (jellyfinUserId && jellyfinMediaId) {
                const user = await prisma.user.findUnique({ where: { jellyfinUserId } });
                const media = await prisma.media.findUnique({ where: { jellyfinMediaId } });

                if (user && media) {
                    const lastPlayback = await prisma.playbackHistory.findFirst({
                        where: { userId: user.id, mediaId: media.id, endedAt: null },
                        orderBy: { startedAt: 'desc' },
                    });

                    if (lastPlayback) {
                        const updates: any = {};

                        // Track pause events: if currently paused and we track transitions
                        // We use a Redis key to store the previous pause state
                        const pauseKey = `pause:${lastPlayback.id}`;
                        const prevPauseState = await (await import("@/lib/redis")).default.get(pauseKey);
                        if (isPaused && prevPauseState !== "paused") {
                            updates.pauseCount = { increment: 1 };
                            await (await import("@/lib/redis")).default.setex(pauseKey, 3600, "paused");
                        } else if (!isPaused && prevPauseState === "paused") {
                            await (await import("@/lib/redis")).default.setex(pauseKey, 3600, "playing");
                        }

                        // Track audio/subtitle changes via Redis
                        const audioKey = `audio:${lastPlayback.id}`;
                        const subKey = `sub:${lastPlayback.id}`;
                        if (currentAudioIndex !== undefined && currentAudioIndex !== null) {
                            const prevAudio = await (await import("@/lib/redis")).default.get(audioKey);
                            if (prevAudio !== null && prevAudio !== String(currentAudioIndex)) {
                                updates.audioChanges = { increment: 1 };
                            }
                            await (await import("@/lib/redis")).default.setex(audioKey, 3600, String(currentAudioIndex));
                        }
                        if (currentSubIndex !== undefined && currentSubIndex !== null) {
                            const prevSub = await (await import("@/lib/redis")).default.get(subKey);
                            if (prevSub !== null && prevSub !== String(currentSubIndex)) {
                                updates.subtitleChanges = { increment: 1 };
                            }
                            await (await import("@/lib/redis")).default.setex(subKey, 3600, String(currentSubIndex));
                        }

                        if (Object.keys(updates).length > 0) {
                            await prisma.playbackHistory.update({
                                where: { id: lastPlayback.id },
                                data: updates,
                            });
                        }
                    }
                }
            }
        }

        return NextResponse.json({ success: true, message: `Événement ${eventType} traité.` });
    } catch (error) {
        console.error("[Webhook Error]:", error);
        return NextResponse.json({ error: "Erreur serveur HTTP 500" }, { status: 500 });
    }
}
