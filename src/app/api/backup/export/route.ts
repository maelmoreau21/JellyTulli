import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // Fetch all the data we need to construct a huge JSON backup file.
        const users = await prisma.user.findMany();
        const media = await prisma.media.findMany();
        const playbackHistory = await prisma.playbackHistory.findMany();
        const settings = await prisma.globalSettings.findFirst({ where: { id: "global" } });

        const backupContent = {
            version: "1.0",
            exportDate: new Date().toISOString(),
            data: {
                users,
                media,
                playbackHistory,
                settings,
            }
        };

        // BigInt-safe JSON serializer (Prisma returns BigInt for durationMs, positionTicks, etc.)
        const bigIntReplacer = (_key: string, value: unknown) => typeof value === 'bigint' ? value.toString() : value;

        // Construct standard file headers to serve the file instantly downstream.
        return new NextResponse(JSON.stringify(backupContent, bigIntReplacer, 2), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Content-Disposition": `attachment; filename="jellytulli-backup-${new Date().toISOString().split('T')[0]}.json"`,
            }
        });

    } catch (e: any) {
        console.error("[BackupExport] Failed", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
