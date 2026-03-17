import prisma from "@/lib/prisma";
import { appendHealthEvent } from "@/lib/systemHealth";

/**
 * Robust utility to close orphaned playback sessions.
 * 
 * Logic:
 * 1. Fetch all PlaybackHistory where endedAt is null.
 * 2. Match them against ActiveStream (current live sessions).
 * 3. Close any history entry that:
 *    - Has no corresponding ActiveStream.
 *    - OR is older than 24 hours (sanity check for ghosts).
 * 4. Cap durationWatched at a maximum (24h).
 */
export async function cleanupOrphanedSessions() {
    const ORPHAN_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours (backstop)
    const HEARTBEAT_TIMEOUT_MS = 5 * 60 * 1000;      // 5 minutes (stale stream)
    const now = new Date();

    try {
        // 1. First, cleanup ActiveStream records that haven't sent a heartbeat recently
        const staleThreshold = new Date(now.getTime() - HEARTBEAT_TIMEOUT_MS);
        const staleStreams = await prisma.activeStream.findMany({
            where: { lastPingAt: { lt: staleThreshold } },
            select: { id: true, sessionId: true, media: { select: { title: true } } }
        });

        if (staleStreams.length > 0) {
            console.log(`[Cleanup] Found ${staleStreams.length} stale streams (no heartbeat for 5+ mins).`);
            for (const stream of staleStreams) {
                console.log(`[Cleanup] Removing ghost stream: ${stream.sessionId} ("${stream.media?.title || 'Unknown'}")`);
                // Note: We delete them. The loop below will then close the corresponding PlaybackHistory 
                // because they will no longer have a matching ActiveStream.
                await prisma.activeStream.delete({ where: { id: stream.id } });
            }
        }

        // 2. Now cleanup PlaybackHistory where endedAt is null but no ActiveStream exists
        const openPlaybacks = await prisma.playbackHistory.findMany({
            where: { endedAt: null },
            select: {
                id: true,
                startedAt: true,
                userId: true,
                mediaId: true,
                media: { select: { title: true } }
            }
        });

        if (openPlaybacks.length === 0) return;

        // Fetch remaining active streams
        const activeStreams = await prisma.activeStream.findMany({
            select: { userId: true, mediaId: true }
        });

        // Use a set of user:media pairs for quick lookup
        const activePairs = new Set(activeStreams.map(s => `${s.userId}:${s.mediaId}`));

        let closedCount = 0;

        for (const playback of openPlaybacks) {
            const ageMs = now.getTime() - playback.startedAt.getTime();
            
            // Check if this specific user+media pair still has an active stream
            const isActive = activePairs.has(`${playback.userId}:${playback.mediaId}`);

            // Close if not active OR way too old (24h backstop)
            if (!isActive || ageMs > ORPHAN_THRESHOLD_MS) {
                const endedAt = ageMs > ORPHAN_THRESHOLD_MS 
                    ? new Date(playback.startedAt.getTime() + ORPHAN_THRESHOLD_MS) 
                    : now;
                
                const wallDurationS = Math.floor((endedAt.getTime() - playback.startedAt.getTime()) / 1000);
                
                // If it was just removed as a stale stream, we might still have the position in ActiveStream
                // (but we deleted it above). For simplicity in ghost cleanup, we use wall clock or cap.
                let durationS = Math.max(0, Math.min(wallDurationS, 86400));

                await prisma.playbackHistory.update({
                    where: { id: playback.id },
                    data: {
                        endedAt,
                        durationWatched: durationS
                    }
                });

                closedCount++;
                console.log(`[Cleanup] Closed orphaned history ${playback.id} for "${playback.media?.title || 'Unknown'}"`);
            }
        }

        if (closedCount > 0 || staleStreams.length > 0) {
            await appendHealthEvent({
                source: 'monitor',
                kind: 'orphan-cleanup',
                message: `Nettoyage : ${staleStreams.length} flux fantômes supprimés, ${closedCount} lectures fermées.`,
                details: { staleStreams: staleStreams.length, closedHistory: closedCount }
            });
        }

    } catch (err: any) {
        console.error("[Cleanup] Error during orphaned session cleanup:", err);
    }
}
