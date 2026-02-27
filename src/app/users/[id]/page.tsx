import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Clock, Monitor, Smartphone, PlayCircle, Hash } from "lucide-react";
import Image from "next/image";
import { getJellyfinImageUrl } from "@/lib/jellyfin";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

interface UserPageProps {
    params: Promise<{
        id: string; // jellyfinUserId
    }>;
}

export default async function UserDetailPage({ params }: UserPageProps) {
    const { id: jellyfinUserId } = await params;

    // 1. Fetch de l'utilisateur
    const user = await prisma.user.findUnique({
        where: { jellyfinUserId },
        include: {
            playbackHistory: {
                include: {
                    media: true,
                },
                orderBy: {
                    startedAt: "desc",
                },
            },
        },
    });

    if (!user) {
        notFound();
    }

    // 2. Calcul des statistiques
    const totalSeconds = user.playbackHistory.reduce(
        (acc: number, session: any) => acc + session.durationWatched,
        0
    );
    const totalHours = parseFloat((totalSeconds / 3600).toFixed(1));

    // Trouver les clients/appareils favoris
    const clientCounts = new Map<string, number>();
    const deviceCounts = new Map<string, number>();

    user.playbackHistory.forEach((session: any) => {
        if (session.clientName) {
            clientCounts.set(
                session.clientName,
                (clientCounts.get(session.clientName) || 0) + 1
            );
        }
        if (session.deviceName) {
            deviceCounts.set(
                session.deviceName,
                (deviceCounts.get(session.deviceName) || 0) + 1
            );
        }
    });

    const getTopItem = (map: Map<string, number>) => {
        if (map.size === 0) return "N/A";
        let topEntry = ["", 0];
        map.forEach((count, name) => {
            if (count > (topEntry[1] as number)) {
                topEntry = [name, count];
            }
        });
        return topEntry[0];
    };

    const topClient = getTopItem(clientCounts);
    const topDevice = getTopItem(deviceCounts);

    return (
        <div className="flex-col md:flex">
            <div className="flex-1 space-y-6 p-8 pt-6">
                <div className="flex flex-col space-y-2 mb-6">
                    <h2 className="text-3xl font-bold tracking-tight">
                        Profil: {user.username}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        ID Jellyfin: {user.jellyfinUserId}
                    </p>
                </div>

                {/* Global Metrics */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Temps de lecture
                            </CardTitle>
                            <Clock className="h-4 w-4 text-orange-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalHours}h</div>
                            <p className="text-xs text-muted-foreground">
                                Total cumulé
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Session(s)</CardTitle>
                            <Hash className="h-4 w-4 text-emerald-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {user.playbackHistory.length}
                            </div>
                            <p className="text-xs text-muted-foreground">Historisés</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Client Favori</CardTitle>
                            <Monitor className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-xl font-bold truncate">{topClient}</div>
                            <p className="text-xs text-muted-foreground">
                                L'application la plus utilisée
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Appareil Favori
                            </CardTitle>
                            <Smartphone className="h-4 w-4 text-purple-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-xl font-bold truncate">{topDevice}</div>
                            <p className="text-xs text-muted-foreground">
                                La plateforme la plus utilisée
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Historique Table */}
                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm mt-6">
                    <CardHeader>
                        <CardTitle>Historique de lecture</CardTitle>
                        <CardDescription>
                            Historique complet des sessions démarrées par l'utilisateur.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {user.playbackHistory.length === 0 ? (
                            <p className="text-sm text-center text-muted-foreground py-8">
                                Aucun historique de lecture.
                            </p>
                        ) : (
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
                                        {user.playbackHistory.map((session: any) => {
                                            const minutes = Math.floor(session.durationWatched / 60);
                                            const dateFormat = new Intl.DateTimeFormat("fr-FR", {
                                                dateStyle: "medium",
                                                timeStyle: "short",
                                            }).format(session.startedAt);

                                            const isTranscode = session.playMethod?.toLowerCase().includes("transcode");

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
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-sm whitespace-nowrap">
                                                        {dateFormat}
                                                    </TableCell>
                                                    <TableCell>{minutes} min</TableCell>
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
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
