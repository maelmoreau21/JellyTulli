import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Activity, Users, Clock, PlayCircle, Trophy, ActivitySquare, MonitorPlay } from "lucide-react";
import { DashboardChart } from "@/components/DashboardChart";
import { VolumeAreaChart, VolumeHourData } from "@/components/charts/VolumeAreaChart";
import { ActivityByHourChart, ActivityHourData } from "@/components/charts/ActivityByHourChart";
import { PlatformDistributionChart, PlatformData } from "@/components/charts/PlatformDistributionChart";
import { TimeRangeSelector } from "@/components/TimeRangeSelector";
import Image from "next/image";
import { getJellyfinImageUrl } from "@/lib/jellyfin";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";

// Type des données stockées dans Redis au format Webhook
type WebhookPayload = {
  SessionId: string;
  UserName?: string;
  UserId?: string;
  ItemId?: string;
  ItemName?: string;
  PlayMethod?: string;
  DeviceName?: string;
  Country?: string;
  City?: string;
};

type LiveStream = {
  sessionId: string;
  itemId: string | null;
  user: string;
  mediaTitle: string;
  playMethod: string;
  device: string;
  country: string;
  city: string;
};

export const dynamic = "force-dynamic";

export default async function DashboardPage(props: { searchParams: Promise<{ type?: string; timeRange?: string }> }) {
  const { type, timeRange = "7d" } = await props.searchParams;

  // Calculate start date based on timeRange
  let startDate: Date | undefined;
  if (timeRange === "24h") {
    startDate = new Date();
    startDate.setHours(startDate.getHours() - 24);
  } else if (timeRange === "30d") {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);
  } else if (timeRange === "7d") {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 7); // Taking last 7 full days
    startDate.setHours(0, 0, 0, 0);
  } else if (timeRange === "all") {
    startDate = undefined; // No date filter
  }

  let dateFilter = startDate ? { gte: startDate } : undefined;

  // 0. Récupérer les Settings globaux (Bibliothèques exclues)
  const settings = await prisma.globalSettings.findUnique({ where: { id: "global" } });
  const excludedLibraries = settings?.excludedLibraries || [];

  // Construire le filtre Media
  const buildMediaFilter = () => {
    let AND: any[] = [];
    if (type === 'movie') AND.push({ type: "Movie" });
    else if (type === 'series') AND.push({ type: { in: ["Series", "Episode"] } });
    else if (type === 'music') AND.push({ type: { in: ["Audio", "Track"] } });

    if (excludedLibraries.length > 0) {
      AND.push({
        NOT: {
          OR: [
            { type: { in: excludedLibraries } },
            ...excludedLibraries.map((lib: string) => ({ collectionType: lib }))
          ]
        }
      });
    }
    return AND.length > 0 ? { AND } : {};
  };

  const mediaWhere = buildMediaFilter();

  // 1. Prisma : Utilisateurs Totaux
  const totalUsers = await prisma.user.count();

  // 2. Prisma : Heures Visionnées
  const hoursWatchedAgg = await prisma.playbackHistory.aggregate({
    _sum: {
      durationWatched: true,
    },
    where: {
      media: mediaWhere,
      startedAt: dateFilter
    }
  });
  const totalSecondsWatched = hoursWatchedAgg._sum.durationWatched || 0;
  // Convertion en heures avec un chiffre après la virgule
  const hoursWatched = parseFloat((totalSecondsWatched / 3600).toFixed(1));

  // 3. Redis : Flux Actifs
  const keys = await redis.keys("stream:*");
  const activeStreamsCount = keys.length;
  let liveStreams: LiveStream[] = [];
  let totalBandwidthMbps = 0; // Calcul de la bande passante

  if (activeStreamsCount > 0) {
    const payloads = await Promise.all(keys.map((k) => redis.get(k)));
    liveStreams = payloads
      .filter((p): p is string => p !== null)
      .map((p) => {
        const payload: WebhookPayload = JSON.parse(p);

        // Ex: Bitrate peut être dans Payload si webhook avancé ou on l'estime
        totalBandwidthMbps += 5; // Placeholder moyen: 5Mbps par stream (si l'API ne fournit pas direct le bitrate, à faire évoluer)

        return {
          sessionId: payload.SessionId,
          itemId: payload.ItemId || null,
          user: payload.UserName || payload.UserId || "Unknown",
          mediaTitle: payload.ItemName || "Unknown",
          playMethod: payload.PlayMethod || "Unknown",
          device: payload.DeviceName || "Unknown",
          country: payload.Country || "Unknown",
          city: payload.City || "Unknown",
        };
      });
  }

  // 4. Prisma : Données du graphique dynamique (Volume Area Chart)
  const histories = await prisma.playbackHistory.findMany({
    where: {
      startedAt: dateFilter,
      media: mediaWhere
    },
    select: {
      startedAt: true,
      durationWatched: true,
      clientName: true,
      media: {
        select: {
          type: true
        }
      }
    },
    orderBy: { startedAt: 'asc' }
  });

  // Agréger pour le VolumeAreaChart (Empilé par type de média)
  const volumeMap = new Map<string, VolumeHourData>();

  const getFormatKey = (d: Date) => {
    if (timeRange === "24h") {
      return `${d.getHours().toString().padStart(2, '0')}:00`;
    } else if (timeRange === "all") {
      return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    } else {
      return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    }
  };

  histories.forEach((h: any) => {
    const key = getFormatKey(new Date(h.startedAt));
    if (!volumeMap.has(key)) {
      volumeMap.set(key, { name: key, Movies: 0, Series: 0, Music: 0, Other: 0 });
    }
    const entry = volumeMap.get(key)!;
    const mType = h.media?.type?.toLowerCase() || "";
    const hours = h.durationWatched / 3600;

    if (mType.includes('movie')) entry.Movies += hours;
    else if (mType.includes('series') || mType.includes('episode')) entry.Series += hours;
    else if (mType.includes('audio') || mType.includes('track')) entry.Music += hours;
    else entry.Other += hours;
  });

  const volumeData = Array.from(volumeMap.values()).map(v => ({
    name: v.name,
    Movies: parseFloat(v.Movies.toFixed(2)),
    Series: parseFloat(v.Series.toFixed(2)),
    Music: parseFloat(v.Music.toFixed(2)),
    Other: parseFloat(v.Other.toFixed(2)),
  }));

  // 5. Statistiques avancées (24h) : DirectPlay %
  const last24h = new Date();
  last24h.setHours(last24h.getHours() - 24);

  const last24hHistories = await prisma.playbackHistory.findMany({
    where: { startedAt: { gte: last24h }, media: mediaWhere },
    select: { playMethod: true }
  });

  const total24h = last24hHistories.length;
  const directPlay24h = last24hHistories.filter((h: any) => h.playMethod === "DirectPlay").length;
  const directPlayPercent = total24h > 0 ? Math.round((directPlay24h / total24h) * 100) : 100;

  // 6. Top 5 Utilisateurs
  const topUsersAgg = await prisma.playbackHistory.groupBy({
    by: ['userId'],
    _sum: { durationWatched: true },
    where: { media: mediaWhere },
    orderBy: { _sum: { durationWatched: 'desc' } },
    take: 5
  });

  // Hydrater avec les Usernames
  const topUsers = await Promise.all(topUsersAgg.map(async (agg: any) => {
    const u = await prisma.user.findUnique({ where: { id: agg.userId } });
    return {
      username: u?.username || "Unknown",
      hours: parseFloat(((agg._sum.durationWatched || 0) / 3600).toFixed(1))
    };
  }));

  // 7. Graphique des Heures (ActivityByHour)
  // Tableau de 24 cases (00:00 à 23:00)
  const hourlyCounts = new Array(24).fill(0);
  histories.forEach((h: any) => {
    const hour = h.startedAt.getHours();
    hourlyCounts[hour]++;
  });

  const hourlyChartData: ActivityHourData[] = hourlyCounts.map((count, index) => ({
    hour: `${index.toString().padStart(2, '0')}:00`,
    count
  }));

  // 8. Graphique : Répartition des Plateformes
  const platformCounts = new Map<string, number>();
  histories.forEach((h: any) => {
    // Si 'clientName' est vide dans certains vieux logs, utiliser un fallback
    const pName = h.clientName || "Inconnu";
    platformCounts.set(pName, (platformCounts.get(pName) || 0) + 1);
  });

  const platformChartData: PlatformData[] = Array.from(platformCounts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8); // Garder les 8 premières plateformes pour la lisibilité

  return (
    <div className="flex-col md:flex">
      <div className="flex-1 space-y-6 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2 mb-4">
          <div className="flex items-center gap-6">
            <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
            <Tabs defaultValue={type || "all"} className="w-[380px]">
              <TabsList className="bg-zinc-900 border border-zinc-800">
                <TabsTrigger value="all" asChild><Link href={`/?timeRange=${timeRange}`}>Tous</Link></TabsTrigger>
                <TabsTrigger value="movie" asChild><Link href={`/?type=movie&timeRange=${timeRange}`}>Films</Link></TabsTrigger>
                <TabsTrigger value="series" asChild><Link href={`/?type=series&timeRange=${timeRange}`}>Séries</Link></TabsTrigger>
                <TabsTrigger value="music" asChild><Link href={`/?type=music&timeRange=${timeRange}`}>Musique</Link></TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-zinc-400 bg-zinc-900/80 px-2 py-1.5 rounded-md border border-zinc-800 hidden sm:block">Données mises en cache (60s)</span>
            <TimeRangeSelector />
          </div>
        </div>

        {/* Global Metrics Row 1 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Streams Actifs</CardTitle>
              <Activity className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeStreamsCount}</div>
              <p className="text-xs text-muted-foreground">En cours de lecture</p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bande Passante</CardTitle>
              <ActivitySquare className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">~{activeStreamsCount * 12} Mbps</div>
              <p className="text-xs text-muted-foreground">Outbound estimé en direct</p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Efficacité DirectPlay</CardTitle>
              <MonitorPlay className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{directPlayPercent}%</div>
              <p className="text-xs text-muted-foreground">Ratio Serveur (24h)</p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Temps Global</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{hoursWatched.toLocaleString()}h</div>
              <p className="text-xs text-muted-foreground">Cumulé pour {totalUsers} utilisateurs</p>
            </CardContent>
          </Card>
        </div>

        {/* Graphs Row 1 : Temps 7J + Heures d'activité */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4 bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
            <CardHeader className="pb-1">
              <CardTitle>Volume de lecture</CardTitle>
            </CardHeader>
            <CardContent className="pl-0 pb-4 pr-4">
              <div className="h-[300px] min-h-[300px] w-full">
                <VolumeAreaChart data={volumeData} />
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-3 bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Pics d'activité (Heures)</CardTitle>
              <CardDescription>Moyenne de l'heure de démarrage des sessions.</CardDescription>
            </CardHeader>
            <CardContent className="pl-0 pb-4">
              <div className="h-[300px] min-h-[300px] w-full">
                <ActivityByHourChart data={hourlyChartData} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Dataviz Row 2 : Plateformes + Top Users + Live */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-8">

          <Card className="col-span-2 bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Leaderboard</CardTitle>
              <CardDescription>Top 5 des vidéophiles.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6 mt-4">
                {topUsers.map((u, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
                      #{i + 1}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">{u.username}</p>
                    </div>
                    <div className="font-semibold text-sm">
                      {u.hours}h
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Écosystème Clients</CardTitle>
              <CardDescription>Répartition des plateformes de lecture.</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center items-center pb-4">
              <div className="h-[300px] w-full max-w-[400px]">
                <PlatformDistributionChart data={platformChartData} />
              </div>
            </CardContent>
          </Card>

          {/* Live Streams Section (Shrunk down as part of Row 2) */}
          <Card className="col-span-3 bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Activité en direct</CardTitle>
              <CardDescription>
                Actuellement {liveStreams.length} stream(s) en cours.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {liveStreams.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Aucun stream en cours.
                  </p>
                ) : (
                  liveStreams.map((stream) => (
                    <div
                      key={stream.sessionId}
                      className="flex items-center gap-4 p-3 border rounded-lg bg-card/50"
                    >
                      {/* Section Affiche du média */}
                      {stream.itemId ? (
                        <div className="relative w-12 aspect-[2/3] bg-muted rounded shrink-0 overflow-hidden ring-1 ring-white/10">
                          <Image
                            src={getJellyfinImageUrl(stream.itemId, 'Primary')}
                            alt={stream.mediaTitle}
                            fill
                            unoptimized
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-12 aspect-[2/3] bg-muted rounded shrink-0 flex items-center justify-center ring-1 ring-white/10">
                          <PlayCircle className="w-5 h-5 opacity-50" />
                        </div>
                      )}

                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {stream.mediaTitle}
                        </p>
                        <p className="text-xs text-muted-foreground flex flex-col gap-0.5">
                          <span>{stream.user} • {stream.device}</span>
                          {(stream.city !== "Unknown" || stream.country !== "Unknown") && (
                            <span className="text-[10px] opacity-70">
                              📍 {stream.city !== "Unknown" ? `${stream.city}, ` : ''}{stream.country}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="ml-auto font-medium text-xs">
                        <span
                          className={`px-2 py-1 rounded-full ${stream.playMethod === "Transcode"
                            ? "bg-orange-500/10 text-orange-500"
                            : "bg-emerald-500/10 text-emerald-500"
                            }`}
                        >
                          {stream.playMethod}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
