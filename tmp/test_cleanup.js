const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testCleanup() {
  try {
    console.log("--- Setup: Creating a stale ActiveStream ---");
    const user = await prisma.user.findFirst();
    const media = await prisma.media.findFirst();
    
    if (!user || !media) {
        console.error("Missing user or media to run test.");
        return;
    }

    const sessionId = "test-ghost-session-" + Date.now();
    const staleDate = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago

    const stream = await prisma.activeStream.create({
        data: {
            sessionId,
            userId: user.id,
            mediaId: media.id,
            playMethod: "DirectPlay",
            lastPingAt: staleDate
        }
    });
    console.log("Created stale stream:", stream.id);

    const history = await prisma.playbackHistory.create({
        data: {
            userId: user.id,
            mediaId: media.id,
            playMethod: "DirectPlay",
            startedAt: staleDate,
            endedAt: null
        }
    });
    console.log("Created open history:", history.id);

    console.log("\n--- Action: Running cleanupOrphanedSessions ---");
    // We can't easily import the TS function into this JS script without build
    // So we'll just check if the logic works when triggered by the app or wait
    // Actually, I'll just write the cleanup logic check here manually to verify Prisma works as expected
    
    const { cleanupOrphanedSessions } = require('../src/lib/cleanup'); // This might fail if not compiled
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
