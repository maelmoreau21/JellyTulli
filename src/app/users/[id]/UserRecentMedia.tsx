import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import prisma from "@/lib/prisma";
import Image from "next/image";
import { getJellyfinImageUrl } from "@/lib/jellyfin";

export default async function UserRecentMedia({ userId }: { userId: string }) {
    const user = await prisma.user.findUnique({
        where: { jellyfinUserId: userId },
        include: {
            playbackHistory: {
                include: { media: true },
                orderBy: { startedAt: "desc" },
            },
        },
    });

    if (!user || user.playbackHistory.length === 0) {
        return (
            <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm mt-6">
                <CardHeader>
                    <CardTitle>Historique de lecture</CardTitle>
                    <CardDescription>Aucun historique de lecture.</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    const groupedHistory = new Map<string, any>();

    user.playbackHistory.forEach((session: any) => {
        const mId = session.mediaId;
        if (!groupedHistory.has(mId)) {
            groupedHistory.set(mId, {
                ...session,
                totalDurationWatched: session.durationWatched,
                lastSessionAt: session.startedAt,
                playCount: 1,
            });
        } else {
            const existing = groupedHistory.get(mId);
            existing.totalDurationWatched += session.durationWatched;
            existing.playCount += 1;
            if (new Date(session.startedAt) > new Date(existing.lastSessionAt)) {
                existing.lastSessionAt = session.startedAt;
                existing.playMethod = session.playMethod;
                existing.deviceName = session.deviceName;
                existing.clientName = session.clientName;
            }
        }
    });

    const uniqueHistory = Array.from(groupedHistory.values())
        .sort((a, b) => new Date(b.lastSessionAt).getTime() - new Date(a.lastSessionAt).getTime())
        .slice(0, 50); // Maintien perfs: on affiche les 50 derniers max de l'historique agrégé pour cette page

    return (
        <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm mt-6">
            <CardHeader>
                <CardTitle>Historique de lecture</CardTitle>
                <CardDescription>Historique complet et agrégé des sessions démarrées.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Média</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Durée</TableHead>
                                <TableHead>Appareil</TableHead>
                                <TableHead>Méthode</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {uniqueHistory.map((session: any) => {
                                const minutes = Math.floor(session.totalDurationWatched / 60);
                                const dateFormat = new Intl.DateTimeFormat("fr-FR", {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                }).format(new Date(session.lastSessionAt));

                                const isTranscode = session.playMethod?.toLowerCase().includes("transcode");

                                let progress = 0;
                                if (session.media?.durationMs) {
                                    const mediaSec = Number(session.media.durationMs) / 10000000;
                                    if (mediaSec > 0) {
                                        progress = Math.min(100, Math.round((session.totalDurationWatched / mediaSec) * 100));
                                    }
                                }

                                return (
                                    <TableRow key={session.id} className="even:bg-zinc-900/30 hover:bg-zinc-800/50 border-zinc-800/50 transition-colors">
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-3">
                                                <div className="relative w-12 aspect-[2/3] bg-muted rounded shrink-0 overflow-hidden ring-1 ring-white/10">
                                                    <Image
                                                        src={getJellyfinImageUrl(session.media.jellyfinMediaId, 'Primary')}
                                                        alt={session.media.title}
                                                        fill
                                                        unoptimized
                                                        className="object-cover"
                                                    />
                                                </div>
                                                <div>
                                                    {session.media.title}
                                                    <div className="text-xs text-muted-foreground hidden sm:block">
                                                        {session.media.type}
                                                    </div>
                                                    {progress > 0 && (
                                                        <div className="w-full h-1.5 bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                                                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${progress}%` }} />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm border-l border-zinc-900/50">
                                            <div className="flex flex-col">
                                                <span>{dateFormat}</span>
                                                <span className="text-xs text-muted-foreground">{session.playCount} session(s)</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="border-l border-zinc-900/50">{minutes} min</TableCell>
                                        <TableCell className="text-sm">
                                            <span className="truncate max-w-[150px] inline-block">
                                                {session.deviceName || session.clientName || "N/A"}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={isTranscode ? "destructive" : "default"} className={`shadow-sm ${isTranscode ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'}`}>
                                                {session.playMethod || "DirectPlay"}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
