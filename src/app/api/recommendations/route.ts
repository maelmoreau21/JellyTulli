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
    const userIdParam = searchParams.get("userId");

    const isAdmin = (session.user as any)?.isAdmin === true;
    const sessionUserId = (session.user as any).id;

    // Determine which user to fetch recommendations for
    let targetUserId: string;
    
    if (userIdParam) {
      // If a userId is specified, check authorization
      // Admins can view any user; non-admins can only view their own
      const targetUser = await prisma.user.findFirst({
        where: {
          OR: [
            { id: userIdParam },
            { jellyfinUserId: userIdParam }
          ]
        }
      });

      if (!targetUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // Non-admin can only see recommendations for themselves
      if (!isAdmin) {
        const sessionUser = await prisma.user.findFirst({
          where: {
            OR: [
              { id: sessionUserId },
              { jellyfinUserId: sessionUserId }
            ]
          }
        });
        if (!sessionUser || sessionUser.id !== targetUser.id) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }

      targetUserId = targetUser.id;
    } else {
      // Default: current session user
      const dbUser = await prisma.user.findFirst({
        where: {
          OR: [
            { id: sessionUserId },
            { jellyfinUserId: sessionUserId }
          ]
        }
      });

      if (!dbUser) {
        return NextResponse.json({ error: "User not found in DB" }, { status: 404 });
      }

      targetUserId = dbUser.id;
    }

    const recs = await getAIRecommendations(targetUserId, limit);

    return NextResponse.json(recs);
  } catch (error) {
    console.error("[Recommendations API] Failed to fetch recommendations:", error);
    // Return an empty recommendations payload to keep the UI resilient
    return NextResponse.json({ recommendations: [] });
  }
}
