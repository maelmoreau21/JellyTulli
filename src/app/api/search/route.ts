import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ media: [], users: [] });
  }

  const isAdmin = session.user.isAdmin === true;

  // Search media by title (case-insensitive via mode: 'insensitive')
  const media = await prisma.media.findMany({
    where: {
      title: { contains: q, mode: "insensitive" },
      type: { in: ["Movie", "Series", "MusicAlbum"] }, // Only parent-level items
    },
    select: {
      jellyfinMediaId: true,
      title: true,
      type: true,
      parentId: true,
    },
    take: 8,
    orderBy: { title: "asc" },
  });

  // Only admins can search users
  let users: { jellyfinUserId: string; username: string }[] = [];
  if (isAdmin) {
    users = await prisma.user.findMany({
      where: {
        username: { contains: q, mode: "insensitive" },
      },
      select: {
        jellyfinUserId: true,
        username: true,
      },
      take: 5,
      orderBy: { username: "asc" },
    });
  }

  return NextResponse.json({ media, users });
}
