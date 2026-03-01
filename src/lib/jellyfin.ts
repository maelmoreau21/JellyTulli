export function getJellyfinImageUrl(itemId: string, type: 'Primary' | 'Thumb' = 'Primary', fallbackId?: string): string {
    let url = `/api/jellyfin/image?itemId=${itemId}&type=${type}`;
    if (fallbackId) url += `&fallbackId=${fallbackId}`;
    return url;
}

export async function fetchJellyfinImage(itemId: string, type: string) {
    const baseUrl = process.env.JELLYFIN_URL;
    const apiKey = process.env.JELLYFIN_API_KEY;

    if (!baseUrl || !apiKey) {
        throw new Error("JELLYFIN_URL ou JELLYFIN_API_KEY non configurées dans les variables d'environnement.");
    }

    const url = `${baseUrl}/Items/${itemId}/Images/${type}?api_key=${apiKey}&fillWidth=300&quality=80`;

    const response = await fetch(url, {
        method: 'GET',
        next: { revalidate: 86400 }
    });

    return response;
}
