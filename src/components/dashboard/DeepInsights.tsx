import prisma from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { unstable_cache } from "next/cache";
import { StreamProportionsChart } from "@/components/charts/StreamProportionsChart";
import { StandardPieChart } from "@/components/charts/StandardMetricsCharts";

const getDeepInsights = unstable_cache(
    async (type: string | undefined, timeRange: string, excludedLibraries: string[]) => {
        // Find most watched media overall (take more for series aggregation)
        const topMedia = await prisma.playbackHistory.groupBy({
            by: ['mediaId'],
            _count: { id: true },
            _sum: { durationWatched: true },
            orderBy: { _count: { id: 'desc' } },
            take: 100
        });

        const popMediaId = topMedia.map(m => m.mediaId);
        const resolvedMedia = await prisma.media.findMany({
            where: { id: { in: popMediaId } },
            select: { id: true, title: true, type: true, parentId: true, jellyfinMediaId: true }
        });

        // === Series Resolution: Episode → Season → Series (2-hop parent chain) ===
        const episodeParentIds = [...new Set(
            resolvedMedia
                .filter(m => m.type === 'Episode')
                .map(m => m.parentId)
                .filter((id): id is string => !!id)
        )];

        const seasons = episodeParentIds.length > 0
            ? await prisma.media.findMany({
                where: { jellyfinMediaId: { in: episodeParentIds } },
                select: { jellyfinMediaId: true, parentId: true, title: true }
            })
            : [];

        const seasonParentIds = [...new Set(seasons.map(s => s.parentId).filter((id): id is string => !!id))];

        const seriesItems = seasonParentIds.length > 0
            ? await prisma.media.findMany({
                where: { jellyfinMediaId: { in: seasonParentIds } },
                select: { jellyfinMediaId: true, title: true }
            })
            : [];

        const seasonMap = new Map(seasons.map(s => [s.jellyfinMediaId, s]));
        const seriesMap = new Map(seriesItems.map(s => [s.jellyfinMediaId, s.title]));

        function getSeriesTitle(media: { type: string; parentId: string | null }): string | null {
            if (media.type !== 'Episode' || !media.parentId) return null;
            const season = seasonMap.get(media.parentId);
            if (!season?.parentId) return null;
            return seriesMap.get(season.parentId) || null;
        }

        // Group by category — aggregate episodes into series
        const categorized = { movie: [] as any[], series: [] as any[], music: [] as any[], book: [] as any[] };
        const seriesAgg = new Map<string, { plays: number; duration: number }>();

        topMedia.forEach(m => {
            const media = resolvedMedia.find(r => r.id === m.mediaId);
            if (!media) return;
            const lowerType = media.type.toLowerCase();

            if (lowerType === 'movie') {
                categorized.movie.push({
                    title: media.title, type: media.type,
                    plays: m._count.id, duration: (m._sum.durationWatched || 0) / 3600
                });
            } else if (lowerType === 'episode') {
                const seriesTitle = getSeriesTitle(media) || media.title;
                const existing = seriesAgg.get(seriesTitle) || { plays: 0, duration: 0 };
                existing.plays += m._count.id;
                existing.duration += (m._sum.durationWatched || 0) / 3600;
                seriesAgg.set(seriesTitle, existing);
            } else if (lowerType === 'series') {
                const existing = seriesAgg.get(media.title) || { plays: 0, duration: 0 };
                existing.plays += m._count.id;
                existing.duration += (m._sum.durationWatched || 0) / 3600;
                seriesAgg.set(media.title, existing);
            } else if (lowerType.includes('audio') || lowerType.includes('track')) {
                categorized.music.push({
                    title: media.title, type: media.type,
                    plays: m._count.id, duration: (m._sum.durationWatched || 0) / 3600
                });
            } else if (lowerType.includes('book')) {
                categorized.book.push({
                    title: media.title, type: media.type,
                    plays: m._count.id, duration: (m._sum.durationWatched || 0) / 3600
                });
            }
        });

        // Convert series aggregation to sorted array
        categorized.series = Array.from(seriesAgg.entries())
            .map(([title, data]) => ({ title, type: 'Series', plays: data.plays, duration: data.duration }))
            .sort((a, b) => b.plays - a.plays);

        // Slice to top 5 per category
        categorized.movie = categorized.movie.slice(0, 5);
        categorized.series = categorized.series.slice(0, 5);
        categorized.music = categorized.music.slice(0, 5);
        categorized.book = categorized.book.slice(0, 5);

        const topClients = await prisma.playbackHistory.groupBy({
            by: ['clientName'],
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
            take: 5
        });

        const streamMethods = await prisma.playbackHistory.groupBy({
            by: ['playMethod'],
            _count: { id: true },
        });

        const streamMethodsChartData = streamMethods.map(s => ({
            name: s.playMethod || "Inconnu",
            value: s._count.id
        }));

        // --- Pro Telemetry: Resolution Matrix ---
        // Join PlaybackHistory → Media to get resolution distribution (only count items with known resolution)
        const resolutionData = await prisma.playbackHistory.findMany({
            select: { media: { select: { resolution: true } } },
        });

        const resolutionMap = new Map<string, number>();
        resolutionData.forEach(r => {
            const res = r.media?.resolution;
            if (res) {
                resolutionMap.set(res, (resolutionMap.get(res) || 0) + 1);
            }
        });

        // Only show "Inconnu" if there's no resolution data at all (fallback)
        if (resolutionMap.size === 0 && resolutionData.length > 0) {
            resolutionMap.set("Inconnu", resolutionData.length);
        }

        const resolutionChartData = Array.from(resolutionMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6);

        // --- Pro Telemetry: Device Ecosystem ---
        // More detailed than PlatformDistributionChart: clientName + deviceName combo
        const deviceData = await prisma.playbackHistory.findMany({
            select: { clientName: true, deviceName: true },
        });

        const deviceMap = new Map<string, number>();
        deviceData.forEach(d => {
            // Combine client + device for a more detailed breakdown
            const device = d.deviceName || "Appareil Inconnu";
            deviceMap.set(device, (deviceMap.get(device) || 0) + 1);
        });

        const deviceChartData = Array.from(deviceMap.entries())
            .map(([name, value]) => ({ name: name.length > 20 ? name.substring(0, 20) + "…" : name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8);

        return { categorized, topClients, streamMethodsChartData, resolutionChartData, deviceChartData };
    },
    ['jellytulli-deep-insights-v2'],
    { revalidate: 300 } // Cache for 5 minutes
);

export async function DeepInsights({ type, timeRange, excludedLibraries }: { type?: string, timeRange: string, excludedLibraries: string[] }) {
    const data = await getDeepInsights(type, timeRange, excludedLibraries);

    const renderCategory = (title: string, items: any[], empty: string) => (
        <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-md">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {items.length === 0 ? <p className="text-xs text-muted-foreground">{empty}</p> : null}
                    {items.map((m, i) => (
                        <div key={i} className="flex justify-between items-center text-sm">
                            <div className="truncate pr-2 max-w-[180px]">
                                <span className="text-zinc-500 w-4 inline-block">{i + 1}.</span>
                                {m.title}
                            </div>
                            <div className="font-semibold text-xs bg-zinc-800/50 px-2 py-1 rounded">{m.plays} vues</div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {renderCategory("Top Films", data.categorized.movie, "Aucun film visionné.")}
                {renderCategory("Top Séries", data.categorized.series, "Aucune série visionnée.")}
                {renderCategory("Top Musiques", data.categorized.music, "Aucune musique écoutée.")}
                {renderCategory("Top Livres", data.categorized.book, "Aucun livre lu.")}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">

                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle>Top Clients</CardTitle>
                        <CardDescription>Applications les plus utilisées.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {data.topClients.map((c, i) => (
                                <div key={i} className="flex justify-between items-center text-sm">
                                    <div className="truncate pr-2">{c.clientName || 'Inconnu'}</div>
                                    <div className="font-semibold">{c._count.id} sessions</div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle>Méthodes de Flux</CardTitle>
                        <CardDescription>Ratio DirectPlay / Transcode.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex justify-center">
                        <StreamProportionsChart data={data.streamMethodsChartData} />
                    </CardContent>
                </Card>
            </div>

            {/* Pro Telemetry Section */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle>Matrice Résolution</CardTitle>
                        <CardDescription>Répartition des sessions par résolution du média (4K, 1080p, 720p, SD).</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] flex items-center justify-center">
                        {data.resolutionChartData.length > 0 ? (
                            <StandardPieChart data={data.resolutionChartData} nameKey="name" dataKey="value" />
                        ) : (
                            <p className="text-xs text-muted-foreground">Aucune donnée de résolution disponible.</p>
                        )}
                    </CardContent>
                </Card>

                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle>Écosystème Appareils</CardTitle>
                        <CardDescription>Top 8 des appareils physiques utilisés pour la lecture.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] flex items-center justify-center">
                        {data.deviceChartData.length > 0 ? (
                            <StandardPieChart data={data.deviceChartData} nameKey="name" dataKey="value" />
                        ) : (
                            <p className="text-xs text-muted-foreground">Aucune donnée d'appareils disponible.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
