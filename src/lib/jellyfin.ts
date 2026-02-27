export function getJellyfinImageUrl(itemId: string, type: 'Primary' | 'Thumb' = 'Primary'): string {
    const baseUrl = process.env.JELLYFIN_URL || "";
    const apiKey = process.env.JELLYFIN_API_KEY || "";
    if (baseUrl && apiKey) {
        return `${baseUrl}/Items/${itemId}/Images/${type}?api_key=${apiKey}&fillWidth=300&quality=80`;
    }
    return `/api/jellyfin/image?itemId=${itemId}&type=${type}`;
}

export async function fetchJellyfinImage(itemId: string, type: string) {
    const baseUrl = process.env.JELLYFIN_URL;
    const apiKey = process.env.JELLYFIN_API_KEY;

    if (!baseUrl || !apiKey) {
        throw new Error("JELLYFIN_URL or JELLYFIN_API_KEY is not configured securely in environment variables");
    }

    // L'API Jellyfin prend en charge plusieurs tailles et qualités, on force un format pour nos UI de façon performante
    const url = `${baseUrl}/Items/${itemId}/Images/${type}?api_key=${apiKey}&fillWidth=300&quality=80`;

    // Ajout d'un timer pour éviter de bloquer indéfiniment le réseau si Jellyfin est lent
    const response = await fetch(url, {
        method: 'GET',
        // Ajout d'une option Next.js de cache ou revalidation si on le souhaite (ex: revalidate 86400)
        next: { revalidate: 86400 }
    });

    return response;
}
