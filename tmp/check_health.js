const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Basic .env parser
function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length === 2) {
        const key = parts[0].trim();
        let value = parts[1].trim();
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value;
      }
    });
  }
}

loadEnv();

const prisma = new PrismaClient();

async function main() {
  try {
    const health = await prisma.systemHealthState.findUnique({ where: { id: 'current' } });
    console.log('--- System Health ---');
    console.log(JSON.stringify(health, null, 2));

    const mediaCount = await prisma.media.count();
    console.log('\n--- Media Count ---');
    console.log('Total Media:', mediaCount);

    const playbackCount = await prisma.playbackHistory.count();
    console.log('\n--- Playback Count ---');
    console.log('Total Playback History:', playbackCount);

    const settings = await prisma.globalSettings.findUnique({ where: { id: 'global' } });
    console.log('\n--- Global Settings ---');
    console.log(JSON.stringify(settings, null, 2));

    if (mediaCount > 0) {
        const lastMedia = await prisma.media.findFirst({
            orderBy: { dateAdded: 'desc' },
            select: { title: true, dateAdded: true, type: true }
        });
        console.log('\n--- Last Media Added ---');
        console.log(JSON.stringify(lastMedia, null, 2));
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
