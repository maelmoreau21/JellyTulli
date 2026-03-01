"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Ghost, HeartCrack, Clock, Film, Tv, Music, BookOpen } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface GhostMedia {
    id: string;
    jellyfinMediaId: string;
    title: string;
    type: string;
    createdAt: Date;
    dateAdded?: Date | null;
}

interface AbandonedMedia {
    id: string;
    jellyfinMediaId: string;
    title: string;
    type: string;
    maxCompletion: number;
    lastPlayed: Date;
}

interface CleanupData {
    ghostMedia: GhostMedia[];
    abandonedMedia: AbandonedMedia[];
}

function getTypeIcon(type: string) {
    switch (type) {
        case "Movie": return <Film className="w-3.5 h-3.5 text-blue-400" />;
        case "Series": return <Tv className="w-3.5 h-3.5 text-green-400" />;
        case "MusicAlbum": return <Music className="w-3.5 h-3.5 text-yellow-400" />;
        case "Episode": return <Tv className="w-3.5 h-3.5 text-emerald-400" />;
        case "Audio": return <Music className="w-3.5 h-3.5 text-orange-400" />;
        default: return <BookOpen className="w-3.5 h-3.5 text-zinc-400" />;
    }
}

function getTypeLabel(type: string) {
    switch (type) {
        case "Movie": return "Film";
        case "Series": return "Série";
        case "MusicAlbum": return "Album";
        case "Episode": return "Épisode";
        case "Audio": return "Piste";
        default: return type;
    }
}

function getCompletionColor(pct: number) {
    if (pct < 10) return "text-red-400";
    if (pct < 25) return "text-orange-400";
    if (pct < 50) return "text-yellow-400";
    return "text-amber-400";
}

function getCompletionLabel(pct: number) {
    if (pct < 10) return "Zappé";
    if (pct < 25) return "Essayé";
    if (pct < 50) return "Mi-parcours";
    return "Presque";
}

export default function CleanupClient({ initialData }: { initialData: CleanupData }) {
    const [ghostFilter, setGhostFilter] = useState<string>("all");
    const [abandonFilter, setAbandonFilter] = useState<string>("all");

    const filteredGhosts = ghostFilter === "all"
        ? initialData.ghostMedia
        : initialData.ghostMedia.filter(m => m.type === ghostFilter);

    const filteredAbandoned = abandonFilter === "all"
        ? initialData.abandonedMedia
        : initialData.abandonedMedia.filter(m => m.type === abandonFilter);

    const ghostTypeCounts = { Movie: 0, Series: 0, MusicAlbum: 0 };
    initialData.ghostMedia.forEach(m => {
        if (m.type in ghostTypeCounts) (ghostTypeCounts as any)[m.type]++;
    });

    const abandonTypeCounts = { Movie: 0, Episode: 0, Audio: 0 };
    initialData.abandonedMedia.forEach(m => {
        if (m.type in abandonTypeCounts) (abandonTypeCounts as any)[m.type]++;
    });

    return (
        <Tabs defaultValue="ghosts" className="w-full">
            <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
                <TabsTrigger value="ghosts" className="flex items-center gap-2">
                    <Ghost className="w-4 h-4" />
                    Médias Fantômes ({initialData.ghostMedia.length})
                </TabsTrigger>
                <TabsTrigger value="abandoned" className="flex items-center gap-2">
                    <HeartCrack className="w-4 h-4" />
                    Médias Abandonnés ({initialData.abandonedMedia.length})
                </TabsTrigger>
            </TabsList>

            <TabsContent value="ghosts" className="mt-6">
                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="text-red-400">Médias Fantômes</CardTitle>
                        <CardDescription>
                            Contenu ajouté il y a plus de 30 jours mais qui n'a jamais été regardé par personne.
                        </CardDescription>
                        <div className="flex gap-2 pt-2">
                            {[
                                { key: "all", label: "Tous" },
                                { key: "Movie", label: `Films (${ghostTypeCounts.Movie})` },
                                { key: "Series", label: `Séries (${ghostTypeCounts.Series})` },
                                { key: "MusicAlbum", label: `Albums (${ghostTypeCounts.MusicAlbum})` },
                            ].map(f => (
                                <button key={f.key} onClick={() => setGhostFilter(f.key)}
                                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${ghostFilter === f.key ? 'bg-red-500/20 border-red-500/40 text-red-300' : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'}`}>
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border border-zinc-800">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-zinc-800 hover:bg-zinc-800/50">
                                        <TableHead>Titre</TableHead>
                                        <TableHead className="w-[100px]">Type</TableHead>
                                        <TableHead className="w-[150px]">Ajouté</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredGhosts.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={3} className="h-24 text-center text-zinc-500">
                                                Aucun média fantôme. Votre serveur est propre !
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {filteredGhosts.map((media) => (
                                        <TableRow key={media.id} className="border-zinc-800 hover:bg-zinc-800/20">
                                            <TableCell className="font-medium text-zinc-200">{media.title}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="border-zinc-700 flex items-center gap-1.5 w-fit">
                                                    {getTypeIcon(media.type)}
                                                    {getTypeLabel(media.type)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                <div className="flex items-center gap-2">
                                                    <Clock className="w-3 h-3" />
                                                    {formatDistanceToNow(new Date(media.dateAdded || media.createdAt), { addSuffix: true, locale: fr })}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="abandoned" className="mt-6">
                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="text-orange-400">Médias Abandonnés</CardTitle>
                        <CardDescription>
                            Contenu commencé mais dont le taux de complétion n'a jamais dépassé 80%.
                        </CardDescription>
                        <div className="flex gap-2 pt-2">
                            {[
                                { key: "all", label: "Tous" },
                                { key: "Movie", label: `Films (${abandonTypeCounts.Movie})` },
                                { key: "Episode", label: `Épisodes (${abandonTypeCounts.Episode})` },
                                { key: "Audio", label: `Musique (${abandonTypeCounts.Audio})` },
                            ].map(f => (
                                <button key={f.key} onClick={() => setAbandonFilter(f.key)}
                                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${abandonFilter === f.key ? 'bg-orange-500/20 border-orange-500/40 text-orange-300' : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'}`}>
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border border-zinc-800">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-zinc-800 hover:bg-zinc-800/50">
                                        <TableHead>Titre</TableHead>
                                        <TableHead className="w-[100px]">Type</TableHead>
                                        <TableHead className="w-[180px]">Complétion Max</TableHead>
                                        <TableHead className="w-[150px]">Dernier Essai</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredAbandoned.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center text-zinc-500">
                                                Aucun média abandonné. Succès total !
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {filteredAbandoned.map((media) => (
                                        <TableRow key={media.id} className="border-zinc-800 hover:bg-zinc-800/20">
                                            <TableCell className="font-medium text-zinc-200 max-w-[300px] truncate" title={media.title}>{media.title}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="border-zinc-700 flex items-center gap-1.5 w-fit">
                                                    {getTypeIcon(media.type)}
                                                    {getTypeLabel(media.type)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-24 h-2 bg-zinc-800 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-orange-500 rounded-full"
                                                            style={{ width: `${Math.min(media.maxCompletion, 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className={`text-sm font-medium ${getCompletionColor(media.maxCompletion)}`}>
                                                        {Math.round(media.maxCompletion)}%
                                                    </span>
                                                    <span className="text-[10px] text-zinc-500">
                                                        {getCompletionLabel(media.maxCompletion)}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {formatDistanceToNow(new Date(media.lastPlayed), { addSuffix: true, locale: fr })}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    );
}
