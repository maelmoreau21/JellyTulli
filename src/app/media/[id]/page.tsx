import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Image from "next/image";
import { getJellyfinImageUrl } from "@/lib/jellyfin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, Eye, Timer, ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import MediaDropoffChart from "./MediaDropoffChart";

export const dynamic = "force-dynamic";

interface MediaProfilePageProps {
    params: Promise<{ id: string }>;
}

export default async function MediaProfilePage({ params }: MediaProfilePageProps) {
    const { id } = await params;

    // Chercher le média par jellyfinMediaId
    const media = await prisma.media.findUnique({
        where: { jellyfinMediaId: id },
        include: {
            playbackHistory: {
                include: { user: true },
                orderBy: { startedAt: "desc" },
            },
        },
    });

    if (!media) notFound();

    // Récupérer le résumé depuis l'API Jellyfin
    let overview = "";
    let communityRating: number | null = null;
    let productionYear: number | null = null;
    // Breadcrumb hierarchy data
    let seriesId: string | null = null;
    let seriesName: string | null = null;
    let seasonId: string | null = null;
    let seasonName: string | null = null;
    let albumId: string | null = null;
    let albumName: string | null = null;
    try {
        const settings = await prisma.globalSettings.findUnique({ where: { id: "global" } });
        if (settings?.jellyfinUrl && settings?.jellyfinApiKey) {
            const res = await fetch(
                `${settings.jellyfinUrl}/Items/${id}?api_key=${settings.jellyfinApiKey}`,
                { next: { revalidate: 86400 } }
            );
            if (res.ok) {
                const data = await res.json();
                overview = data.Overview || "";
                communityRating = data.CommunityRating || null;
                productionYear = data.ProductionYear || null;
                seriesId = data.SeriesId || null;
                seriesName = data.SeriesName || null;
                seasonId = data.SeasonId || null;
                seasonName = data.SeasonName || null;
                albumId = data.AlbumId || null;
                albumName = data.Album || null;
            }
        }
    } catch {}

    // Statistiques globales
    const totalViews = media.playbackHistory.length;
    const totalSeconds = media.playbackHistory.reduce((acc: number, h: any) => acc + h.durationWatched, 0);
    const totalHours = parseFloat((totalSeconds / 3600).toFixed(1));
    const avgMinutes = totalViews > 0 ? Math.round(totalSeconds / totalViews / 60) : 0;

    // Drop-off : répartition des sessions par tranche de complétion
    const mediaDurationSeconds = media.durationMs ? Number(media.durationMs) / 1000 : null;

    const dropoffBuckets = Array.from({ length: 10 }, (_, i) => ({
        range: `${i * 10}-${(i + 1) * 10}%`,
        count: 0,
    }));

    if (mediaDurationSeconds && mediaDurationSeconds > 0) {
        media.playbackHistory.forEach((h: any) => {
            const pct = Math.min((h.durationWatched / mediaDurationSeconds) * 100, 100);
            const bucket = Math.min(Math.floor(pct / 10), 9);
            dropoffBuckets[bucket].count++;
        });
    }

    // Genres
    const genres = media.genres || [];

    return (
        <div className="flex-col md:flex">
            <div className="flex-1 space-y-6 p-8 pt-6 max-w-[1400px] mx-auto w-full">
                {/* Breadcrumb Navigation */}
                <nav className="flex items-center gap-1.5 text-sm text-zinc-400 flex-wrap">
                    <Link href="/media" className="flex items-center gap-1 hover:text-white transition-colors">
                        <ArrowLeft className="w-4 h-4" /> Bibliothèque
                    </Link>
                    {seriesId && seriesName && (
                        <>
                            <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
                            <Link href={`/media/${seriesId}`} className="hover:text-white transition-colors">
                                {seriesName}
                            </Link>
                        </>
                    )}
                    {seasonId && seasonName && (
                        <>
                            <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
                            <Link href={`/media/${seasonId}`} className="hover:text-white transition-colors">
                                {seasonName}
                            </Link>
                        </>
                    )}
                    {albumId && albumName && (
                        <>
                            <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
                            <Link href={`/media/${albumId}`} className="hover:text-white transition-colors">
                                {albumName}
                            </Link>
                        </>
                    )}
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
                    <span className="text-white font-medium truncate max-w-xs">{media.title}</span>
                </nav>

                {/* En-tête du Média */}
                <div className="flex flex-col md:flex-row gap-8">
                    <div className="relative w-48 aspect-[2/3] bg-zinc-900 rounded-lg overflow-hidden ring-1 ring-white/10 shadow-xl shrink-0">
                        <Image
                            src={getJellyfinImageUrl(media.jellyfinMediaId, "Primary")}
                            alt={media.title}
                            fill
                            unoptimized
                            className="object-cover"
                        />
                    </div>
                    <div className="flex-1 space-y-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">{media.title}</h1>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <Badge variant="outline">{media.type}</Badge>
                                {media.resolution && <Badge variant="secondary">{media.resolution}</Badge>}
                                {mediaDurationSeconds && (
                                    <Badge variant="secondary" className="bg-zinc-800 text-zinc-300">
                                        {Math.floor(mediaDurationSeconds / 60)} min
                                    </Badge>
                                )}
                                {productionYear && (
                                    <Badge variant="secondary" className="bg-zinc-800 text-zinc-300">
                                        {productionYear}
                                    </Badge>
                                )}
                                {communityRating && (
                                    <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                                        ★ {communityRating.toFixed(1)}
                                    </Badge>
                                )}
                            </div>
                            {genres.length > 0 && (
                                <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                                    {genres.map((g: string) => (
                                        <span key={g} className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">{g}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                        {overview && (
                            <p className="text-sm text-zinc-400 leading-relaxed max-w-2xl line-clamp-5">
                                {overview}
                            </p>
                        )}
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid gap-4 md:grid-cols-3">
                    <Card className="bg-zinc-900/50 border-zinc-800/50">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Temps de Visionnage Total</CardTitle>
                            <Clock className="h-4 w-4 text-orange-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalHours}h</div>
                            <p className="text-xs text-muted-foreground mt-1">Cumulé toutes sessions</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-zinc-900/50 border-zinc-800/50">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Nombre de Vues</CardTitle>
                            <Eye className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalViews}</div>
                            <p className="text-xs text-muted-foreground mt-1">Sessions de lecture uniques</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-zinc-900/50 border-zinc-800/50">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Durée Moyenne</CardTitle>
                            <Timer className="h-4 w-4 text-emerald-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{avgMinutes} min</div>
                            <p className="text-xs text-muted-foreground mt-1">Par session de lecture</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Drop-off Chart */}
                {mediaDurationSeconds && mediaDurationSeconds > 0 && (
                    <Card className="bg-zinc-900/50 border-zinc-800/50">
                        <CardHeader>
                            <CardTitle>Télémétrie & Chute (Drop-off)</CardTitle>
                            <CardDescription>À quel pourcentage du média les utilisateurs ont arrêté la lecture.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px] w-full">
                                <MediaDropoffChart data={dropoffBuckets} />
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Historique Détaillé */}
                <Card className="bg-zinc-900/50 border-zinc-800/50">
                    <CardHeader>
                        <CardTitle>Historique Détaillé</CardTitle>
                        <CardDescription>
                            Toutes les sessions de lecture pour ce média ({totalViews} au total).
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-md overflow-x-auto border-zinc-800/50">
                            <Table className="min-w-[800px]">
                                <TableHeader>
                                    <TableRow className="border-zinc-800">
                                        <TableHead>Utilisateur</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Méthode</TableHead>
                                        <TableHead>Audio</TableHead>
                                        <TableHead>Sous-titres</TableHead>
                                        <TableHead className="text-right">Durée</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {media.playbackHistory.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                                Aucune session enregistrée pour ce média.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        media.playbackHistory.map((h: any) => {
                                            const isTranscode = h.playMethod?.toLowerCase().includes("transcode");
                                            return (
                                                <TableRow key={h.id} className="border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                                                    <TableCell className="font-medium text-primary">
                                                        {h.user ? (
                                                            <Link href={`/users/${h.user.jellyfinUserId}`} className="hover:underline">
                                                                {h.user.username || "Utilisateur Supprimé"}
                                                            </Link>
                                                        ) : (
                                                            <span className="text-zinc-500">Utilisateur Supprimé</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-zinc-400 whitespace-nowrap">
                                                        {new Date(h.startedAt).toLocaleString("fr-FR", {
                                                            day: "2-digit", month: "2-digit", year: "numeric",
                                                            hour: "2-digit", minute: "2-digit",
                                                        })}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant={isTranscode ? "destructive" : "default"}
                                                            className={isTranscode
                                                                ? "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
                                                                : "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"}
                                                        >
                                                            {h.playMethod || "DirectPlay"}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        {h.audioLanguage ? (
                                                            <span className="font-mono text-xs bg-zinc-800 px-1.5 py-0.5 rounded">
                                                                {h.audioLanguage}{h.audioCodec ? ` (${h.audioCodec})` : ""}
                                                            </span>
                                                        ) : (
                                                            <span className="text-zinc-500 italic text-xs">—</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        {h.subtitleLanguage ? (
                                                            <span className="font-mono text-xs bg-zinc-800 px-1.5 py-0.5 rounded">
                                                                {h.subtitleLanguage}{h.subtitleCodec ? ` (${h.subtitleCodec})` : ""}
                                                            </span>
                                                        ) : (
                                                            <span className="text-zinc-500 italic text-xs">—</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right whitespace-nowrap font-medium">
                                                        {h.durationWatched > 0
                                                            ? `${Math.floor(h.durationWatched / 60)} min`
                                                            : <span className="text-zinc-500 text-xs">0 min</span>
                                                        }
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
