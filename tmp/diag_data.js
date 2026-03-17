
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    console.log("--- Checking Media Items ---");
    const mediaCount = await prisma.media.count();
    console.log(`Total Media: ${mediaCount}`);

    const resolutions = await prisma.media.groupBy({
      by: ['resolution'],
      _count: { id: true }
    });
    console.log("Resolutions in Media table:", resolutions);

    const missingResolution = await prisma.media.findMany({
      where: { resolution: null },
      take: 5,
      select: { title: true, type: true }
    });
    console.log("Samples with missing resolution:", missingResolution);

    console.log("\n--- Checking Playback History ---");
    const historyCount = await prisma.playbackHistory.count();
    console.log(`Total History: ${historyCount}`);

    const audioLangs = await prisma.playbackHistory.groupBy({
      by: ['audioLanguage'],
      _count: { id: true }
    });
    console.log("Audio Languages in History:", audioLangs);

    const subLangs = await prisma.playbackHistory.groupBy({
      by: ['subtitleLanguage'],
      _count: { id: true }
    });
    console.log("Subtitle Languages in History:", subLangs);

    console.log("\n--- Checking Recently Added ---");
    const recentlyAdded = await prisma.media.findMany({
      orderBy: { dateAdded: 'desc' },
      take: 5,
      select: { title: true, dateAdded: true, collectionType: true }
    });
    console.log("Recently Added Samples:", recentlyAdded);

    const excludedRes = await prisma.globalSettings.findUnique({
      where: { id: 'global' },
      select: { excludedLibraries: true }
    });
    console.log("Excluded Libraries:", excludedRes?.excludedLibraries);

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
