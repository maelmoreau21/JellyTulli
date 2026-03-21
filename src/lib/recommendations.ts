import prisma from "@/lib/prisma";
import redis from "@/lib/redis";

const CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 hours

interface UserVector {
  userId: string;
  items: Map<string, number>; // jellyfinMediaId -> minutes watched
  magnitude: number;
}

/**
 * Calculate Cosine Similarity between two vectors
 */
function cosineSimilarity(vecA: UserVector, vecB: UserVector): number {
  if (vecA.magnitude === 0 || vecB.magnitude === 0) return 0;
  
  let dotProduct = 0;
  for (const [mediaId, weightA] of vecA.items.entries()) {
    const weightB = vecB.items.get(mediaId);
    if (weightB) {
      dotProduct += weightA * weightB;
    }
  }
  return dotProduct / (vecA.magnitude * vecB.magnitude);
}

/**
 * Builds a vector for a user from their aggregate history
 */
function buildVector(userId: string, aggregates: any[]): UserVector {
  const items = new Map<string, number>();
  let sumSquares = 0;
  
  for (const agg of aggregates) {
    if (agg.mediaId && agg._sum.durationWatched) {
      const minutes = agg._sum.durationWatched / 60;
      items.set(agg.mediaId, minutes);
      sumSquares += minutes * minutes;
    }
  }
  
  return {
    userId,
    items,
    magnitude: Math.sqrt(sumSquares)
  };
}

/**
 * Get AI Recommendations using Collaborative Filtering (Cosine Similarity)
 */
export async function getAIRecommendations(targetUserId: string, limit: number = 10) {
  const cacheKey = `recs:${targetUserId}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      // invalid cache
    }
  }
  try {
    // 1. Get Target User's aggregated history (to form target vector)
    const targetAgg = await prisma.playbackHistory.groupBy({
      by: ['mediaId'],
      where: { userId: targetUserId },
      _sum: { durationWatched: true }
    });

    if (targetAgg.length === 0) {
      const emptyPayload = { updatedAt: new Date().toISOString(), recommendations: [] };
      await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(emptyPayload)).catch(()=>{});
      return emptyPayload; // Cannot recommend for users with no history
    }

    const targetVector = buildVector(targetUserId, targetAgg);
    const targetMediaIds = Array.from(targetVector.items.keys());

    // 2. Find Candidate Users (users who watched at least one thing the target user watched)
    const overlappingUsers = await prisma.playbackHistory.groupBy({
      by: ['userId'],
      where: {
        mediaId: { in: targetMediaIds },
        userId: { not: targetUserId },
        startedAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } // Last 90 days
      }
    });

    const candidateUserIds = overlappingUsers.map(u => u.userId).filter(Boolean) as string[];

    if (candidateUserIds.length === 0) {
      const emptyPayload = { updatedAt: new Date().toISOString(), recommendations: [] };
      await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(emptyPayload)).catch(()=>{});
      return emptyPayload;
    }

    // 3. Build vectors for candidate users
    const candidatesAgg = await prisma.playbackHistory.groupBy({
      by: ['userId', 'mediaId'],
      where: {
        userId: { in: candidateUserIds },
        startedAt: { gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) }
      },
      _sum: { durationWatched: true }
    });

    const userItemsMap = new Map<string, any[]>();
    for (const agg of candidatesAgg) {
      if (!agg.userId) continue;
      if (!userItemsMap.has(agg.userId)) userItemsMap.set(agg.userId, []);
      userItemsMap.get(agg.userId)!.push(agg);
    }

    // 4. Calculate similarities
    const similarities: { userId: string, score: number }[] = [];
    for (const [userId, aggregates] of userItemsMap.entries()) {
      const candidateVector = buildVector(userId, aggregates);
      const score = cosineSimilarity(targetVector, candidateVector);
      if (score > 0.05) { // Minimum similarity threshold
        similarities.push({ userId, score });
      }
    }

    // Sort by similarity descending
    similarities.sort((a, b) => b.score - a.score);

    // 5. Generate Candidate Items
    const itemScores = new Map<string, number>();
    for (const sim of similarities) {
      const aggregates = userItemsMap.get(sim.userId)!;
      for (const agg of aggregates) {
        const mId = agg.mediaId!; // internal DB media id
        // Exclude items the target user has already watched
        if (targetVector.items.has(mId)) continue;

        const currentScore = itemScores.get(mId) || 0;
        const watchMinutes = (agg._sum.durationWatched || 0) / 60;
        const addedWeight = sim.score * Math.log10(1 + watchMinutes);
        itemScores.set(mId, currentScore + addedWeight);
      }
    }

    // 6. Sort top N recommended items (internal media IDs)
    const sortedItems = Array.from(itemScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    if (sortedItems.length === 0) {
      const emptyPayload = { updatedAt: new Date().toISOString(), recommendations: [] };
      await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(emptyPayload)).catch(()=>{});
      return emptyPayload;
    }

    // 7. Resolve Media Information using internal IDs, then expose Jellyfin IDs to the client
    const topMediaInternalIds = sortedItems.map(i => i[0]);
    const recommendedMediaInfo = await prisma.media.findMany({
      where: { id: { in: topMediaInternalIds } },
      select: {
        id: true,
        jellyfinMediaId: true,
        title: true,
        type: true,
        libraryName: true
      }
    });

    const mediaById = new Map(recommendedMediaInfo.map(m => [m.id, m]));

    const results = sortedItems.map(([internalId, score]) => {
      const media = mediaById.get(internalId);
      if (!media || !media.jellyfinMediaId) return null;
      return {
        id: media.jellyfinMediaId,
        score,
        media: { jellyfinMediaId: media.jellyfinMediaId, title: media.title, type: media.type, libraryName: media.libraryName }
      };
    }).filter(Boolean) as any[];

    const payload = {
      updatedAt: new Date().toISOString(),
      recommendations: results
    };

    // 8. Cache the results (best-effort)
    await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(payload)).catch(()=>{});

    return payload;
  } catch (err) {
    console.error('[getAIRecommendations] error:', err);
    const fallback = { updatedAt: new Date().toISOString(), recommendations: [] };
    try { await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(fallback)); } catch(e) {}
    return fallback;
  }
}
