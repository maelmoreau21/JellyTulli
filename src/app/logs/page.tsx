import { PlayCircle, Search, ArrowUpDown, ChevronDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogFilters } from "./LogFilters";
import { FallbackImage } from "@/components/FallbackImage";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic"; // Bypass statis rendering for real-time logs

export default async function LogsPage({
    searchParams
}: {
    searchParams: Promise<{ query?: string, sort?: string }>
}) {
    const params = await searchParams;
    const query = params.query?.toLowerCase() || "";
    const sort = params.sort || "date_desc";

    // Build the non-fuzzy exact search constraint
    const whereClause: any = query ? {
        OR: [
            { user: { username: { contains: query, mode: "insensitive" } } },
            { media: { title: { contains: query, mode: "insensitive" } } },
            { ipAddress: { contains: query, mode: "insensitive" } },
            { clientName: { contains: query, mode: "insensitive" } },
        ]
    } : {};

    // Determine the sorting order
    let orderBy: any = { startedAt: "desc" };
    if (sort === "date_asc") orderBy = { startedAt: "asc" };
    else if (sort === "duration_desc") orderBy = { durationWatched: "desc" };
    else if (sort === "duration_asc") orderBy = { durationWatched: "asc" };

    const logs = await prisma.playbackHistory.findMany({
        where: whereClause,
        include: {
            user: true,
            media: true,
        },
        orderBy: orderBy,
        take: 500, // Limit to 500 rows to prevent overwhelming the browser
    });

    return (
        <div className="flex-col md:flex">
            <div className="flex-1 space-y-6 p-8 pt-6 max-w-[1400px] mx-auto w-full">
                <div className="flex items-center justify-between space-y-2">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Historique Brut (Logs)</h2>
                        <p className="text-muted-foreground mr-12 mt-2">
                            Retrouvez la liste complète et technique des sessions. Idéal pour le débogage (Transcodage, Logs d'adresses IPv4/IPv6, Codecs utilisés). Limité aux 500 dernières entrées pour des raisons de performances.
                        </p>
                    </div>
                </div>

                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle>Recherche & Filtres</CardTitle>
                        <CardDescription>Trouvez une session spécifique par Titre, IP ou Nom du client utilisé.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <LogFilters initialQuery={query} initialSort={sort} />

                        <div className="border rounded-md overflow-x-auto w-full mt-6">
                            <Table className="min-w-[1000px] table-fixed">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[130px]">Date</TableHead>
                                        <TableHead className="w-[120px]">Utilisateur</TableHead>
                                        <TableHead className="w-[250px]">Média</TableHead>
                                        <TableHead className="w-[160px]">Client & IP</TableHead>
                                        <TableHead className="w-[130px]">Statut (Méthode)</TableHead>
                                        <TableHead className="w-[100px]">Codecs</TableHead>
                                        <TableHead className="w-[80px] text-right">Durée</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {logs.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                                                Aucune archive trouvée pour ces critères.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        logs.map((log: any) => {
                                            const isTranscode = log.playMethod?.toLowerCase().includes("transcode");

                                            return (
                                                <TableRow key={log.id} className="even:bg-zinc-900/30 hover:bg-zinc-800/50 border-zinc-800/50 transition-colors">
                                                    {/* Date */}
                                                    <TableCell className="font-medium whitespace-nowrap">
                                                        {log.startedAt.toLocaleString('fr-FR', {
                                                            day: '2-digit', month: '2-digit', year: 'numeric',
                                                            hour: '2-digit', minute: '2-digit'
                                                        })}
                                                    </TableCell>

                                                    {/* Utilisateur */}
                                                    <TableCell className="font-semibold text-primary">
                                                        {log.user?.username || "Utilisateur Supprimé"}
                                                    </TableCell>

                                                    {/* Média */}
                                                    <TableCell className="overflow-hidden">
                                                        <div className="flex items-center gap-3 w-full overflow-hidden" title={log.media.title}>
                                                            <div className="relative w-12 aspect-[2/3] bg-muted rounded-md shrink-0 overflow-hidden ring-1 ring-white/10">
                                                                <FallbackImage
                                                                    src={`/api/jellyfin/image?itemId=${log.media.jellyfinMediaId}&type=Primary`}
                                                                    alt={log.media.title}
                                                                />
                                                            </div>
                                                            <div className="flex flex-col min-w-0 flex-1">
                                                                <span className="truncate font-medium text-zinc-100" title={log.media.title}>{log.media.title}</span>
                                                                <span className="text-xs text-zinc-500">{log.media.type}</span>
                                                            </div>
                                                        </div>
                                                    </TableCell>

                                                    {/* Client & IP */}
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-semibold">{log.clientName || "Inconnu"}</span>
                                                            <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded-sm w-fit mt-0.5">
                                                                {log.ipAddress || "Local"}
                                                            </span>
                                                            {log.country && log.country !== "Unknown" && (
                                                                <span className="text-xs text-muted-foreground mt-0.5">
                                                                    {log.city}, {log.country}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>

                                                    {/* Statut (Méthode) */}
                                                    <TableCell>
                                                        <Badge variant={isTranscode ? "destructive" : "default"} className={`shadow-sm ${isTranscode ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'}`}>
                                                            {log.playMethod || "DirectPlay"}
                                                        </Badge>
                                                    </TableCell>

                                                    {/* Codecs */}
                                                    <TableCell>
                                                        {isTranscode && log.videoCodec ? (
                                                            <div className="flex flex-col text-xs text-muted-foreground font-mono">
                                                                <span>V: {log.videoCodec}</span>
                                                                {log.audioCodec && <span>A: {log.audioCodec}</span>}
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground italic">Source</span>
                                                        )}
                                                    </TableCell>

                                                    {/* Durée */}
                                                    <TableCell className="text-right whitespace-nowrap">
                                                        {log.durationWatched
                                                            ? `${Math.floor(log.durationWatched / 60)} min`
                                                            : (
                                                                <span className="text-amber-500/80 animate-pulse text-xs uppercase tracking-wider font-semibold flex flex-row items-center justify-end gap-1"><span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>En cours</span>
                                                            )
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
