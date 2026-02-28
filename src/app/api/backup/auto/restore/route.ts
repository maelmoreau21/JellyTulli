import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { readFileSync, existsSync } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const BACKUP_DIR = process.env.BACKUP_DIR || "/data/backups";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { fileName } = await req.json();

        if (!fileName || typeof fileName !== "string") {
            return NextResponse.json({ error: "Nom de fichier invalide." }, { status: 400 });
        }

        // Security: prevent path traversal
        const sanitized = path.basename(fileName);
        const filePath = path.join(BACKUP_DIR, sanitized);

        if (!existsSync(filePath)) {
            return NextResponse.json({ error: "Fichier de sauvegarde introuvable." }, { status: 404 });
        }

        const raw = readFileSync(filePath, "utf-8");
        const backup = JSON.parse(raw);

        if (!backup.data) {
            return NextResponse.json({ error: "Format de sauvegarde invalide." }, { status: 400 });
        }

        const { users, media, playbackHistory, settings } = backup.data;

        // Restore using transaction
        await prisma.$transaction(async (tx) => {
            // Clear existing data
            await tx.playbackHistory.deleteMany();
            await tx.media.deleteMany();
            await tx.user.deleteMany();

            // Restore users
            if (users?.length > 0) {
                for (const u of users) {
                    await tx.user.create({
                        data: {
                            id: u.id,
                            jellyfinUserId: u.jellyfinUserId,
                            username: u.username,
                            createdAt: new Date(u.createdAt),
                        }
                    });
                }
            }

            // Restore media
            if (media?.length > 0) {
                for (const m of media) {
                    await tx.media.create({
                        data: {
                            id: m.id,
                            jellyfinMediaId: m.jellyfinMediaId,
                            title: m.title,
                            type: m.type,
                            createdAt: new Date(m.createdAt),
                        }
                    });
                }
            }

            // Restore playback history
            if (playbackHistory?.length > 0) {
                for (const ph of playbackHistory) {
                    await tx.playbackHistory.create({
                        data: {
                            id: ph.id,
                            userId: ph.userId,
                            mediaId: ph.mediaId,
                            startedAt: new Date(ph.startedAt),
                            endedAt: ph.endedAt ? new Date(ph.endedAt) : null,
                            durationWatched: ph.durationWatched,
                            playMethod: ph.playMethod,
                            clientName: ph.clientName,
                            deviceName: ph.deviceName,
                            ipAddress: ph.ipAddress,
                            country: ph.country,
                            city: ph.city,
                            audioCodec: ph.audioCodec,
                            audioLanguage: ph.audioLanguage,
                            subtitleCodec: ph.subtitleCodec,
                            subtitleLanguage: ph.subtitleLanguage,
                        }
                    });
                }
            }

            // Restore settings
            if (settings) {
                await tx.globalSettings.upsert({
                    where: { id: "global" },
                    update: {
                        jellyfinUrl: settings.jellyfinUrl,
                        jellyfinApiKey: settings.jellyfinApiKey,
                        discordWebhookUrl: settings.discordWebhookUrl,
                        discordAlertsEnabled: settings.discordAlertsEnabled,
                        discordAlertCondition: settings.discordAlertCondition,
                        excludedLibraries: settings.excludedLibraries,
                    },
                    create: {
                        id: "global",
                        jellyfinUrl: settings.jellyfinUrl,
                        jellyfinApiKey: settings.jellyfinApiKey,
                        discordWebhookUrl: settings.discordWebhookUrl,
                        discordAlertsEnabled: settings.discordAlertsEnabled,
                        discordAlertCondition: settings.discordAlertCondition,
                        excludedLibraries: settings.excludedLibraries,
                    }
                });
            }
        }, { timeout: 120000 });

        console.log(`[Auto-Backup Restore] Successfully restored from ${sanitized}`);
        return NextResponse.json({ success: true, message: `Restauration depuis ${sanitized} terminée avec succès.` });

    } catch (e: any) {
        console.error("[Auto-Backup Restore] Error:", e);
        return NextResponse.json({ error: e.message || "Erreur lors de la restauration." }, { status: 500 });
    }
}
