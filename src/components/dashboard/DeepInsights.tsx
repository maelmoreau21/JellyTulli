import prisma from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { unstable_cache } from "next/cache";
import { StreamProportionsChart } from "@/components/charts/StreamProportionsChart";

const getDeepInsights = unstable_cache(
    async (type: string | undefined, timeRange: string, excludedLibraries: string[]) => {
        // Find most watched media overall
        const topMedia = await prisma.playbackHistory.groupBy({
            by: ['mediaId'],
            _count: { id: true },
            _sum: { durationWatched: true },
            orderBy: { _count: { id: 'desc' } },
            take: 30
        });

        const popMediaId = topMedia.map(m => m.mediaId);
        const resolvedMedia = await prisma.media.findMany({
            where: { id: { in: popMediaId } },
            select: { id: true, title: true, type: true }
        });

        // Group by category
        const categorized = { movie: [] as any[], series: [] as any[], music: [] as any[], book: [] as any[] };
        topMedia.forEach(m => {
            const media = resolvedMedia.find(r => r.id === m.mediaId);
            if (!media) return;
            const item = {
                title: media.title,
                type: media.type,
                plays: m._count.id,
                duration: (m._sum.durationWatched || 0) / 3600
            };

            const lowerType = media.type.toLowerCase();
            if (lowerType === 'movie') categorized.movie.push(item);
            else if (lowerType.includes('series') || lowerType.includes('episode')) categorized.series.push(item);
            else if (lowerType.includes('audio') || lowerType.includes('track')) categorized.music.push(item);
            else if (lowerType.includes('book')) categorized.book.push(item);
        });

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

        return { categorized, topClients, streamMethodsChartData };
    },
    ['jellytulli-deep-insights-categorized'],
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
        </div>
    );
}
