import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const mediaCount = await prisma.media.count();
  const historyCount = await prisma.playbackHistory.count();
  const userCount = await prisma.user.count();
  const libraryStats = await prisma.media.groupBy({
    by: ['libraryName'],
    _count: true
  });

  console.log('--- Database Stats ---');
  console.log('Media count:', mediaCount);
  console.log('PlaybackHistory count:', historyCount);
  console.log('User count:', userCount);
  console.log('Library counts:', JSON.stringify(libraryStats, null, 2));

  const recentMedia = await prisma.media.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: { title: true, libraryName: true, collectionType: true, createdAt: true }
  });
  console.log('Recent Media:', JSON.stringify(recentMedia, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
