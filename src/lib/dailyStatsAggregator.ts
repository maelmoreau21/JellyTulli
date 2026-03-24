import prisma from "@/lib/prisma";

/**
 * Pre-aggregates PlaybackHistory into DailyStats for fast dashboard queries.
 * Designed to be called daily (via cron) or manually from admin.
 *
 * @param daysBack Number of past days to (re-)aggregate.  Default = 2 to catch
 *                 late-arriving sessions and timezone edge-cases.
 */
export async function aggregateDailyStats(daysBack = 2): Promise<{ upserted: number }> {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  since.setHours(0, 0, 0, 0);

  // Fetch raw playback data for the window
  const rows = await prisma.playbackHistory.findMany({
    where: { startedAt: { gte: since } },
    select: {
      userId: true,
      durationWatched: true,
      playMethod: true,
      mediaId: true,
      startedAt: true,
      media: { select: { libraryName: true, type: true } },
    },
  });

  // Build aggregation buckets: key = "YYYY-MM-DD|userId|libraryName|mediaType"
  const buckets = new Map<
    string,
    {
      date: Date;
      userId: string | null;
      libraryName: string | null;
      mediaType: string | null;
      totalPlays: number;
      totalDuration: number;
      directPlays: number;
      transcodes: number;
      uniqueMedia: Set<string>;
    }
  >();

  for (const row of rows) {
    const d = new Date(row.startedAt);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const userId = row.userId || "__anonymous__";
    const libraryName = row.media?.libraryName || "__none__";
    const mediaType = row.media?.type || "__unknown__";
    const key = `${dateKey}|${userId}|${libraryName}|${mediaType}`;

    if (!buckets.has(key)) {
      const bucketDate = new Date(dateKey + "T00:00:00.000Z");
      buckets.set(key, {
        date: bucketDate,
        userId: row.userId,
        libraryName: row.media?.libraryName || null,
        mediaType: row.media?.type || null,
        totalPlays: 0,
        totalDuration: 0,
        directPlays: 0,
        transcodes: 0,
        uniqueMedia: new Set(),
      });
    }

    const bucket = buckets.get(key)!;
    bucket.totalPlays += 1;
    bucket.totalDuration += row.durationWatched || 0;
    if (row.playMethod === "DirectPlay") bucket.directPlays += 1;
    if (row.playMethod?.toLowerCase().includes("transcode")) bucket.transcodes += 1;
    bucket.uniqueMedia.add(row.mediaId);
  }

  // Upsert all buckets
  let upserted = 0;
  for (const bucket of buckets.values()) {
    await prisma.dailyStats.upsert({
      where: {
        date_userId_libraryName_mediaType: {
          date: bucket.date,
          userId: bucket.userId,
          libraryName: bucket.libraryName,
          mediaType: bucket.mediaType,
        },
      },
      create: {
        date: bucket.date,
        userId: bucket.userId,
        libraryName: bucket.libraryName,
        mediaType: bucket.mediaType,
        totalPlays: bucket.totalPlays,
        totalDuration: bucket.totalDuration,
        directPlays: bucket.directPlays,
        transcodes: bucket.transcodes,
        uniqueMedia: bucket.uniqueMedia.size,
      },
      update: {
        totalPlays: bucket.totalPlays,
        totalDuration: bucket.totalDuration,
        directPlays: bucket.directPlays,
        transcodes: bucket.transcodes,
        uniqueMedia: bucket.uniqueMedia.size,
      },
    });
    upserted++;
  }

  return { upserted };
}
