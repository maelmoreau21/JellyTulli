import { NextRequest, NextResponse } from "next/server";
import { fetchJellyfinImage } from "@/lib/jellyfin";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get("itemId");
    const type = searchParams.get("type") || "Primary";
    const fallbackId = searchParams.get("fallbackId"); // e.g. AlbumId for music tracks

    if (!itemId) {
        return new NextResponse("Item ID is required", { status: 400 });
    }

    try {
        let response = await fetchJellyfinImage(itemId, type);

        // If the item has no image, try the fallback (e.g. parent album)
        if (!response.ok && fallbackId) {
            response = await fetchJellyfinImage(fallbackId, type);
        }

        if (!response.ok) {
            return new NextResponse("Image not found on Jellyfin Server", { status: response.status });
        }

        const buffer = await response.arrayBuffer();
        const headers = new Headers();

        // On récupère le type de contenu depuis le serveur originel pour notre proxy (souvent image/jpeg ou image/webp)
        headers.set('Content-Type', response.headers.get('Content-Type') || 'image/jpeg');
        // Mise en cache navigateur longue durée pour soulager l'API
        headers.set('Cache-Control', 'public, max-age=604800, immutable');

        return new NextResponse(buffer, { headers });
    } catch (e) {
        console.error("Erreur proxy Image Jellyfin:", e);
        return new NextResponse("Internal API Proxy Error", { status: 500 });
    }
}
