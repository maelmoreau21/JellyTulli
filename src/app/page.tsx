import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity, ActivitySquare, MonitorPlay, Clock, PlayCircle, TrendingUp, TrendingDown, Award } from "lucide-react";
import Image from "next/image";
import { getJellyfinImageUrl } from "@/lib/jellyfin";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { unstable_cache } from "next/cache";

// Charts
import { ActivityByHourChart, ActivityHourData } from "@/components/charts/ActivityByHourChart";
import { PlatformDistributionChart, PlatformData } from "@/components/charts/PlatformDistributionChart";
import { TimeRangeSelector } from "@/components/TimeRangeSelector";
import { ComposedTrendChart } from "@/components/charts/ComposedTrendChart";

// Webhook / Redis types
type WebhookPayload = {
  ServerId: string;
  ServerName: string;
  ServerVersion: string;
  NotificationType: string;
  NotificationUsername: string;
  UserId: string;
  UserName: string;
  Client: string;
  DeviceName: string;
  DeviceId: string;
  IsTranscoding?: boolean;
  PlayMethod?: string;
  ItemId?: string;
  ItemName?: string;
  SessionId: string;
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

// --- Aggregation Cache Helper ---
// We wrap our heavy prisma DB queries inside `unstable_cache` with a 60s revalidation.
const getDashboardMetrics = unstable_cache(
  async (type: string | undefined, timeRange: string, excludedLibraries: string[]) => {
    // 1. Calculate time windows (Current vs Previous)
    let currentStartDate: Date | undefined;
    let previousStartDate: Date | undefined;
    let previousEndDate: Date | undefined;

    const now = new Date();
    previousEndDate = new Date(now);

    if (timeRange === "24h") {
      currentStartDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      previousStartDate = new Date(now.getTime() - 48 * 60 * 60 * 1000);
      previousEndDate = currentStartDate;
    } else if (timeRange === "30d") {
      currentStartDate = new Date();
      currentStartDate.setDate(currentStartDate.getDate() - 30);
      currentStartDate.setHours(0, 0, 0, 0);

      previousStartDate = new Date(currentStartDate);
      previousStartDate.setDate(previousStartDate.getDate() - 30);
      previousEndDate = new Date(currentStartDate);
    } else if (timeRange === "7d") {
      currentStartDate = new Date();
      currentStartDate.setDate(currentStartDate.getDate() - 7);
      currentStartDate.setHours(0, 0, 0, 0);

      previousStartDate = new Date(currentStartDate);
      previousStartDate.setDate(previousStartDate.getDate() - 7);
      previousEndDate = new Date(currentStartDate);
    }

    const dateFilter = currentStartDate ? { gte: currentStartDate } : undefined;
    const prevDateFilter = (previousStartDate && previousEndDate) ? { gte: previousStartDate, lt: previousEndDate } : undefined;

    // 2. Build Media Filter
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
    const mediaWhere = AND.length > 0 ? { AND } : {};

    // 3. User & Hours (Current)
    const totalUsers = await prisma.user.count();
    const hoursWatchedAgg = await prisma.playbackHistory.aggregate({
      _sum: { durationWatched: true },
      where: { media: mediaWhere, startedAt: dateFilter }
    });
    const hoursWatched = parseFloat(((hoursWatchedAgg._sum.durationWatched || 0) / 3600).toFixed(1));

    // Previous Hours (For Growth indicator)
    let previousHoursWatched = 0;
    if (prevDateFilter) {
      const prevHoursAgg = await prisma.playbackHistory.aggregate({
        _sum: { durationWatched: true },
        where: { media: mediaWhere, startedAt: prevDateFilter }
      });
      previousHoursWatched = parseFloat(((prevHoursAgg._sum.durationWatched || 0) / 3600).toFixed(1));
    }
    const hoursGrowth = previousHoursWatched > 0 ? ((hoursWatched - previousHoursWatched) / previousHoursWatched) * 100 : 0;

    // 4. Fetch Histories for Charts & Advanced Stats
    const histories = await prisma.playbackHistory.findMany({
      where: { startedAt: dateFilter, media: mediaWhere },
      select: { startedAt: true, durationWatched: true, clientName: true, playMethod: true, media: { select: { type: true } } },
      orderBy: { startedAt: 'asc' }
    });

    // Trend ComposedChart (Volume vs Views Count)
    const trendMap = new Map<string, any>();
    const getFormatKey = (d: Date) => {
      if (timeRange === "24h") return `${d.getHours().toString().padStart(2, '0')}:00`;
      else if (timeRange === "all") return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
      else return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    };

    let directPlayCount = 0;

    histories.forEach((h: any) => {
      // Efficiency Counter
      if (h.playMethod === "DirectPlay") directPlayCount++;

      const key = getFormatKey(new Date(h.startedAt));
      if (!trendMap.has(key)) {
        trendMap.set(key, { time: key, movieVolume: 0, seriesVolume: 0, musicVolume: 0, otherVolume: 0, totalViews: 0 });
      }
      const entry = trendMap.get(key)!;
      const mType = h.media?.type?.toLowerCase() || "";
      const hours = h.durationWatched / 3600;

      if (mType.includes('movie')) entry.movieVolume += hours;
      else if (mType.includes('series') || mType.includes('episode')) entry.seriesVolume += hours;
      else if (mType.includes('audio') || mType.includes('track')) entry.musicVolume += hours;
      else entry.otherVolume += hours;

      entry.totalViews += 1; // Increment bar chart playcount
    });

    const trendData = Array.from(trendMap.values()).map(v => ({
      time: v.time,
      movieVolume: parseFloat(v.movieVolume.toFixed(2)),
      seriesVolume: parseFloat(v.seriesVolume.toFixed(2)),
      musicVolume: parseFloat(v.musicVolume.toFixed(2)),
      otherVolume: parseFloat(v.otherVolume.toFixed(2)),
      totalViews: v.totalViews
    }));

    const directPlayPercent = histories.length > 0 ? Math.round((directPlayCount / histories.length) * 100) : 100;

    // Loyalty Top 5
    const topUsersAgg = await prisma.playbackHistory.groupBy({
      by: ['userId'],
      _sum: { durationWatched: true },
      where: { media: mediaWhere, startedAt: dateFilter },
      orderBy: { _sum: { durationWatched: 'desc' } },
      take: 5
    });

    const topUsers = await Promise.all(topUsersAgg.map(async (agg: any) => {
      const u = await prisma.user.findUnique({ where: { id: agg.userId } });
      return {
        username: u?.username || "Unknown",
        hours: parseFloat(((agg._sum.durationWatched || 0) / 3600).toFixed(1))
      };
    }));

    // Daily Activity by Hour (Flattened average)
    const hourlyCounts = new Array(24).fill(0);
    histories.forEach((h: any) => {
      const hour = h.startedAt.getHours();
      hourlyCounts[hour]++;
    });
    const hourlyChartData: ActivityHourData[] = hourlyCounts.map((count, index) => ({
      hour: `${index.toString().padStart(2, '0')}:00`, count
    }));

    // Clients Platform Distro
    const platformCounts = new Map<string, number>();
    histories.forEach((h: any) => {
      const pName = h.clientName || "Inconnu";
      platformCounts.set(pName, (platformCounts.get(pName) || 0) + 1);
    });
    const platformChartData: PlatformData[] = Array.from(platformCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    return {
      totalUsers,
      hoursWatched,
      hoursGrowth,
      previousHoursWatched,
      directPlayPercent,
      trendData,
      hourlyChartData,
      platformChartData,
      topUsers
    };
  },
  ['jellytulli-dashboard'],
  { revalidate: 60 }
);

export default async function DashboardPage(props: { searchParams: Promise<{ type?: string; timeRange?: string }> }) {
  const { type, timeRange = "7d" } = await props.searchParams;

  const settings = await prisma.globalSettings.findUnique({ where: { id: "global" } });
  const excludedLibraries = settings?.excludedLibraries || [];

  const metrics = await getDashboardMetrics(type, timeRange, excludedLibraries);

  // Redis Live Streams (Non-Cached, Live)
  const keys = await redis.keys("stream:*");
  const activeStreamsCount = keys.length;
  let liveStreams: LiveStream[] = [];
  let totalBandwidthMbps = 0;

  if (activeStreamsCount > 0) {
    const payloads = await Promise.all(keys.map((k) => redis.get(k)));
    liveStreams = payloads
      .filter((p): p is string => p !== null)
      .map((p) => {
        const payload: WebhookPayload = JSON.parse(p);
        totalBandwidthMbps += payload.IsTranscoding ? 12 : 6; // Rough Mbps estimation based on transcode
        return {
          sessionId: payload.SessionId,
          itemId: payload.ItemId || null,
          user: payload.UserName || payload.UserId || "Unknown",
          mediaTitle: payload.ItemName || "Unknown",
          playMethod: payload.PlayMethod || (payload.IsTranscoding ? "Transcode" : "DirectPlay"),
          device: payload.DeviceName || "Unknown",
          country: payload.Country || "Unknown",
          city: payload.City || "Unknown",
        };
      });
  }

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
            <span className="text-xs text-zinc-400 bg-zinc-900/80 px-2 py-1.5 rounded-md border border-zinc-800 hidden sm:block">
              Données Database en cache (60s)
            </span>
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
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                Actuellement gérés par le serveur
              </p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bande Passante</CardTitle>
              <ActivitySquare className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">~{totalBandwidthMbps} Mbps</div>
              <p className="text-xs text-muted-foreground mt-1">Estimation sortante dynamique</p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Efficacité DirectPlay</CardTitle>
              <MonitorPlay className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.directPlayPercent}%</div>
              <p className="text-xs text-muted-foreground mt-1">Contenus non transcodés (Période)</p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Temps Global</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold">{metrics.hoursWatched.toLocaleString()}h</div>
                {timeRange !== "all" && (
                  <div className={`flex items-center text-xs font-semibold px-1.5 py-0.5 rounded-full ${metrics.hoursGrowth >= 0 ? 'text-emerald-500 bg-emerald-500/10' : 'text-red-500 bg-red-500/10'}`}>
                    {metrics.hoursGrowth >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                    {metrics.hoursGrowth > 0 ? "+" : ""}{metrics.hoursGrowth.toFixed(1)}%
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 text-ellipsis overflow-hidden whitespace-nowrap">
                {timeRange !== "all" ? `Cumulé par rapport à la période précédente (${metrics.previousHoursWatched}h)` : `Cumulé dans toute l'histoire pour ${metrics.totalUsers} Utilisateurs`}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Dataviz Row : Multi-Axis Volume & Views */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4 bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
            <CardHeader className="pb-1">
              <CardTitle>Volumes et Vues Historiques</CardTitle>
              <CardDescription>Barres = Total de vues. Zones de Couleur = Heures de visionnages par Bibliothèque.</CardDescription>
            </CardHeader>
            <CardContent className="pl-0 pb-4 pr-1">
              <div className="h-[300px] min-h-[300px] w-full">
                <ComposedTrendChart data={metrics.trendData} />
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-3 bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Horloges d'Activité</CardTitle>
              <CardDescription>Moyenne de l'heure de démarrage des sessions.</CardDescription>
            </CardHeader>
            <CardContent className="pl-0 pb-4">
              <div className="h-[300px] min-h-[300px] w-full">
                <ActivityByHourChart data={metrics.hourlyChartData} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Dataviz Row 2 : Plateformes + Top Users + Live */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-8">

          <Card className="col-span-2 bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex gap-2"><Award className="w-5 h-5 text-yellow-500" /> Les Fidèles</CardTitle>
              <CardDescription>Top Utilisateurs.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6 mt-4">
                {metrics.topUsers.length === 0 && <span className="text-muted-foreground text-sm">Aucune activité</span>}
                {metrics.topUsers.map((u, i) => (
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

          <Card className="col-span-3 bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Écosystème Clients</CardTitle>
              <CardDescription>Répartition des plateformes de lecture (Top 8).</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center items-center pb-4">
              <div className="h-[300px] w-full max-w-[400px]">
                <PlatformDistributionChart data={metrics.platformChartData} />
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-3 bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex gap-2"> En Direct <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse mt-1.5" /></CardTitle>
              <CardDescription>
                Actuellement {liveStreams.length} stream(s) en cours.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                {liveStreams.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Aucun stream en cours de lecture.
                  </p>
                ) : (
                  liveStreams.map((stream) => (
                    <div
                      key={stream.sessionId}
                      className="flex items-center gap-4 p-3 border rounded-lg border-zinc-800 bg-zinc-950/50"
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
