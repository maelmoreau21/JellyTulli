import prisma from "./prisma";

/**
 * Fonction maîtresse de synchronisation de la librairie Jellyfin.
 * Interroge l'API Jellyfin pour récupérer les Utilisateurs et les Médias (Films, Séries, Épisodes),
 * et effectue un Upsert massif dans la base PostgreSQL via Prisma.
 */
export async function syncJellyfinLibrary() {
    console.log("[Sync] Démarrage de la synchronisation de la librairie Jellyfin...");

    const baseUrl = process.env.JELLYFIN_URL;
    const apiKey = process.env.JELLYFIN_API_KEY;

    if (!baseUrl || !apiKey) {
        console.error("[Sync Error] JELLYFIN_URL ou JELLYFIN_API_KEY manquants.");
        return { success: false, error: "Missing Env Variables" };
    }

    try {
        // 1. Synchronisation des Utilisateurs
        console.log("[Sync] Fetching Users...");
        const usersRes = await fetch(`${baseUrl}/Users?api_key=${apiKey}`);
        if (!usersRes.ok) throw new Error("Erreur de récupération des utilisateurs");
        const users = await usersRes.json();

        // Upsert massifs utilisateurs
        let usersCount = 0;
        for (const user of users) {
            await prisma.user.upsert({
                where: { jellyfinUserId: user.Id },
                update: { username: user.Name },
                create: { jellyfinUserId: user.Id, username: user.Name },
            });
            usersCount++;
        }
        console.log(`[Sync] ${usersCount} utilisateurs synchronisés.`);

        // 2. Synchronisation des Médias (Films, Séries, Épisodes)
        console.log("[Sync] Fetching Media Items...");
        // On récupère tout ce qui est vidéo (Movie, Series, Episode, etc.) - Ajout de Genres et MediaSources
        const itemsRes = await fetch(`${baseUrl}/Items?api_key=${apiKey}&IncludeItemTypes=Movie,Series,Episode&Recursive=true&Fields=ProviderIds,PremiereDate,Genres,MediaSources`);
        if (!itemsRes.ok) throw new Error("Erreur de récupération des médias");
        const itemsData = await itemsRes.json();
        const items = itemsData.Items || [];

        let mediaCount = 0;
        for (const item of items) {
            // Extraction des genres (limités pour éviter les overloads)
            const genres = item.Genres || [];

            // Déduction de la résolution à partir du premier flux vidéo (MediaSources)
            let resolution = null;
            if (item.MediaSources && item.MediaSources.length > 0) {
                const mediaSource = item.MediaSources[0];
                const videoStream = mediaSource.MediaStreams?.find((s: any) => s.Type === "Video");
                if (videoStream && videoStream.Width) {
                    const w = videoStream.Width;
                    if (w >= 3800) resolution = "4K";
                    else if (w >= 1900) resolution = "1080p";
                    else if (w >= 1200) resolution = "720p";
                    else resolution = "SD";
                }
            }

            await prisma.media.upsert({
                where: { jellyfinMediaId: item.Id },
                update: {
                    title: item.Name,
                    type: item.Type,
                    genres: genres,
                    resolution: resolution
                },
                create: {
                    jellyfinMediaId: item.Id,
                    title: item.Name,
                    type: item.Type,
                    genres: genres,
                    resolution: resolution
                },
            });
            mediaCount++;
        }
        console.log(`[Sync] ${mediaCount} médias synchronisés.`);

        console.log("[Sync] Terminée avec succès.");
        return { success: true, users: usersCount, media: mediaCount };
    } catch (e: any) {
        console.error("[Sync Error]", e.message);
        return { success: false, error: e.message };
    }
}
