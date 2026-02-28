import prisma from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { unstable_cache } from "next/cache";
import { format } from "date-fns";
import { StandardAreaChart, StandardBarChart } from "@/components/charts/StandardMetricsCharts";
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
                media: { select: { collectionType: true, type: true } }
            },
            orderBy: { startedAt: 'asc' }
        });

        const dailyMap = new Map<string, any>();
        const hourlyMap = new Map<string, any>();
        const collections = new Set<string>();

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

        return { dailyData, hourlyData, collections: Array.from(collections) };
    },
    ['jellytulli-granular-analysis'],
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
        </div>
    );
}
