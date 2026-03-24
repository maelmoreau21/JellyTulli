import prisma from "@/lib/prisma";

interface TrendingItem {
  title: string;
  jellyfinMediaId: string;
  mediaType: string;
  currentWeekPlays: number;
  previousWeekPlays: number;
  growthPercent: number;
  trendScore: number;
}

interface PeakPrediction {
  dayOfWeek: number;
  hour: number;
  predictedSessions: number;
  confidence: number;
}

/**
 * Lightweight prediction engine using exponential moving averages
 * and day-of-week/hour patterns from historical data.
 */
export async function getPredictions(): Promise<{
  trendingMedia: TrendingItem[];
  peakPredictions: PeakPrediction[];
}> {
  const now = new Date();
  
  // --- 1. TRENDING MEDIA ---
  // Compare current 7 days vs previous 7 days
  const currentWeekStart = new Date(now);
  currentWeekStart.setDate(currentWeekStart.getDate() - 7);
  currentWeekStart.setHours(0, 0, 0, 0);
  
  const previousWeekStart = new Date(currentWeekStart);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);

  const [currentWeek, previousWeek] = await Promise.all([
    prisma.playbackHistory.groupBy({
      by: ["mediaId"],
      _count: { id: true },
      where: {
        startedAt: { gte: currentWeekStart },
        durationWatched: { gte: 60 }, // Skip zaps
      },
      orderBy: { _count: { id: "desc" } },
      take: 100,
    }),
    prisma.playbackHistory.groupBy({
      by: ["mediaId"],
      _count: { id: true },
      where: {
        startedAt: { gte: previousWeekStart, lt: currentWeekStart },
        durationWatched: { gte: 60 },
      },
    }),
  ]);

  const prevMap = new Map(previousWeek.map((p) => [p.mediaId, p._count.id]));

  // Calculate growth + trend score
  const growthData = currentWeek.map((c) => {
    const prev = prevMap.get(c.mediaId) || 0;
    const growth = prev > 0 ? ((c._count.id - prev) / prev) * 100 : c._count.id > 1 ? 100 : 0;
    // Trend score = current plays * (1 + growth/100), weighted towards higher absolute plays
    const trendScore = c._count.id * (1 + Math.max(0, growth) / 200);
    return {
      mediaId: c.mediaId,
      currentWeekPlays: c._count.id,
      previousWeekPlays: prev,
      growthPercent: Math.round(growth),
      trendScore,
    };
  });

  // Sort by trend score and take top 10
  const topTrending = growthData
    .filter((d) => d.growthPercent > 0 || d.currentWeekPlays >= 3)
    .sort((a, b) => b.trendScore - a.trendScore)
    .slice(0, 10);

  // Resolve media info
  const mediaIds = topTrending.map((t) => t.mediaId);
  const mediaInfo = await prisma.media.findMany({
    where: { id: { in: mediaIds } },
    select: { id: true, title: true, jellyfinMediaId: true, type: true },
  });
  const mediaMap = new Map(mediaInfo.map((m) => [m.id, m]));

  const trendingMedia: TrendingItem[] = topTrending
    .map((t) => {
      const media = mediaMap.get(t.mediaId);
      if (!media) return null;
      return {
        title: media.title,
        jellyfinMediaId: media.jellyfinMediaId,
        mediaType: media.type,
        currentWeekPlays: t.currentWeekPlays,
        previousWeekPlays: t.previousWeekPlays,
        growthPercent: t.growthPercent,
        trendScore: Math.round(t.trendScore * 10) / 10,
      };
    })
    .filter(Boolean) as TrendingItem[];

  // --- 2. PEAK PREDICTIONS ---
  // Analyze the last 4 weeks to build a pattern per (dayOfWeek, hour)
  const fourWeeksAgo = new Date(now);
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  
  const recentHistory = await prisma.playbackHistory.findMany({
    where: {
      startedAt: { gte: fourWeeksAgo },
      durationWatched: { gte: 10 },
    },
    select: { startedAt: true },
  });

  // Build a 7×24 grid of session counts per week
  const weekGrid = new Map<string, number[]>(); // key: "day-hour", value: [week1, week2, week3, week4]
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      weekGrid.set(`${d}-${h}`, [0, 0, 0, 0]);
    }
  }

  for (const row of recentHistory) {
    const date = new Date(row.startedAt);
    const dayOfWeek = date.getDay();
    const hour = date.getHours();
    const weeksAgo = Math.floor((now.getTime() - date.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const weekIndex = Math.min(3, weeksAgo);
    
    const key = `${dayOfWeek}-${hour}`;
    const arr = weekGrid.get(key);
    if (arr) arr[weekIndex]++;
  }

  // Exponential moving average: most recent week has highest weight
  const weights = [0.4, 0.3, 0.2, 0.1]; // week 0 (most recent) has weight 0.4
  const peakPredictions: PeakPrediction[] = [];

  for (const [key, counts] of weekGrid.entries()) {
    const [d, h] = key.split("-").map(Number);
    const ema = counts.reduce((sum, c, i) => sum + c * weights[i], 0);
    const avg = counts.reduce((s, c) => s + c, 0) / 4;
    const variance = counts.reduce((s, c) => s + (c - avg) ** 2, 0) / 4;
    const stdDev = Math.sqrt(variance);
    // Confidence: lower variance = higher confidence
    const confidence = avg > 0 ? Math.max(0, Math.min(100, Math.round(100 - (stdDev / avg) * 50))) : 0;

    if (ema >= 1) {
      peakPredictions.push({
        dayOfWeek: d,
        hour: h,
        predictedSessions: Math.round(ema * 10) / 10,
        confidence,
      });
    }
  }

  // Sort by predicted sessions
  peakPredictions.sort((a, b) => b.predictedSessions - a.predictedSessions);

  return { trendingMedia, peakPredictions: peakPredictions.slice(0, 48) };
}
