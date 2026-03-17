import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const health = await prisma.systemHealthState.findUnique({ where: { id: 'current' } })
  console.log('--- System Health ---')
  console.log(JSON.stringify(health, null, 2))

  const mediaCount = await prisma.media.count()
  console.log('\n--- Media Count ---')
  console.log('Total Media:', mediaCount)

  const playbackCount = await prisma.playbackHistory.count()
  console.log('\n--- Playback Count ---')
  console.log('Total Playback History:', playbackCount)

  const settings = await prisma.globalSettings.findUnique({ where: { id: 'global' } })
  console.log('\n--- Global Settings ---')
  console.log(JSON.stringify(settings, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
