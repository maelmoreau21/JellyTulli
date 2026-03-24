import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin, isAuthError } from "@/lib/auth";

export async function GET() {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;

  // Analyze media for missing metadata
  const issues: Record<string, { count: number; examples: { id: string; jellyfinMediaId: string; title: string }[] }> = {};

  // 1. Movies/Episodes without resolution
  const noResolution = await prisma.media.findMany({
    where: {
      type: { in: ["Movie", "Episode"] },
      OR: [
        { resolution: null },
        { resolution: "" },
      ],
    },
    select: { id: true, jellyfinMediaId: true, title: true },
    take: 20,
    orderBy: { title: "asc" },
  });
  const noResCount = await prisma.media.count({
    where: {
      type: { in: ["Movie", "Episode"] },
      OR: [{ resolution: null }, { resolution: "" }],
    },
  });
  issues.missingResolution = { count: noResCount, examples: noResolution };

  // 2. Media without actors (movies/episodes only)
  const noActors = await prisma.media.findMany({
    where: {
      type: { in: ["Movie", "Episode"] },
      actors: { isEmpty: true },
    },
    select: { id: true, jellyfinMediaId: true, title: true },
    take: 20,
    orderBy: { title: "asc" },
  });
  const noActorsCount = await prisma.media.count({
    where: {
      type: { in: ["Movie", "Episode"] },
      actors: { isEmpty: true },
    },
  });
  issues.missingActors = { count: noActorsCount, examples: noActors };

  // 3. Episodes/Tracks without parentId (orphans)
  const orphans = await prisma.media.findMany({
    where: {
      type: { in: ["Episode", "Audio", "Track"] },
      parentId: null,
    },
    select: { id: true, jellyfinMediaId: true, title: true },
    take: 20,
    orderBy: { title: "asc" },
  });
  const orphanCount = await prisma.media.count({
    where: {
      type: { in: ["Episode", "Audio", "Track"] },
      parentId: null,
    },
  });
  issues.orphanItems = { count: orphanCount, examples: orphans };

  // 4. Media without genres (movies/series only)
  const noGenres = await prisma.media.findMany({
    where: {
      type: { in: ["Movie", "Series"] },
      genres: { isEmpty: true },
    },
    select: { id: true, jellyfinMediaId: true, title: true },
    take: 20,
    orderBy: { title: "asc" },
  });
  const noGenresCount = await prisma.media.count({
    where: {
      type: { in: ["Movie", "Series"] },
      genres: { isEmpty: true },
    },
  });
  issues.missingGenres = { count: noGenresCount, examples: noGenres };

  // Total media count for context
  const totalMedia = await prisma.media.count();

  return NextResponse.json({ totalMedia, issues });
}
