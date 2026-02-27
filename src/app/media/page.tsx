import prisma from "@/lib/prisma";
import Image from "next/image";
import Link from "next/link";
import { PlayCircle, Film, ArrowDownUp } from "lucide-react";
import { getJellyfinImageUrl } from "@/lib/jellyfin";
import { LogoutButton } from "@/components/LogoutButton";
import { Navigation } from "@/components/Navigation";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const revalidate = 0; // Disable static caching so the db is always queried live.

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

    // 3. Tri (Sorting)
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
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[300px]">Média</TableHead>
                                            <TableHead className="text-center">Lectures Réussies</TableHead>
                                            <TableHead className="text-center">Volume Horaire</TableHead>
                                            <TableHead className="text-right">Qualité (Ratio DirectPlay)</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {displayMedia.map((media: any) => (
                                            <TableRow key={media.id}>
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative w-10 h-14 bg-muted rounded shrink-0 overflow-hidden">
                                                            <Image
                                                                src={getJellyfinImageUrl(media.jellyfinMediaId, 'Primary')}
                                                                alt={media.title}
                                                                fill
                                                                unoptimized
                                                                className="object-cover"
                                                            />
                                                        </div>
                                                        <div className="flex flex-col max-w-[200px]">
                                                            <span className="truncate" title={media.title}>{media.title}</span>
                                                            <span className="text-xs text-muted-foreground">{media.type}</span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center font-bold">
                                                    {media.plays}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {media.durationHours > 0 ? `${media.durationHours}h` : "-"}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {media.plays > 0 ? (
                                                        <div className="flex flex-col items-end justify-center">
                                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${media.qualityPercent >= 80 ? "bg-emerald-500/10 text-emerald-500" :
                                                                media.qualityPercent >= 50 ? "bg-orange-500/10 text-orange-500" :
                                                                    "bg-red-500/10 text-red-500"
                                                                }`}>
                                                                {media.qualityPercent}% DirectPlay
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground text-xs italic">Non lu</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
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
