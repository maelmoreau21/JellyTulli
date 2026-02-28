import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { writeFile, mkdir, stat } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const UPLOAD_DIR = "/tmp/jellytulli-uploads";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const uploadId = req.headers.get("x-upload-id");
        const chunkIndex = parseInt(req.headers.get("x-chunk-index") || "0", 10);
        const totalChunks = parseInt(req.headers.get("x-total-chunks") || "1", 10);
        const fileName = req.headers.get("x-file-name") || "upload.json";

        if (!uploadId) {
            return NextResponse.json({ error: "Missing upload ID" }, { status: 400 });
        }

        // Read chunk from raw body
        const body = req.body;
        if (!body) {
            return NextResponse.json({ error: "Empty chunk" }, { status: 400 });
        }

        // Ensure upload directory exists
        const uploadPath = path.join(UPLOAD_DIR, uploadId);
        if (!existsSync(uploadPath)) {
            await mkdir(uploadPath, { recursive: true });
        }

        // Write chunk to disk sequentially
        const chunkPath = path.join(uploadPath, `chunk-${String(chunkIndex).padStart(5, '0')}`);
        const reader = body.getReader();
        const chunks: Uint8Array[] = [];
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }

        const buffer = Buffer.concat(chunks);
        await writeFile(chunkPath, buffer);

        console.log(`[Jellystat Chunk] Received chunk ${chunkIndex + 1}/${totalChunks} for upload ${uploadId} (${(buffer.length / 1024 / 1024).toFixed(2)} Mo)`);

        return NextResponse.json({
            success: true,
            chunkIndex,
            totalChunks,
            received: buffer.length,
        });

    } catch (e: any) {
        console.error("[Jellystat Chunk] Error:", e);
        return NextResponse.json({ error: e.message || "Erreur lors de la réception du chunk." }, { status: 500 });
    }
}
