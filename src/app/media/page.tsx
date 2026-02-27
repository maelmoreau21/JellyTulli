import prisma from "@/lib/prisma";
import Image from "next/image";
import Link from "next/link";
import { PlayCircle, Film, ArrowDownUp } from "lucide-react";
import { getJellyfinImageUrl } from "@/lib/jellyfin";
import { LogoutButton } from "@/components/LogoutButton";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GenreDistributionChart, GenreData } from "@/components/charts/GenreDistributionChart";

export const dynamic = "force-dynamic";

interface MediaPageProps {
    searchParams: Promise<{
        sortBy?: string;
    }>;
}

export default async function MediaPage({ searchParams }: MediaPageProps) {
    const sParams = await searchParams;
    const sortBy = sParams.sortBy || "plays"; // 'plays', 'duration', ou 'quality'

    // 1. Fetch tous les médias avec l'historique de lecture
    const allMedia = await prisma.media.findMany({
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

    // Limitons aux 100 premiers résultats pour ne pas surcharger le navigateur si la base est immense
    const displayMedia = processedMedia.slice(0, 100);

    return (
        <div className="flex-col md:flex">
            {/* Header unifié avec navigation */}
            <div className="border-b">
                <div className="flex h-16 items-center px-4">
                    <Link href="/" className="text-xl font-bold tracking-tight text-primary flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <PlayCircle className="w-6 h-6" /> JellyTulli
                    </Link>

                    <Navigation />

                    <div className="ml-auto flex items-center space-x-4">
                        <LogoutButton />
                    </div>
                </div>
            </div>

            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex items-center justify-between space-y-2 mb-6">
                    <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Film className="w-8 h-8 opacity-80" /> Bibliothèque
                    </h2>
                </div>

                {/* Section Stats Bibliothèque */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
                    <Card className="col-span-2">
                        <CardHeader>
                            <CardTitle>Diversité de la bibliothèque (Top Genres)</CardTitle>
                        </CardHeader>
                        <CardContent className="pl-0 pb-4">
                            <div className="h-[250px] min-h-[250px] w-full">
                                <GenreDistributionChart data={topGenres} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="col-span-1">
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

                <Card>
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
                                    href="?sortBy=plays"
                                    className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${sortBy === "plays" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/50"}`}
                                >
                                    Popularité (Vues)
                                </Link>
                                <Link
                                    href="?sortBy=duration"
                                    className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${sortBy === "duration" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/50"}`}
                                >
                                    Temps Visionné
                                </Link>
                                <Link
                                    href="?sortBy=quality"
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
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                                {displayMedia.map((media: any) => (
                                    <div key={media.id} className="group flex flex-col space-y-2 relative">
                                        <div className="relative w-full aspect-[2/3] bg-zinc-900 rounded-md overflow-hidden ring-1 ring-white/10 transition-transform group-hover:scale-[1.03] group-hover:ring-primary/50 shadow-lg">
                                            <Image
                                                src={getJellyfinImageUrl(media.jellyfinMediaId, 'Primary')}
                                                alt={media.title}
                                                fill
                                                unoptimized
                                                className="object-cover"
                                            />
                                            {/* Top Overlay logic (Quality) */}
                                            {media.plays > 0 && (
                                                <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                                                    <Badge variant={media.qualityPercent >= 80 ? "default" : media.qualityPercent >= 50 ? "secondary" : "destructive"} className="shadow-black/50 shadow-sm backdrop-blur-sm bg-opacity-90">
                                                        {media.qualityPercent}% DP
                                                    </Badge>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col px-1">
                                            <span className="font-semibold text-sm truncate text-zinc-100" title={media.title}>{media.title}</span>
                                            <div className="flex items-center justify-between text-xs text-zinc-400 mt-1">
                                                <span>{media.plays} {media.plays > 1 ? 'vues' : 'vue'}</span>
                                                {media.durationHours > 0 && <span className="font-medium">{media.durationHours}h</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {processedMedia.length > 100 && (
                            <p className="text-xs text-muted-foreground text-center mt-4">
                                Seuls les 100 premiers résultats (sur {processedMedia.length}) sont affichés pour optimiser les performances.
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
