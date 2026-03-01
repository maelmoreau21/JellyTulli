import prisma from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { unstable_cache } from "next/cache";
import { StreamProportionsChart } from "@/components/charts/StreamProportionsChart";
import { StandardPieChart } from "@/components/charts/StandardMetricsCharts";

const getDeepInsights = unstable_cache(
    async (type: string | undefined, timeRange: string, excludedLibraries: string[]) => {
        // Find most watched media overall (take more for series/album aggregation)
        const topMedia = await prisma.playbackHistory.groupBy({
            by: ['mediaId'],
            _count: { id: true },
            _sum: { durationWatched: true },
            orderBy: { _count: { id: 'desc' } },
            take: 200
        });

        const popMediaId = topMedia.map(m => m.mediaId);
        const resolvedMedia = await prisma.media.findMany({
            where: { id: { in: popMediaId } },
            select: { id: true, title: true, type: true, parentId: true, jellyfinMediaId: true, genres: true }
        });

        // === Preload ALL Seasons, Series, and Albums for robust parent chain resolution ===
        const allSeasons = await prisma.media.findMany({
            where: { type: 'Season' },
            select: { jellyfinMediaId: true, parentId: true, title: true }
        });
        const allSeries = await prisma.media.findMany({
            where: { type: 'Series' },
            select: { jellyfinMediaId: true, title: true }
        });
        const allAlbums = await prisma.media.findMany({
            where: { type: 'MusicAlbum' },
            select: { jellyfinMediaId: true, title: true, artist: true }
        });

        const seasonMap = new Map(allSeasons.map(s => [s.jellyfinMediaId, s]));
        const seriesMap = new Map(allSeries.map(s => [s.jellyfinMediaId, s.title]));
        const albumMap = new Map(allAlbums.map(a => [a.jellyfinMediaId, a.title]));

        function resolveSeriesTitle(parentId: string | null): string | null {
            if (!parentId) return null;
            // Try: parentId is a Season → Season.parentId is a Series
            const season = seasonMap.get(parentId);
            if (season?.parentId) {
                const seriesTitle = seriesMap.get(season.parentId);
                if (seriesTitle) return seriesTitle;
            }
            // Fallback: parentId might directly be a Series
            const directSeries = seriesMap.get(parentId);
            if (directSeries) return directSeries;
            return null;
        }

        function getAlbumTitle(media: { type: string; parentId: string | null }): string | null {
            if (!media.parentId) return null;
            return albumMap.get(media.parentId) || null;
        }

        // === DEDICATED SERIES AGGREGATION ===
        // Query ALL episode playback (not just top 200) to ensure accurate series ranking
        const allEpisodeHistory = await prisma.playbackHistory.groupBy({
            by: ['mediaId'],
            _count: { id: true },
            _sum: { durationWatched: true },
            where: { media: { type: 'Episode' } }
        });
        const episodeMediaIds = allEpisodeHistory.map(e => e.mediaId);
        const allEpisodes = episodeMediaIds.length > 0
            ? await prisma.media.findMany({
                where: { id: { in: episodeMediaIds } },
                select: { id: true, parentId: true, type: true }
            })
            : [];
        const episodeMap = new Map(allEpisodes.map(e => [e.id, e]));

        const seriesAgg = new Map<string, { plays: number; duration: number }>();
        allEpisodeHistory.forEach(h => {
            const episode = episodeMap.get(h.mediaId);
            if (!episode?.parentId) return;
            const seriesTitle = resolveSeriesTitle(episode.parentId);
            if (!seriesTitle) return;
            const existing = seriesAgg.get(seriesTitle) || { plays: 0, duration: 0 };
            existing.plays += h._count.id;
            existing.duration += (h._sum.durationWatched || 0) / 3600;
            seriesAgg.set(seriesTitle, existing);
        });

        // === DEDICATED ALBUM AGGREGATION ===
        const allAudioHistory = await prisma.playbackHistory.groupBy({
            by: ['mediaId'],
            _count: { id: true },
            _sum: { durationWatched: true },
            where: { media: { type: 'Audio' } }
        });
        const audioMediaIds = allAudioHistory.map(a => a.mediaId);
        const allAudioMedia = audioMediaIds.length > 0
            ? await prisma.media.findMany({
                where: { id: { in: audioMediaIds } },
                select: { id: true, parentId: true, type: true, title: true }
            })
            : [];
        const audioMediaMap = new Map(allAudioMedia.map(a => [a.id, a]));

        const albumAgg = new Map<string, { plays: number; duration: number }>();
        allAudioHistory.forEach(h => {
            const audio = audioMediaMap.get(h.mediaId);
            if (!audio) return;
            const albumTitle = audio.parentId ? (albumMap.get(audio.parentId) || audio.title) : audio.title;
            const existing = albumAgg.get(albumTitle) || { plays: 0, duration: 0 };
            existing.plays += h._count.id;
            existing.duration += (h._sum.durationWatched || 0) / 3600;
            albumAgg.set(albumTitle, existing);
        });

        // Group movies, books, genres from the top 200
        const categorized = { movie: [] as any[], series: [] as any[], album: [] as any[], book: [] as any[] };
        const genreAgg = new Map<string, { plays: number; duration: number }>();

        topMedia.forEach(m => {
            const media = resolvedMedia.find(r => r.id === m.mediaId);
            if (!media) return;
            const lowerType = media.type.toLowerCase();
            const plays = m._count.id;
            const duration = (m._sum.durationWatched || 0) / 3600;

            // Genre aggregation (for all types)
            if (media.genres && media.genres.length > 0) {
                for (const genre of media.genres) {
                    const existing = genreAgg.get(genre) || { plays: 0, duration: 0 };
                    existing.plays += plays;
                    existing.duration += duration;
                    genreAgg.set(genre, existing);
                }
            }

            if (lowerType === 'movie') {
                categorized.movie.push({
                    title: media.title, type: media.type,
                    plays, duration
                });
            } else if (lowerType.includes('book')) {
                categorized.book.push({
                    title: media.title, type: media.type,
                    plays, duration
                });
            }
            // Episodes and Audio handled by dedicated queries above
        });

        // Convert aggregations to sorted arrays
        categorized.series = Array.from(seriesAgg.entries())
            .map(([title, data]) => ({ title, type: 'Series', plays: data.plays, duration: data.duration }))
            .sort((a, b) => b.plays - a.plays);

        categorized.album = Array.from(albumAgg.entries())
            .map(([title, data]) => ({ title, type: 'Album', plays: data.plays, duration: data.duration }))
            .sort((a, b) => b.plays - a.plays);

        const topGenres = Array.from(genreAgg.entries())
            .map(([name, data]) => ({ name, plays: data.plays, duration: parseFloat(data.duration.toFixed(1)) }))
            .sort((a, b) => b.plays - a.plays)
            .slice(0, 10);

        // Slice to top 5 per category
        categorized.movie = categorized.movie.slice(0, 5);
        categorized.series = categorized.series.slice(0, 5);
        categorized.album = categorized.album.slice(0, 5);
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

        return { categorized, topClients, streamMethodsChartData, resolutionChartData, deviceChartData, topGenres };
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
                {renderCategory("Top Albums", data.categorized.album, "Aucun album écouté.")}
                {renderCategory("Top Livres", data.categorized.book, "Aucun livre lu.")}
            </div>

            {/* Top Genres */}
            {data.topGenres.length > 0 && (
                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-md">Top Genres</CardTitle>
                        <CardDescription>Genres les plus écoutés/visionnés par nombre de lectures.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-2 md:grid-cols-2">
                            {data.topGenres.map((g: any, i: number) => {
                                const maxPlays = data.topGenres[0]?.plays || 1;
                                const pct = Math.round((g.plays / maxPlays) * 100);
                                const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-cyan-500', 'bg-yellow-500', 'bg-red-500', 'bg-indigo-500', 'bg-teal-500'];
                                return (
                                    <div key={g.name} className="flex items-center gap-3 text-sm">
                                        <span className="text-zinc-500 w-5 text-right shrink-0">{i + 1}.</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between mb-1">
                                                <span className="truncate">{g.name}</span>
                                                <span className="text-xs text-zinc-400 shrink-0 ml-2">{g.plays} vues · {g.duration}h</span>
                                            </div>
                                            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full ${colors[i % colors.length]}`} style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

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
