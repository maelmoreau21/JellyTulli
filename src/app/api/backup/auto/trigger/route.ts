import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { performAutoBackup } from "@/lib/autoBackup";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const fileName = await performAutoBackup();
        return NextResponse.json({ success: true, message: `Sauvegarde manuelle créée : ${fileName}`, fileName });
    } catch (e: any) {
        console.error("[Manual Backup Trigger] Error:", e);
        return NextResponse.json({ error: e.message || "Erreur lors de la sauvegarde." }, { status: 500 });
    }
}
