import prisma from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { unstable_cache } from "next/cache";
import { format } from "date-fns";
import { StandardAreaChart, StandardBarChart, StandardPieChart } from "@/components/charts/StandardMetricsCharts";
import { StackedBarChart, StackedAreaChart } from "@/components/charts/StackedMetricsCharts";

const getGranularData = unstable_cache(
    async (type: string | undefined, timeRange: string, excludedLibraries: string[]) => {
        let currentStartDate = new Date();
        if (timeRange === "24h") currentStartDate.setDate(currentStartDate.getDate() - 1);
        else if (timeRange === "7d") currentStartDate.setDate(currentStartDate.getDate() - 7);
        else if (timeRange === "30d") currentStartDate.setDate(currentStartDate.getDate() - 30);
        else currentStartDate = new Date(0);

        const history = await prisma.playbackHistory.findMany({
            where: { startedAt: { gte: currentStartDate } },
            select: {
                startedAt: true,
                durationWatched: true,
                audioLanguage: true,
                subtitleLanguage: true,
                media: { select: { collectionType: true, type: true, durationMs: true, title: true } }
            },
            orderBy: { startedAt: 'asc' }
        });

        const dailyMap = new Map<string, any>();
        const hourlyMap = new Map<string, any>();
        const collections = new Set<string>();
        const completionMap = new Map<string, { totalCompletion: number, sessions: number }>();

        // Segments
        let drop10 = 0;
        let drop25 = 0;
        let drop50 = 0;
        let drop90 = 0;

        // Media specific Drop-off
        const mediaDropMap = new Map<string, { title: string, completion: number, count: number }>();

        // Languages
        const audioMap = new Map<string, number>();
        const subMap = new Map<string, number>();

        // Init 0-23 hours
        for (let i = 0; i < 24; i++) {
            const h = i.toString().padStart(2, '0') + "h";
            hourlyMap.set(h, { time: h, plays: 0, duration: 0 });
        }

        history.forEach(h => {
            if (!h.media) return;
            const lib = h.media.collectionType || h.media.type || "Inconnu";
            if (excludedLibraries.includes(lib)) return;

            collections.add(lib);
            const date = new Date(h.startedAt);
            const dayKey = format(date, "dd MMM");
            const hourKey = date.getHours().toString().padStart(2, '0') + "h";
            const durationH = h.durationWatched / 3600;

            // Daily Aggregation
            if (!dailyMap.has(dayKey)) dailyMap.set(dayKey, { time: dayKey, totalPlays: 0, totalDuration: 0 });
            const dayEntry = dailyMap.get(dayKey);
            dayEntry.totalPlays += 1;
            dayEntry.totalDuration += durationH;
            dayEntry[`${lib}_plays`] = (dayEntry[`${lib}_plays`] || 0) + 1;
            dayEntry[`${lib}_duration`] = (dayEntry[`${lib}_duration`] || 0) + durationH;

            // Hourly Aggregation
            const hourEntry = hourlyMap.get(hourKey);
            hourEntry.plays += 1;
            hourEntry.duration += durationH;

            // Completion Rate Aggregation
            if (h.media.durationMs) {
                const durationTicks = Number(h.media.durationMs);
                if (durationTicks > 0) {
                    const durationSecs = durationTicks / 10000000;
                    let comp = (h.durationWatched / durationSecs) * 100;
                    if (comp > 100) comp = 100;

                    // 1. Avg per Library
                    if (!completionMap.has(lib)) {
                        completionMap.set(lib, { totalCompletion: 0, sessions: 0 });
                    }
                    const compEntry = completionMap.get(lib)!;
                    compEntry.totalCompletion += comp;
                    compEntry.sessions += 1;

                    // 2. Segmentation
                    if (comp < 10) drop10++;
                    else if (comp < 25) drop25++;
                    else if (comp < 80) drop50++;
                    else drop90++;

                    // 3. Top Abandoned Media Tracker
                    if (comp < 80) { // Only track those visibly dropped
                        const mKey = h.media.title;
                        if (!mediaDropMap.has(mKey)) mediaDropMap.set(mKey, { title: mKey, completion: 0, count: 0 });
                        const mEntry = mediaDropMap.get(mKey)!;
                        mEntry.completion += comp;
                        mEntry.count++;
                    }
                }
            }

            // Languages
            if (h.audioLanguage) {
                const aKey = h.audioLanguage.toUpperCase();
                audioMap.set(aKey, (audioMap.get(aKey) || 0) + 1);
            }

            // For subtitles, we count "None" if null/undefined, otherwise the language
            const sKey = h.subtitleLanguage ? h.subtitleLanguage.toUpperCase() : "Désactivés";
            subMap.set(sKey, (subMap.get(sKey) || 0) + 1);
        });

        const dailyData = Array.from(dailyMap.values()).map(d => {
            // Round durations
            d.totalDuration = parseFloat(d.totalDuration.toFixed(2));
            Array.from(collections).forEach(c => {
                if (d[`${c}_duration`]) d[`${c}_duration`] = parseFloat(d[`${c}_duration`].toFixed(2));
            });
            return d;
        });

        const hourlyData = Array.from(hourlyMap.values()).map(h => ({
            time: h.time,
            plays: h.plays,
            duration: parseFloat(h.duration.toFixed(2))
        }));

        const dropOffData = Array.from(completionMap.entries()).map(([lib, data]) => ({
            time: lib,
            completion: Math.round(data.totalCompletion / data.sessions)
        })).sort((a, b) => b.completion - a.completion);

        // Finalize Segment Data
        const dropSegments = [
            { name: "< 10% (Zappé)", value: drop10, fill: "#ef4444" },
            { name: "10-25% (Essayé)", value: drop25, fill: "#f97316" },
            { name: "25-80% (Moitié)", value: drop50, fill: "#eab308" },
            { name: "> 80% (Terminé)", value: drop90, fill: "#22c55e" },
        ];

        // Finalize Top 5 Abandonnés
        const topAbandoned = Array.from(mediaDropMap.values())
            .filter(m => m.count >= 2) // At least tried a few times
            .map(m => ({
                title: m.title.length > 20 ? m.title.substring(0, 20) + '...' : m.title,
                completion: Math.round(m.completion / m.count)
            }))
            .sort((a, b) => a.completion - b.completion) // Lowest completion first
            .slice(0, 5);

        // Finalize Languages (top 5 max for pies)
        const audioData = Array.from(audioMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value).slice(0, 6);

        const subtitleData = Array.from(subMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value).slice(0, 6);

        return {
            dailyData, hourlyData, collections: Array.from(collections),
            dropOffData, dropSegments, topAbandoned, audioData, subtitleData
        };
    },
    ['jellytulli-granular-analysis-v2'],
    { revalidate: 300 }
);

export async function GranularAnalysis({ type, timeRange, excludedLibraries }: { type?: string, timeRange: string, excludedLibraries: string[] }) {
    const data = await getGranularData(type, timeRange, excludedLibraries);

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle>Lectures par Jour</CardTitle>
                        <CardDescription>Volume brut des lancements.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <StandardBarChart data={data.dailyData} dataKey="totalPlays" fill="#3b82f6" name="Lectures" />
                    </CardContent>
                </Card>

                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle>Lectures par Médiathèque</CardTitle>
                        <CardDescription>Répartition par types ou dossiers d'origine.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <StackedBarChart data={data.dailyData} keys={data.collections} suffix="_plays" />
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle>Durée lue par Jour</CardTitle>
                        <CardDescription>Volume horaire (en heures).</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <StandardAreaChart data={data.dailyData} dataKey="totalDuration" stroke="#a855f7" name="Heures" />
                    </CardContent>
                </Card>

                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle>Durée par Médiathèque</CardTitle>
                        <CardDescription>Répartition horaire par bibliothèques.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <StackedAreaChart data={data.dailyData} keys={data.collections} suffix="_duration" />
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle>Lectures (Moy. Horaire)</CardTitle>
                        <CardDescription>Nombre de lancements selon l'heure de la journée.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <StandardBarChart data={data.hourlyData} dataKey="plays" fill="#eab308" name="Lectures" />
                    </CardContent>
                </Card>

                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle>Durées (Moy. Horaire)</CardTitle>
                        <CardDescription>Temps visionné selon l'heure de la journée.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <StandardAreaChart data={data.hourlyData} dataKey="duration" stroke="#22c55e" name="Heures" />
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm lg:col-span-1">
                    <CardHeader>
                        <CardTitle>Segments d'Abandons</CardTitle>
                        <CardDescription>Où les utilisateurs s'arrêtent-ils ?</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] flex items-center justify-center">
                        <StandardBarChart data={data.dropSegments} dataKey="value" fill="#ec4899" name="Vues" horizontal />
                    </CardContent>
                </Card>

                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Taux de Complétion Moyen par Bibliothèque</CardTitle>
                        <CardDescription>Pourcentage moyen de visionnage des médias (100% = Terminés).</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <StandardBarChart data={data.dropOffData} dataKey="completion" fill="#8b5cf6" name="% Moyen" />
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle>Pires Taux de Complétion</CardTitle>
                        <CardDescription>Top 5 des médias abandonnés à répétition.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] flex items-center justify-center">
                        <StandardBarChart data={data.topAbandoned} dataKey="completion" fill="#ef4444" name="% Complétion" horizontal xAxisKey="title" />
                    </CardContent>
                </Card>

                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle>Répartition Audio</CardTitle>
                        <CardDescription>Langues écoutées sur cette période.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] flex items-center justify-center">
                        <StandardPieChart data={data.audioData} nameKey="name" dataKey="value" />
                    </CardContent>
                </Card>

                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle>Sous-titres</CardTitle>
                        <CardDescription>Activés vs Désactivés et langues.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] flex items-center justify-center">
                        <StandardPieChart data={data.subtitleData} nameKey="name" dataKey="value" />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
