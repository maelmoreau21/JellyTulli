import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { getAIRecommendations } from "@/lib/recommendations";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 10;

    // session.user typically contains id (jellyfinUserId) and some other fields
    // Let's resolve the DB User ID from the session 
    // Auth logic in standard setup: session.user.id is the Jellyfin ID.
    // We need the internal DB User ID.
    
    // In JellyTrack auth, the user ID in session is usually the internal ID or Jellyfin ID.
    // Let's look up to be safe:
    const dbUserId = (session.user as any).id;
    const dbUser = await prisma.user.findFirst({
        where: {
            OR: [
                { id: dbUserId },
                { jellyfinUserId: dbUserId }
            ]
        }
    });

    if (!dbUser) {
        return NextResponse.json({ error: "User not found in DB" }, { status: 404 });
    }

    const recs = await getAIRecommendations(dbUser.id, limit);

    return NextResponse.json(recs);
  } catch (error) {
    console.error("[Recommendations API] Failed to fetch recommendations:", error);
    // Return an empty recommendations payload to keep the UI resilient when
    // the DB or recommendation engine is temporarily unavailable (local dev).
    return NextResponse.json({ recommendations: [] });
  }
}
