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

        // Helper: clean and label local IPs
        const resolveIp = (ip: string | null | undefined): string => {
            if (!ip) return "Réseau Local (Docker/LAN)";
            let cleaned = ip.trim();
            if (cleaned.includes("::ffff:")) cleaned = cleaned.split("::ffff:")[1];
            if (cleaned === "::1" || cleaned.startsWith("127.0.0") || cleaned.startsWith("172.") || cleaned.startsWith("10.") || cleaned.startsWith("192.168.")) {
                return "Réseau Local (Docker/LAN)";
            }
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
            // JellyTulli gère traditionnellement la fin de lecture via Monitor / Playback Reporting.
            // Le webhook pourrait insérer directement dans PlaybackHistory s'il est configuré pour remonter la durée.
        }

        return NextResponse.json({ success: true, message: `Événement ${eventType} traité.` });
    } catch (error) {
        console.error("[Webhook Error]:", error);
        return NextResponse.json({ error: "Erreur serveur HTTP 500" }, { status: 500 });
    }
}
