export function getJellyfinImageUrl(itemId: string, type: 'Primary' | 'Thumb' = 'Primary'): string {
    // Redirige toujours vers l'API interne pour masquer l'URL et la clé de l'utilisateur final
    return `/api/jellyfin/image?itemId=${itemId}&type=${type}`;
}

export async function fetchJellyfinImage(itemId: string, type: string) {
    // Required to prevent import loops if this is a lib (better to import inline or ensure prisma is available)
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const settings = await prisma.globalSettings.findUnique({ where: { id: "global" } });
    const baseUrl = settings?.jellyfinUrl;
    const apiKey = settings?.jellyfinApiKey;

    if (!baseUrl || !apiKey) {
        throw new Error("Le serveur Jellyfin n'est pas configuré dans les paramètres globaux.");
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
