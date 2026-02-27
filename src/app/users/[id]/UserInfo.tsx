import { Clock, Monitor, Smartphone, PlayCircle, Hash, Film } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import prisma from "@/lib/prisma";

export default async function UserInfo({ userId }: { userId: string }) {
    const user = await prisma.user.findUnique({
        where: { jellyfinUserId: userId },
        include: {
            playbackHistory: {
                select: {
                    durationWatched: true,
                    clientName: true,
                    deviceName: true,
                    media: {
                        select: { genres: true, type: true }
                    }
                }
            }
        }
    });

    if (!user) return null;

    const clientCounts = new Map<string, number>();
    const deviceCounts = new Map<string, number>();
    const genreCounts = new Map<string, number>();
    const formatCounts = new Map<string, number>();

    let totalSeconds = 0;

    user.playbackHistory.forEach((session: any) => {
        totalSeconds += session.durationWatched;
        if (session.clientName) clientCounts.set(session.clientName, (clientCounts.get(session.clientName) || 0) + 1);
        if (session.deviceName) deviceCounts.set(session.deviceName, (deviceCounts.get(session.deviceName) || 0) + 1);

        if (session.media?.genres) {
            session.media.genres.forEach((g: string) => {
                genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
            });
        }
        if (session.media?.type) {
            formatCounts.set(session.media.type, (formatCounts.get(session.media.type) || 0) + 1);
        }
    });

    const totalHours = parseFloat((totalSeconds / 3600).toFixed(1));

    const getTopItem = (map: Map<string, number>) => {
        if (map.size === 0) return "N/A";
        let topEntry = ["", 0];
        map.forEach((count, name) => {
            if (count > (topEntry[1] as number)) topEntry = [name, count];
        });
        return topEntry[0];
    };

    const getTop3Items = (map: Map<string, number>) => {
        return Array.from(map.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(entry => entry[0])
            .join(", ") || "N/A";
    };

    const topClient = getTopItem(clientCounts);
    const topDevice = getTopItem(deviceCounts);
    const topGenres = getTop3Items(genreCounts);
    const topFormat = getTopItem(formatCounts);
    const formatDisplay = topFormat === 'Movie' ? 'Films' : (topFormat === 'Series' || topFormat === 'Episode') ? 'Séries' : topFormat;

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Temps de lecture</CardTitle>
                    <Clock className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalHours}h</div>
                    <p className="text-xs text-muted-foreground">Total cumulé</p>
                </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Session(s)</CardTitle>
                    <Hash className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{user.playbackHistory.length}</div>
                    <p className="text-xs text-muted-foreground">Historisées globales</p>
                </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Top Genres</CardTitle>
                    <PlayCircle className="h-4 w-4 text-pink-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-xl font-bold truncate">{topGenres}</div>
                    <p className="text-xs text-muted-foreground">Prédilections principales</p>
                </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Format Favori</CardTitle>
                    <Film className="h-4 w-4 text-indigo-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-xl font-bold truncate">{formatDisplay}</div>
                    <p className="text-xs text-muted-foreground">Type de média principal</p>
                </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Client Favori</CardTitle>
                    <Monitor className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-xl font-bold truncate">{topClient}</div>
                    <p className="text-xs text-muted-foreground">L'application la plus utilisée</p>
                </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Appareil Favori</CardTitle>
                    <Smartphone className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-xl font-bold truncate">{topDevice}</div>
                    <p className="text-xs text-muted-foreground">La plateforme la plus utilisée</p>
                </CardContent>
            </Card>
        </div>
    );
}
