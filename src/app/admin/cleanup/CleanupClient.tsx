"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Ghost, HeartCrack, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface GhostMedia {
    id: string;
    jellyfinMediaId: string;
    title: string;
    type: string;
    createdAt: Date;
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

export default function CleanupClient({ initialData }: { initialData: CleanupData }) {
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
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border border-zinc-800">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-zinc-800 hover:bg-zinc-800/50">
                                        <TableHead>Titre</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Ajouté le</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {initialData.ghostMedia.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center text-zinc-500">
                                                Aucun média fantôme. Votre serveur est propre !
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {initialData.ghostMedia.map((media) => (
                                        <TableRow key={media.id} className="border-zinc-800 hover:bg-zinc-800/20">
                                            <TableCell className="font-medium text-zinc-200">{media.title}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="border-zinc-700">{media.type}</Badge>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm flex items-center gap-2">
                                                <Clock className="w-3 h-3" />
                                                {formatDistanceToNow(new Date(media.createdAt), { addSuffix: true, locale: fr })}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <span className="text-xs text-zinc-600">ID: {media.jellyfinMediaId.slice(0, 8)}...</span>
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
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border border-zinc-800">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-zinc-800 hover:bg-zinc-800/50">
                                        <TableHead>Titre</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Complétion Max</TableHead>
                                        <TableHead>Dernier Essai</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {initialData.abandonedMedia.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center text-zinc-500">
                                                Aucun média abandonné. Succès total !
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {initialData.abandonedMedia.map((media) => (
                                        <TableRow key={media.id} className="border-zinc-800 hover:bg-zinc-800/20">
                                            <TableCell className="font-medium text-zinc-200">{media.title}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="border-zinc-700">{media.type}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-24 h-2 bg-zinc-800 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-orange-500"
                                                            style={{ width: `${media.maxCompletion}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-sm font-medium text-orange-400">
                                                        {Math.round(media.maxCompletion)}%
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
