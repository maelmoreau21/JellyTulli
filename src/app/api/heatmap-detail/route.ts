import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin, isAuthError } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;

  const { searchParams } = request.nextUrl;
  const day = parseInt(searchParams.get("day") || "-1", 10);
  const hour = parseInt(searchParams.get("hour") || "-1", 10);

  if (day < 0 || day > 6 || hour < 0 || hour > 23) {
    return NextResponse.json({ error: "Invalid day/hour" }, { status: 400 });
  }

  // We need to find sessions that started on this day-of-week at this hour.
  // Since Prisma doesn't support extracting day-of-week natively, we fetch
  // recent history and filter in JS. Limited to last 30 days for performance.
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const history = await prisma.playbackHistory.findMany({
    where: {
      startedAt: { gte: since },
      durationWatched: { gte: 10 }, // skip zap sessions
    },
    select: {
      startedAt: true,
      durationWatched: true,
      playMethod: true,
      clientName: true,
      user: { select: { username: true } },
      media: { select: { title: true, type: true } },
    },
    orderBy: { startedAt: "desc" },
    take: 5000, // Safety cap
  });

  const sessions = history
    .filter((h) => {
      const d = new Date(h.startedAt);
      return d.getDay() === day && d.getHours() === hour;
    })
    .slice(0, 50) // Cap for response size
    .map((h) => ({
      username: h.user?.username || "?",
      mediaTitle: h.media?.title || "?",
      mediaType: h.media?.type || "?",
      durationMin: Math.round(h.durationWatched / 60),
      playMethod: h.playMethod || "?",
      clientName: h.clientName || "?",
      startedAt: h.startedAt.toISOString(),
    }));

  return NextResponse.json({ sessions });
}
