export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        // Chargement dynamique pour éviter les erreurs du compilateur Edge de Next.js
        const cron = (await import('node-cron')).default;
        const { syncJellyfinLibrary } = await import('@/lib/sync');
        const { startMonitoring } = await import('@/server/monitor');
        const { performAutoBackup } = await import('@/lib/autoBackup');

        console.log("[Instrumentation] Démarrage des tâches de fond...");

        // Démarrer la boucle de monitoring "Zéro Configuration" (polling toutes les 5s)
        await startMonitoring();

        // Cron Job: Tous les jours à 3h00 du matin (0 3 * * *)
        cron.schedule('0 3 * * *', async () => {
            console.log("[Cron] Déclenchement automatique de la synchronisation (3:00 AM)");
            await syncJellyfinLibrary();
        });

        // Cron Job: Auto-backup tous les jours à 3h30 du matin (30 3 * * *)
        cron.schedule('30 3 * * *', async () => {
            console.log("[Cron] Déclenchement de la sauvegarde automatique (3:30 AM)");
            try {
                await performAutoBackup();
            } catch (err) {
                console.error("[Cron] Auto-backup failed:", err);
            }
        });
    }
}
