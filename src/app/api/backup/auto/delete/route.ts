import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { unlinkSync, existsSync } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), "backups");

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { fileName } = await req.json();

        if (!fileName || typeof fileName !== "string") {
            return NextResponse.json({ error: "Nom de fichier manquant." }, { status: 400 });
        }

        // Path traversal protection: only use the base filename
        const safeName = path.basename(fileName);

        // Validate it's an auto-backup file
        if (!safeName.startsWith("jellytulli-auto-") || !safeName.endsWith(".json")) {
            return NextResponse.json({ error: "Fichier invalide." }, { status: 400 });
        }

        const filePath = path.join(BACKUP_DIR, safeName);

        if (!existsSync(filePath)) {
            return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });
        }

        unlinkSync(filePath);

        return NextResponse.json({ success: true, message: `Sauvegarde ${safeName} supprimée.` });
    } catch (e: any) {
        console.error("[Auto-Backup Delete] Error:", e);
        return NextResponse.json({ error: e.message || "Erreur lors de la suppression." }, { status: 500 });
    }
}
