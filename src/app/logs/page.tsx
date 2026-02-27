import { Navigation } from "@/components/Navigation";
import { LogoutButton } from "@/components/LogoutButton";
import Link from "next/link";
import { PlayCircle, Search, ArrowUpDown, ChevronDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

            <div className="flex-1 space-y-4 p-8 pt-6 max-w-[1400px] mx-auto w-full">
                <div className="flex items-center justify-between space-y-2">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Historique Brut (Logs)</h2>
                        <p className="text-muted-foreground mr-12 mt-2">
                            Retrouvez la liste complète et technique des sessions. Idéal pour le débogage (Transcodage, Logs d'adresses IPv4/IPv6, Codecs utilisés). Limité aux 500 dernières entrées pour des raisons de performances.
                        </p>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Recherche & Filtres</CardTitle>
                        <CardDescription>Trouvez une session spécifique par Titre, IP ou Nom du client utilisé.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <form className="flex md:flex-row flex-col gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                <Input
                                    name="query"
                                    type="text"
                                    defaultValue={query}
                                    placeholder="Rechercher par Titre, IP, Client ou Utilisateur..."
                                    className="pl-9"
                                />
                            </div>
                            <div className="flex gap-2">
                                <div className="border rounded-md px-3 py-2 text-sm bg-background flex flex-row items-center cursor-pointer hover:bg-muted relative group">
                                    <span className="font-semibold mr-2 flex items-center gap-2"><ArrowUpDown className="w-4 h-4" /> Trier par</span>
                                    <ChevronDown className="w-4 h-4" />
                                    {/* Unstyled pseudo-select for simple navigation logic */}
                                    <select name="sort" defaultValue={sort} onChange={(e) => e.target.form?.submit()} className="absolute w-full h-full opacity-0 cursor-pointer left-0 top-0">
                                        <option value="date_desc">Date (Récent)</option>
                                        <option value="date_asc">Date (Ancien)</option>
                                        <option value="duration_desc">Durée (Plus long)</option>
                                        <option value="duration_asc">Durée (Plus court)</option>
                                    </select>
                                </div>
                                <button type="submit" className="bg-primary text-primary-foreground font-medium px-4 py-2 rounded-md hover:bg-primary/90 transition-colors">
                                    Rechercher
                                </button>
                            </div>
                        </form>

                        <div className="border rounded-md overflow-x-auto w-full mt-6">
                            <Table className="min-w-[1000px]">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Utilisateur</TableHead>
                                        <TableHead>Média</TableHead>
                                        <TableHead>Client & IP</TableHead>
                                        <TableHead>Statut (Méthode)</TableHead>
                                        <TableHead>Codecs</TableHead>
                                        <TableHead className="text-right">Durée</TableHead>
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
                                                <TableRow key={log.id}>
                                                    {/* Date */}
                                                    <TableCell className="font-medium whitespace-nowrap">
                                                        {log.startedAt.toLocaleString('fr-FR', {
                                                            day: '2-digit', month: '2-digit', year: 'numeric',
                                                            hour: '2-digit', minute: '2-digit'
                                                        })}
                                                    </TableCell>

                                                    {/* Utilisateur */}
                                                    <TableCell className="font-semibold text-primary">
                                                        {log.user.username}
                                                    </TableCell>

                                                    {/* Média */}
                                                    <TableCell className="truncate max-w-[200px]" title={log.media.title}>
                                                        {log.media.title}
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
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border
                                                                ${isTranscode
                                                                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                                                : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                                            }`}
                                                        >
                                                            {log.playMethod || "DirectPlay"}
                                                        </span>
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
