import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { readdirSync, statSync, readFileSync } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), "backups");

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const files = readdirSync(BACKUP_DIR)
            .filter(f => f.endsWith(".json") && f.startsWith("jellytulli-auto-"))
            .map(f => {
                const stats = statSync(path.join(BACKUP_DIR, f));
                return {
                    name: f,
                    size: stats.size,
                    sizeMb: (stats.size / 1024 / 1024).toFixed(2),
                    date: stats.mtime.toISOString(),
                };
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return NextResponse.json({ backups: files });

    } catch (e: any) {
        // Directory might not exist yet
        if (e.code === 'ENOENT') {
            return NextResponse.json({ backups: [] });
        }
        console.error("[Auto-Backup List] Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
