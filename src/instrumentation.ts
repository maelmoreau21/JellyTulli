export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        // Chargement dynamique pour éviter les erreurs du compilateur Edge de Next.js
        const cron = (await import('node-cron')).default;
        const { syncJellyfinLibrary } = await import('@/lib/sync');
        const { startMonitoring } = await import('@/server/monitor');

        console.log("[Instrumentation] Démarrage des tâches de fond...");

        // Démarrer la boucle de monitoring "Zéro Configuration" (polling toutes les 5s)
        await startMonitoring();

        // Cron Job: Tous les jours à 3h00 du matin (0 3 * * *)
        cron.schedule('0 3 * * *', async () => {
            console.log("[Cron] Déclenchement automatique de la synchronisation (3:00 AM)");
            await syncJellyfinLibrary();
        });
    }
}
