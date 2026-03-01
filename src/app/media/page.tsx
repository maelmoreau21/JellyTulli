import prisma from "@/lib/prisma";
import { FallbackImage } from "@/components/FallbackImage";
import Link from "next/link";
import { PlayCircle, Film, ArrowDownUp, ChevronLeft, ChevronRight } from "lucide-react";
import { getJellyfinImageUrl } from "@/lib/jellyfin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GenreDistributionChart, GenreData } from "@/components/charts/GenreDistributionChart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const dynamic = "force-dynamic";

interface MediaPageProps {
    searchParams: Promise<{
        sortBy?: string;
        type?: string;
        page?: string;
    }>;
}

const ITEMS_PER_PAGE = 50;

export default async function MediaPage({ searchParams }: MediaPageProps) {
    const sParams = await searchParams;
    const sortBy = sParams.sortBy || "plays"; // 'plays', 'duration', ou 'quality'
    const type = sParams.type;
    const currentPage = Math.max(1, parseInt(sParams.page || "1", 10) || 1);

    // 0. Récupérer les Settings globaux
    const settings = await prisma.globalSettings.findUnique({ where: { id: "global" } });
    const excludedLibraries = settings?.excludedLibraries || [];

    const buildMediaFilter = () => {
        let AND: any[] = [];
        if (type === 'movie') AND.push({ collectionType: "movies" });
        else if (type === 'series') AND.push({ collectionType: "tvshows" });
        else if (type === 'music') AND.push({ collectionType: "music" });
        else {
            // Default "Tous": show all types
        }

        if (excludedLibraries.length > 0) {
            AND.push({
                NOT: {
                    OR: [
                        { type: { in: excludedLibraries } },
                        ...excludedLibraries.map((lib: string) => ({ collectionType: lib }))
                    ]
                }
            });
        }
        return AND.length > 0 ? { AND } : {};
    };

    const mediaWhere = buildMediaFilter();

    // 1. Fetch tous les médias avec l'historique de lecture
    const allMedia = await prisma.media.findMany({
        where: mediaWhere,
        include: {
            playbackHistory: {
                select: {
                    durationWatched: true,
                    playMethod: true,
                },
            },
        },
    });

    // 2. Traitement et calcul des statistiques JavaScript (Agrégation Mémoire)
    const processedMedia = allMedia.map((media: any) => {
        const plays = media.playbackHistory.length;
        const durationSeconds = media.playbackHistory.reduce((acc: number, h: any) => acc + h.durationWatched, 0);
        const durationHours = parseFloat((durationSeconds / 3600).toFixed(1));

        // Calcul qualité vidéo (% de DirectPlay vs Transcode)
        const directPlayCount = media.playbackHistory.filter((h: any) => h.playMethod === "DirectPlay").length;
        const qualityPercent = plays > 0 ? Math.round((directPlayCount / plays) * 100) : 0;

        return {
            ...media,
            plays,
            durationHours,
            qualityPercent, // 100% = Full DirectPlay, 0% = Full Transcode
        };
    });

    // 3. Extraction des Stats Globales (Genres et Résolution)
    const genreCounts = new Map<string, number>();
    const resolutionCounts = new Map<string, number>();

    allMedia.forEach((m: any) => {
        if (m.genres && m.genres.length > 0) {
            m.genres.forEach((g: string) => {
                genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
            });
        }
        if (m.resolution) {
            resolutionCounts.set(m.resolution, (resolutionCounts.get(m.resolution) || 0) + 1);
        }
    });

    const topGenres: GenreData[] = Array.from(genreCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10); // Top 10 genres

    const res4K = resolutionCounts.get("4K") || 0;
    const res1080p = resolutionCounts.get("1080p") || 0;
    const res720p = resolutionCounts.get("720p") || 0;
    const resSD = resolutionCounts.get("SD") || 0;

    // 4. Tri (Sorting)
    if (sortBy === "duration") {
        processedMedia.sort((a: any, b: any) => b.durationHours - a.durationHours);
    } else if (sortBy === "quality") {
        // Trie par qualité décroissante (ceux qui ont le plus gros % de DirectPlay)
        processedMedia.sort((a: any, b: any) => b.qualityPercent - a.qualityPercent);
    } else {
        // Défaut: Tri par nombre de vues "plays"
        processedMedia.sort((a: any, b: any) => b.plays - a.plays);
    }

    // 5. Pagination
    const totalItems = processedMedia.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
    const safePage = Math.min(currentPage, totalPages);
    const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
    const displayMedia = processedMedia.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    // Helper: build pagination URL preserving existing params
    const buildPageUrl = (page: number) => {
        const params = new URLSearchParams();
        if (type) params.set("type", type);
        if (sortBy !== "plays") params.set("sortBy", sortBy);
        if (page > 1) params.set("page", String(page));
        const qs = params.toString();
        return `/media${qs ? `?${qs}` : ""}`;
    };

    return (
        <div className="flex-col md:flex">
            <div className="flex-1 space-y-6 p-8 pt-6">
                <div className="flex items-center justify-between space-y-2 mb-6">
                    <div className="flex items-center gap-6">
                        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                            <Film className="w-8 h-8 opacity-80" /> Bibliothèque
                        </h2>
                        <Tabs defaultValue={type || "all"} className="w-[400px]">
                            <TabsList className="bg-zinc-900 border border-zinc-800">
                                <TabsTrigger value="all" asChild><Link href={`/media${sortBy !== 'plays' ? `?sortBy=${sortBy}` : ''}`}>Tous</Link></TabsTrigger>
                                <TabsTrigger value="movie" asChild><Link href={`/media?type=movie${sortBy !== 'plays' ? `&sortBy=${sortBy}` : ''}`}>Films</Link></TabsTrigger>
                                <TabsTrigger value="series" asChild><Link href={`/media?type=series${sortBy !== 'plays' ? `&sortBy=${sortBy}` : ''}`}>Séries</Link></TabsTrigger>
                                <TabsTrigger value="music" asChild><Link href={`/media?type=music${sortBy !== 'plays' ? `&sortBy=${sortBy}` : ''}`}>Musique</Link></TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </div>

                {/* Section Stats Bibliothèque */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
                    <Card className="col-span-2 bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle>Diversité de la bibliothèque (Top Genres)</CardTitle>
                        </CardHeader>
                        <CardContent className="pl-0 pb-4">
                            <div className="h-[250px] min-h-[250px] w-full">
                                <GenreDistributionChart data={topGenres} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="col-span-1 bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle>Qualité Vidéo Globale</CardTitle>
                            <CardDescription>Répartition par résolution certifiée.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4 mt-4">
                            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg border">
                                <span className="font-semibold text-lg drop-shadow-md bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">4K UHD</span>
                                <span className="text-xl font-bold">{res4K}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg border">
                                <span className="font-semibold text-lg text-blue-400 drop-shadow-md">1080p FHD</span>
                                <span className="text-xl font-bold">{res1080p}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg border">
                                <span className="font-medium text-lg text-emerald-400">720p HD</span>
                                <span className="text-xl font-bold">{res720p}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg border">
                                <span className="font-medium text-zinc-500">Standard / Autre</span>
                                <span className="text-lg font-bold text-zinc-400">{resSD}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle>Tous les Médias</CardTitle>
                        <CardDescription>
                            Liste des {allMedia.length} contenus disponibles extraits depuis Jellyfin.
                        </CardDescription>
                        {/* Barre de tri */}
                        <div className="flex items-center gap-2 pt-4">
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                                <ArrowDownUp className="w-4 h-4" /> Trier par :
                            </span>
                            <div className="flex items-center bg-muted rounded-md p-1">
                                <Link
                                    href={`/media?sortBy=plays${type ? `&type=${type}` : ''}`}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${sortBy === "plays" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/50"}`}
                                >
                                    Popularité (Vues)
                                </Link>
                                <Link
                                    href={`/media?sortBy=duration${type ? `&type=${type}` : ''}`}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${sortBy === "duration" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/50"}`}
                                >
                                    Temps Visionné
                                </Link>
                                <Link
                                    href={`/media?sortBy=quality${type ? `&type=${type}` : ''}`}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${sortBy === "quality" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/50"}`}
                                >
                                    Mode de lecture
                                </Link>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {displayMedia.length === 0 ? (
                            <p className="text-sm text-center text-muted-foreground py-12">
                                Aucun média indexé. N'oubliez pas d'exécuter la synchronisation Jellyfin dans les Paramètres.
                            </p>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                                {displayMedia.map((media: any) => (
                                    <Link href={`/media/${media.jellyfinMediaId}`} key={media.id} className="group flex flex-col space-y-2 relative">
                                        <div className="relative w-full aspect-[2/3] bg-zinc-900 rounded-md overflow-hidden ring-1 ring-white/10 shadow-lg">
                                            <FallbackImage
                                                src={getJellyfinImageUrl(media.jellyfinMediaId, 'Primary', media.parentId || undefined)}
                                                alt={media.title}
                                                width={400}
                                                height={600}
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 group-hover:brightness-50"
                                            />
                                            {/* Top Overlay logic (Quality) */}
                                            {media.plays > 0 && (
                                                <div className="absolute top-2 right-2 flex flex-col items-end gap-1 z-10 transition-opacity duration-300 group-hover:opacity-0">
                                                    <Badge variant={media.qualityPercent >= 80 ? "default" : media.qualityPercent >= 50 ? "secondary" : "destructive"} className="shadow-black/50 shadow-sm backdrop-blur-sm bg-opacity-90">
                                                        {media.qualityPercent}% DP
                                                    </Badge>
                                                </div>
                                            )}
                                            {/* Hover Overlay Title */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 pointer-events-none">
                                                <h3 className="text-white font-bold text-lg leading-tight drop-shadow-md">{media.title}</h3>
                                                {media.productionYear && (
                                                    <span className="text-zinc-300 text-sm font-medium">{media.productionYear}</span>
                                                )}
                                                {media.resolution && (
                                                    <Badge variant="outline" className="w-fit mt-2 text-xs bg-black/50 text-white border-white/20">
                                                        {media.resolution}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-col px-1">
                                            <span className="font-semibold text-sm truncate text-zinc-100" title={media.title}>{media.title}</span>
                                            <div className="flex items-center justify-between text-xs text-zinc-400 mt-1">
                                                <span>{media.plays} {media.plays > 1 ? 'vues' : 'vue'}</span>
                                                {media.durationHours > 0 && <span className="font-medium">{media.durationHours}h</span>}
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 mt-8 pt-4 border-t border-zinc-800/50">
                                {safePage > 1 && (
                                    <Link href={buildPageUrl(safePage - 1)} className="flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors border border-zinc-700 hover:bg-zinc-800">
                                        <ChevronLeft className="w-4 h-4" /> Précédent
                                    </Link>
                                )}
                                <div className="flex items-center gap-1">
                                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                                        .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                                        .reduce<(number | string)[]>((acc, p, idx, arr) => {
                                            if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                                            acc.push(p);
                                            return acc;
                                        }, [])
                                        .map((item, idx) =>
                                            item === "..." ? (
                                                <span key={`ellipsis-${idx}`} className="px-2 text-zinc-500">…</span>
                                            ) : (
                                                <Link
                                                    key={item}
                                                    href={buildPageUrl(item as number)}
                                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                                        item === safePage
                                                            ? "bg-primary text-primary-foreground"
                                                            : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                                                    }`}
                                                >
                                                    {item}
                                                </Link>
                                            )
                                        )}
                                </div>
                                {safePage < totalPages && (
                                    <Link href={buildPageUrl(safePage + 1)} className="flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors border border-zinc-700 hover:bg-zinc-800">
                                        Suivant <ChevronRight className="w-4 h-4" />
                                    </Link>
                                )}
                                <span className="text-xs text-muted-foreground ml-4">
                                    {startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, totalItems)} sur {totalItems}
                                </span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
