import prisma from "../src/lib/prisma";
import { cleanupOrphanedSessions } from "../src/lib/cleanup";

async function testCleanup() {
    try {
        console.log("--- Setup: Creating a stale data ---");
        const user = await prisma.user.findFirst();
        const media = await prisma.media.findFirst();

        if (!user || !media) {
            console.error("Missing user or media to run test.");
            return;
        }

        const sessionId = "test-ghost-" + Date.now();
        const staleDate = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago

        // 1. Create a stale ActiveStream (heartbeat > 5m)
        await prisma.activeStream.create({
            data: {
                sessionId,
                userId: user.id,
                mediaId: media.id,
                playMethod: "DirectPlay",
                lastPingAt: staleDate
            }
        });

        // 2. Create an open PlaybackHistory
        const history = await prisma.playbackHistory.create({
            data: {
                userId: user.id,
                mediaId: media.id,
                playMethod: "DirectPlay",
                startedAt: staleDate,
                endedAt: null
            }
        });

        console.log("Stale data created. Running cleanup...");

        // 3. Run the actual cleanup function
        await cleanupOrphanedSessions();

        console.log("\n--- Verification ---");

        // 4. Verify ActiveStream is deleted
        const streamCheck = await prisma.activeStream.findUnique({ where: { sessionId } });
        console.log("ActiveStream deleted:", !streamCheck);

        // 5. Verify PlaybackHistory is ended
        const historyCheck = await prisma.playbackHistory.findUnique({ where: { id: history.id } });
        console.log("PlaybackHistory ended:", historyCheck?.endedAt !== null);
        console.log("Duration watched (seconds):", historyCheck?.durationWatched);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

testCleanup();
