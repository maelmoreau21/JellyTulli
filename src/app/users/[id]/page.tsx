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

export const revalidate = 0; // Disable static caching for real-time data

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
            {/* Header */}
            <div className="border-b">
                <div className="flex h-16 items-center px-4">
                    <h1 className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
                        <PlayCircle className="w-6 h-6" /> JellyTulli
                    </h1>
                </div>
            </div>

            <div className="flex-1 space-y-4 p-8 pt-6">
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
                    <Card>
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

                    <Card>
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
                <Card className="mt-6">
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

                                            return (
                                                <TableRow key={session.id}>
                                                    <TableCell className="font-medium">
                                                        <div className="flex items-center gap-3">
                                                            <div className="relative w-10 h-14 bg-muted rounded shrink-0 overflow-hidden">
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
                                                        <span
                                                            className={`px-2 py-1 rounded-full text-xs font-semibold ${session.playMethod === "Transcode"
                                                                ? "bg-orange-500/10 text-orange-500"
                                                                : "bg-emerald-500/10 text-emerald-500"
                                                                }`}
                                                        >
                                                            {session.playMethod}
                                                        </span>
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
