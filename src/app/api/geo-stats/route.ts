import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin, isAuthError } from "@/lib/auth";

export async function GET() {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;

  // Aggregate geo data from PlaybackHistory
  const geoData = await prisma.playbackHistory.groupBy({
    by: ["country", "city"],
    _count: { id: true },
    _max: { startedAt: true },
    where: {
      country: { not: null },
    },
    orderBy: { _count: { id: "desc" } },
    take: 200,
  });

  const locations = geoData.map((g) => ({
    country: g.country || "Unknown",
    city: g.city || "Unknown",
    sessions: g._count.id,
    lastSeen: g._max.startedAt?.toISOString() || null,
  }));

  // Country-level aggregation for map coloring
  const countryMap = new Map<string, { sessions: number; cities: string[] }>();
  for (const loc of locations) {
    const existing = countryMap.get(loc.country) || { sessions: 0, cities: [] };
    existing.sessions += loc.sessions;
    if (loc.city !== "Unknown" && !existing.cities.includes(loc.city)) {
      existing.cities.push(loc.city);
    }
    countryMap.set(loc.country, existing);
  }

  const countries = Array.from(countryMap.entries())
    .map(([name, data]) => ({
      name,
      sessions: data.sessions,
      cities: data.cities.slice(0, 5), // Top 5 cities
    }))
    .sort((a, b) => b.sessions - a.sessions);

  // Live streams geo data
  const liveStreams = await prisma.activeStream.findMany({
    select: {
      country: true,
      city: true,
      user: { select: { username: true } },
      media: { select: { title: true } },
    },
  });

  const liveLocations = liveStreams
    .filter((s) => s.country)
    .map((s) => ({
      country: s.country || "Unknown",
      city: s.city || "Unknown",
      username: s.user?.username || "?",
      mediaTitle: s.media?.title || "?",
    }));

  return NextResponse.json({ countries, locations, liveLocations });
}
