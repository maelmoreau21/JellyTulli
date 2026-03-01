import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity, ActivitySquare, MonitorPlay, Clock, TrendingUp, TrendingDown, Award, Film, Tv, Music, BookOpen } from "lucide-react";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { unstable_cache } from "next/cache";
import { Suspense } from "react";
import { DeepInsights } from "@/components/dashboard/DeepInsights";
import { GranularAnalysis } from "@/components/dashboard/GranularAnalysis";
import { NetworkAnalysis } from "@/components/dashboard/NetworkAnalysis";
import { Skeleton } from "@/components/ui/skeleton";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";

// Charts
import { ActivityByHourChart, ActivityHourData } from "@/components/charts/ActivityByHourChart";
import { PlatformDistributionChart, PlatformData } from "@/components/charts/PlatformDistributionChart";
import { TimeRangeSelector } from "@/components/TimeRangeSelector";
import { ComposedTrendChart } from "@/components/charts/ComposedTrendChart";
import { CategoryPieChart } from "@/components/charts/CategoryPieChart";
import { YearlyHeatmap, HeatmapData } from "@/components/charts/YearlyHeatmap";
import { DraggableDashboard } from "@/components/dashboard/DraggableDashboard";
import { HardwareMonitor } from "@/components/dashboard/HardwareMonitor";
import { KillStreamButton } from "@/components/dashboard/KillStreamButton";
import { LiveStreamsPanel } from "@/components/dashboard/LiveStreamsPanel";
import { MonthlyWatchTimeChart, MonthlyWatchData } from "@/components/charts/MonthlyWatchTimeChart";
import { CompletionRatioChart, CompletionData } from "@/components/charts/CompletionRatioChart";
import { ClientCategoryChart, ClientCategoryData } from "@/components/charts/ClientCategoryChart";
import { categorizeClient } from "@/lib/utils";

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
  parentItemId: string | null;
  user: string;
  mediaTitle: string;
  mediaSubtitle: string | null;
  playMethod: string;
  device: string;
  country: string;
  city: string;
  progressPercent: number;
  isPaused: boolean;
  audioLanguage: string | null;
  audioCodec: string | null;
  subtitleLanguage: string | null;
  subtitleCodec: string | null;
};

export const dynamic = "force-dynamic";

// --- Aggregation Cache Helper ---
const getDashboardMetrics = unstable_cache(
  async (type: string | undefined, timeRange: string, excludedLibraries: string[], customFrom?: string, customTo?: string) => {
    // 1. Calculate time windows
    let currentStartDate: Date | undefined;
    let previousStartDate: Date | undefined;
    let previousEndDate: Date | undefined;

    const now = new Date();
    previousEndDate = new Date(now);

    if (timeRange === "custom" && customFrom && customTo) {
      currentStartDate = new Date(customFrom);
      currentStartDate.setHours(0, 0, 0, 0);

      const toDate = new Date(customTo);
      toDate.setHours(23, 59, 59, 999);

      // Calculate previous span of identical length
      const diff = toDate.getTime() - currentStartDate.getTime();
      previousStartDate = new Date(currentStartDate.getTime() - diff - 1);
      previousEndDate = new Date(currentStartDate.getTime() - 1);

      // We overwrite previousEndDate to toDate for the main query filter later if we want a strict ceiling, but since we use `dateFilter = gte: currentStartDate` without ceiling for now, we should add ceiling.
    } else if (timeRange === "24h") {
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

    const dateFilter: any = currentStartDate ? { gte: currentStartDate } : undefined;
    if (timeRange === "custom" && customTo && dateFilter) {
      const toDate = new Date(customTo);
      toDate.setHours(23, 59, 59, 999);
      dateFilter.lte = toDate;
    }
    const prevDateFilter = (previousStartDate && previousEndDate) ? { gte: previousStartDate, lt: previousEndDate } : undefined;

    // 2. Build Media Filter
    let AND: any[] = [];
    if (type === 'movie') AND.push({ type: "Movie" });
    else if (type === 'series') AND.push({ type: { in: ["Series", "Episode"] } });
    else if (type === 'music') AND.push({ type: { in: ["Audio", "Track"] } });
    else if (type === 'book') AND.push({ type: "Book" });

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

    // Previous Hours
    let previousHoursWatched = 0;
    if (prevDateFilter) {
      const prevHoursAgg = await prisma.playbackHistory.aggregate({
        _sum: { durationWatched: true },
        where: { media: mediaWhere, startedAt: prevDateFilter }
      });
      previousHoursWatched = parseFloat(((prevHoursAgg._sum.durationWatched || 0) / 3600).toFixed(1));
    }
    const hoursGrowth = previousHoursWatched > 0 ? ((hoursWatched - previousHoursWatched) / previousHoursWatched) * 100 : 0;

    // 4. Load all history matching period
    const histories = await prisma.playbackHistory.findMany({
      where: { startedAt: dateFilter, media: mediaWhere },
      select: { startedAt: true, durationWatched: true, clientName: true, playMethod: true, media: { select: { type: true, title: true } } },
      orderBy: { startedAt: 'asc' }
    });

    // Sub-Categories Breakdown
    let movieViews = 0, movieHours = 0;
    let seriesViews = 0, seriesHours = 0;
    let musicViews = 0, musicHours = 0;
    let booksViews = 0, booksHours = 0;
    let directPlayCount = 0;

    const trendMap = new Map<string, any>();
    const getFormatKey = (d: Date) => {
      if (timeRange === "24h") return `${d.getHours().toString().padStart(2, '0')}:00`;
      else if (timeRange === "all") return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
      else return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    };

    histories.forEach((h: any) => {
      if (h.playMethod === "DirectPlay") directPlayCount++;

      const key = getFormatKey(new Date(h.startedAt));
      if (!trendMap.has(key)) {
        trendMap.set(key, { time: key, movieVolume: 0, seriesVolume: 0, musicVolume: 0, booksVolume: 0, totalViews: 0 });
      }
      const entry = trendMap.get(key)!;
      const mType = h.media?.type?.toLowerCase() || "";
      const hours = h.durationWatched / 3600;

      // Classifying
      if (mType.includes('movie')) {
        entry.movieVolume += hours;
        movieViews++; movieHours += hours;
      } else if (mType.includes('series') || mType.includes('episode')) {
        entry.seriesVolume += hours;
        seriesViews++; seriesHours += hours;
      } else if (mType.includes('audio') || mType.includes('track')) {
        entry.musicVolume += hours;
        musicViews++; musicHours += hours;
      } else if (mType.includes('book')) {
        entry.booksVolume += hours;
        booksViews++; booksHours += hours;
      } else {
        entry.booksVolume += hours;
      }

      entry.totalViews += 1;
    });

    const categoryPieData = [
      { name: 'Films', value: parseFloat(movieHours.toFixed(2)) },
      { name: 'Séries', value: parseFloat(seriesHours.toFixed(2)) },
      { name: 'Musique', value: parseFloat(musicHours.toFixed(2)) },
      { name: 'Livres', value: parseFloat(booksHours.toFixed(2)) },
    ].filter(item => item.value > 0);

    const trendData = Array.from(trendMap.values()).map(v => ({
      time: v.time,
      movieVolume: parseFloat(v.movieVolume.toFixed(2)),
      seriesVolume: parseFloat(v.seriesVolume.toFixed(2)),
      musicVolume: parseFloat(v.musicVolume.toFixed(2)),
      booksVolume: parseFloat(v.booksVolume.toFixed(2)),
      totalViews: v.totalViews
    }));

    const directPlayPercent = histories.length > 0 ? Math.round((directPlayCount / histories.length) * 100) : 100;

    // Loyalty Top 5
    const topUsersAgg = await prisma.playbackHistory.groupBy({
      by: ['userId'],
      _sum: { durationWatched: true },
      where: { media: mediaWhere, startedAt: dateFilter, userId: { not: null } },
      orderBy: { _sum: { durationWatched: 'desc' } },
      take: 5
    });

    const topUsers = await Promise.all(topUsersAgg.map(async (agg: any) => {
      const u = await prisma.user.findUnique({ where: { id: agg.userId } });
      return {
        username: u?.username || "Utilisateur Supprimé",
        jellyfinUserId: u?.jellyfinUserId || "",
        hours: parseFloat(((agg._sum.durationWatched || 0) / 3600).toFixed(1))
      };
    }));

    // Hourly
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

    // Peak Concurrent Streams
    const events: { time: number, type: number }[] = [];
    histories.forEach((h: any) => {
      const start = h.startedAt.getTime();
      const end = start + (h.durationWatched * 1000);
      events.push({ time: start, type: 1 });
      events.push({ time: end, type: -1 });
    });

    events.sort((a, b) => a.time - b.time || a.type - b.type);

    let currentConcurrent = 0;
    let peakConcurrentStreams = 0;

    // Track historical peak by hour for the chart
    const serverLoadMap = new Map<string, number>();

    for (const evt of events) {
      currentConcurrent += evt.type;
      if (currentConcurrent > peakConcurrentStreams) {
        peakConcurrentStreams = currentConcurrent;
      }

      const evtFullHourKey = getFormatKey(new Date(evt.time));
      // Overwrite the mapped hour with the max concurrency seen in that window
      const mappedVal = serverLoadMap.get(evtFullHourKey) || 0;
      if (currentConcurrent > mappedVal) {
        serverLoadMap.set(evtFullHourKey, currentConcurrent);
      }
    }

    // Merge into trend data
    const serverLoadData = Array.from(trendMap.values()).map(v => ({
      time: v.time,
      peakStreams: serverLoadMap.get(v.time) || 0
    }));

    // Monthly watch time (last 12 months)
    const MONTH_NAMES = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
    const monthlyMap = new Map<string, number>();
    const nowMonth = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(nowMonth.getFullYear(), nowMonth.getMonth() - i, 1);
      const key = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
      monthlyMap.set(key, 0);
    }
    histories.forEach((h: any) => {
      const d = new Date(h.startedAt);
      const key = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
      if (monthlyMap.has(key)) {
        monthlyMap.set(key, (monthlyMap.get(key) || 0) + h.durationWatched / 3600);
      }
    });
    const monthlyWatchData: MonthlyWatchData[] = Array.from(monthlyMap.entries()).map(([month, hours]) => ({
      month, hours: parseFloat(hours.toFixed(1))
    }));

    // Completion ratio (abandoned vs finished)
    // "Terminé" = watched >= 80% of media duration, "Partiel" = 20-80%, "Abandonné" = < 20%
    let completed = 0, partial = 0, abandoned = 0;
    // We need media durations for this — load them
    const mediaIds = [...new Set(histories.map((h: any) => h.media?.title).filter(Boolean))];
    // Fetch media with durations
    const mediaWithDuration = await prisma.media.findMany({
      where: { durationMs: { not: null } },
      select: { id: true, title: true, durationMs: true },
    });
    const mediaDurationMap = new Map<string, number>();
    mediaWithDuration.forEach(m => {
      if (m.durationMs) mediaDurationMap.set(m.title, Number(m.durationMs) / 1000);
    });

    // Also load full histories with mediaId for completion calc
    const fullHistories = await prisma.playbackHistory.findMany({
      where: { startedAt: dateFilter, media: mediaWhere },
      select: { durationWatched: true, media: { select: { title: true, durationMs: true } } },
    });
    fullHistories.forEach((h: any) => {
      const mediaDurS = h.media?.durationMs ? Number(h.media.durationMs) / 1000 : 0;
      if (mediaDurS <= 0 || h.durationWatched <= 0) {
        // No duration info: count as partial
        partial++;
        return;
      }
      const pct = h.durationWatched / mediaDurS;
      if (pct >= 0.8) completed++;
      else if (pct >= 0.2) partial++;
      else abandoned++;
    });
    const completionData: CompletionData[] = [
      { name: "Terminé", value: completed },
      { name: "Partiel", value: partial },
      { name: "Abandonné", value: abandoned },
    ].filter(d => d.value > 0);

    // Client categories
    const clientCatMap = new Map<string, number>();
    histories.forEach((h: any) => {
      const cat = categorizeClient(h.clientName || "");
      clientCatMap.set(cat, (clientCatMap.get(cat) || 0) + 1);
    });
    const clientCategoryData: ClientCategoryData[] = Array.from(clientCatMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalUsers,
      hoursWatched,
      hoursGrowth,
      previousHoursWatched,
      directPlayPercent,
      peakConcurrentStreams,
      trendData,
      categoryPieData,
      hourlyChartData,
      platformChartData,
      serverLoadData,
      topUsers,
      monthlyWatchData,
      completionData,
      clientCategoryData,
      breakdown: {
        movieViews, movieHours: parseFloat(movieHours.toFixed(1)),
        seriesViews, seriesHours: parseFloat(seriesHours.toFixed(1)),
        musicViews, musicHours: parseFloat(musicHours.toFixed(1)),
        booksViews, booksHours: parseFloat(booksHours.toFixed(1)),
      }
    };
  },
  ['jellytulli-dashboard'],
  { revalidate: 60 }
);

async function HeatmapWrapper() {
  const today = new Date();
  const jan1 = new Date(today.getFullYear(), 0, 1);

  const rawData = await prisma.playbackHistory.findMany({
    where: { startedAt: { gte: jan1 } },
    select: { startedAt: true }
  });

  const countsByDate = new Map<string, number>();
  rawData.forEach(r => {
    const d = r.startedAt.toISOString().split('T')[0];
    countsByDate.set(d, (countsByDate.get(d) || 0) + 1);
  });

  const counts = Array.from(countsByDate.values());
  const maxCount = counts.length > 0 ? Math.max(...counts) : 1;

  const getLevel = (count: number): 0 | 1 | 2 | 3 | 4 => {
    if (count === 0) return 0;
    const ratio = count / maxCount;
    if (ratio < 0.25) return 1;
    if (ratio < 0.5) return 2;
    if (ratio < 0.75) return 3;
    return 4;
  };

  const heatmapData: HeatmapData[] = Array.from(countsByDate.entries()).map(([date, count]) => ({
    date,
    count,
    level: getLevel(count)
  }));

  return <YearlyHeatmap data={heatmapData} />;
}

export default async function DashboardPage(props: { searchParams: Promise<{ type?: string; timeRange?: string; from?: string; to?: string }> }) {
  // RBAC: Non-admin users are redirected to their Wrapped page
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user?.isAdmin) {
    const uid = (authSession?.user as any)?.jellyfinUserId;
    redirect(uid ? `/wrapped/${uid}` : "/login");
  }

  const { type, timeRange = "7d", from, to } = await props.searchParams;

  const settings = await prisma.globalSettings.findUnique({ where: { id: "global" } });
  const excludedLibraries = settings?.excludedLibraries || [];

  const metrics = await getDashboardMetrics(type, timeRange, excludedLibraries, from, to);

  // Redis Live Streams
  const keys = await redis.keys("stream:*");
  const activeStreamsCount = keys.length;
  let liveStreams: LiveStream[] = [];
  let totalBandwidthMbps = 0;

  if (activeStreamsCount > 0) {
    const payloads = await Promise.all(keys.map((k) => redis.get(k)));
    liveStreams = payloads
      .filter((p): p is string => p !== null)
      .map((p) => {
        const payload: any = JSON.parse(p);
        totalBandwidthMbps += payload.IsTranscoding ? 12 : 6;

        // Build enriched subtitle for hierarchical display
        let mediaSubtitle: string | null = null;
        if (payload.SeriesName) {
          // TV: "SeriesName — SeasonName"
          mediaSubtitle = payload.SeriesName + (payload.SeasonName ? ` — ${payload.SeasonName}` : '');
        } else if (payload.AlbumName) {
          // Music: "Artist — Album"
          mediaSubtitle = (payload.AlbumArtist ? `${payload.AlbumArtist} — ` : '') + payload.AlbumName;
        }

        // Calculate progress percentage
        let progressPercent = 0;
        if (payload.PlaybackPositionTicks && payload.RunTimeTicks && payload.RunTimeTicks > 0) {
          progressPercent = Math.min(100, Math.round((payload.PlaybackPositionTicks / payload.RunTimeTicks) * 100));
        }

        return {
          sessionId: payload.SessionId,
          itemId: payload.ItemId || null,
          user: payload.UserName || payload.UserId || "Unknown",
          mediaTitle: payload.ItemName || "Unknown",
          mediaSubtitle,
          playMethod: payload.PlayMethod || (payload.IsTranscoding ? "Transcode" : "DirectPlay"),
          device: payload.DeviceName || "Unknown",
          country: payload.Country || "Unknown",
          city: payload.City || "Unknown",
          progressPercent,
          isPaused: payload.IsPaused === true,
          parentItemId: payload.AlbumId || payload.SeriesId || payload.SeasonId || null,
          audioLanguage: payload.AudioLanguage || null,
          audioCodec: payload.AudioCodec || null,
          subtitleLanguage: payload.SubtitleLanguage || null,
          subtitleCodec: payload.SubtitleCodec || null,
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
                <TabsTrigger value="book" asChild><Link href={`/?type=book&timeRange=${timeRange}`}>Livres</Link></TabsTrigger>
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

        <HardwareMonitor />

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-zinc-900 border border-zinc-800">
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="analytics">Analyses Détaillées</TabsTrigger>
            <TabsTrigger value="network">Réseau</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <DraggableDashboard blocks={[
              /* Global Metrics Row 1 */
              <div key="metrics" className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
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
                    <CardTitle className="text-sm font-medium">DirectPlay</CardTitle>
                    <MonitorPlay className="h-4 w-4 text-purple-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.directPlayPercent}%<span className="text-xs font-normal text-zinc-400 ml-1">DP</span></div>
                    <p className="text-xs text-muted-foreground mt-1">Lecture sans transcodage (Période)</p>
                  </CardContent>
                </Card>

                <Link href="/logs" className="block group">
                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm transition-colors group-hover:border-orange-500/40 cursor-pointer">
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
                </Link>

                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Pic de Charge</CardTitle>
                    <Activity className="h-4 w-4 text-red-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.peakConcurrentStreams}</div>
                    <p className="text-xs text-muted-foreground mt-1">Record de flux simultanés</p>
                  </CardContent>
                </Card>
              </div>,

              /* Analytics Breadcrumb - Ultimate Expansion */
              <div key="breadcrumb" className="grid gap-4 md:grid-cols-4">
                <Link href="/logs?type=Movie" className="block group">
                  <Card className="bg-zinc-900/30 border-zinc-800/40 transition-colors group-hover:border-blue-500/40 group-hover:bg-zinc-900/50 cursor-pointer">
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                      <CardTitle className="text-sm font-medium text-zinc-400">Films</CardTitle>
                      <Film className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="text-2xl font-bold text-white">{metrics.breakdown.movieViews} <span className="text-sm font-normal text-zinc-500">vues</span></div>
                      <p className="text-xs text-blue-500 font-medium">{metrics.breakdown.movieHours}h visionnées</p>
                    </CardContent>
                  </Card>
                </Link>

                <Link href="/logs?type=Episode" className="block group">
                  <Card className="bg-zinc-900/30 border-zinc-800/40 transition-colors group-hover:border-green-500/40 group-hover:bg-zinc-900/50 cursor-pointer">
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                      <CardTitle className="text-sm font-medium text-zinc-400">Séries & Episodes</CardTitle>
                      <Tv className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="text-2xl font-bold text-white">{metrics.breakdown.seriesViews} <span className="text-sm font-normal text-zinc-500">lectures</span></div>
                      <p className="text-xs text-green-500 font-medium">{metrics.breakdown.seriesHours}h englouties</p>
                    </CardContent>
                  </Card>
                </Link>

                <Link href="/logs?type=Audio" className="block group">
                  <Card className="bg-zinc-900/30 border-zinc-800/40 transition-colors group-hover:border-yellow-500/40 group-hover:bg-zinc-900/50 cursor-pointer">
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                      <CardTitle className="text-sm font-medium text-zinc-400">Musique</CardTitle>
                      <Music className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="text-2xl font-bold text-white">{metrics.breakdown.musicViews} <span className="text-sm font-normal text-zinc-500">titres</span></div>
                      <p className="text-xs text-yellow-500 font-medium">{metrics.breakdown.musicHours}h écoutées</p>
                    </CardContent>
                  </Card>
                </Link>

                <Link href="/logs?type=AudioBook" className="block group">
                  <Card className="bg-zinc-900/30 border-zinc-800/40 transition-colors group-hover:border-purple-500/40 group-hover:bg-zinc-900/50 cursor-pointer">
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                      <CardTitle className="text-sm font-medium text-zinc-400">Livres & Audios</CardTitle>
                      <BookOpen className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="text-2xl font-bold text-white">{metrics.breakdown.booksViews} <span className="text-sm font-normal text-zinc-500">ouvertures</span></div>
                      <p className="text-xs text-purple-500 font-medium">{metrics.breakdown.booksHours}h passées</p>
                    </CardContent>
                  </Card>
                </Link>
              </div>,

              /* Dataviz Row : Multi-Axis Volume & PieChart */
              <div key="volumes" className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-1 lg:col-span-5 bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                  <CardHeader className="pb-1">
                    <CardTitle>Volumes et Vues Historiques</CardTitle>
                    <CardDescription>Croisement temporel des Vues & Heures de visionnages par Bibliothèque.</CardDescription>
                  </CardHeader>
                  <CardContent className="pl-0 pb-4 pr-1">
                    <div className="h-[300px] min-h-[300px] w-full">
                      <ComposedTrendChart data={metrics.trendData} />
                    </div>
                  </CardContent>
                </Card>

                <Card className="col-span-1 lg:col-span-2 bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle>Répartition Catégorique</CardTitle>
                    <CardDescription>Part du volume global de lecture (Heures).</CardDescription>
                  </CardHeader>
                  <CardContent className="pl-0 pb-4">
                    <div className="h-[300px] min-h-[300px] w-full">
                      {metrics.categoryPieData.length > 0 ? (
                        <CategoryPieChart data={metrics.categoryPieData} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-500 text-sm">
                          Aucune donnée pour générer le graphique
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>,

              /* Yearly Heatmap Contribution Component - Phase 6 */
              <Suspense key="heatmap" fallback={<Skeleton className="h-[250px] w-full rounded-xl" />}>
                <HeatmapWrapper />
              </Suspense>,

              /* Dataviz Row : Plateformes + Top Users + Live */
              <div key="platforms" className="grid gap-4 md:grid-cols-2 lg:grid-cols-8">

                <Card className="col-span-2 bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex gap-2"><Award className="w-5 h-5 text-yellow-500" /> Les Fidèles</CardTitle>
                    <CardDescription>Top Utilisateurs.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6 mt-4">
                      {metrics.topUsers.length === 0 && <span className="text-muted-foreground text-sm">Aucune activité</span>}
                      {metrics.topUsers.map((u, i) => (
                        <Link key={i} href={`/users/${u.jellyfinUserId}`} className="flex items-center gap-4 group hover:bg-zinc-800/50 rounded-lg p-1 -m-1 transition-colors">
                          <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
                            #{i + 1}
                          </div>
                          <div className="flex-1 space-y-1">
                            <p className="text-sm font-medium leading-none truncate max-w-[100px] group-hover:text-purple-400 transition-colors">{u.username}</p>
                          </div>
                          <div className="font-semibold text-sm">
                            {u.hours}h
                          </div>
                        </Link>
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

                <LiveStreamsPanel initialStreams={liveStreams} initialBandwidth={totalBandwidthMbps} />
              </div>,

              /* Third Row Analytics - Hourly Activity Heatmap Backup */
              <div key="hourly" className="grid gap-4 md:grid-cols-1">
                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle>Moyenne d'Activité Horaire</CardTitle>
                    <CardDescription>Heure de démarrage des sessions sur la période donnée.</CardDescription>
                  </CardHeader>
                  <CardContent className="pl-0 pb-4">
                    <div className="h-[250px] min-h-[250px] w-full">
                      <ActivityByHourChart data={metrics.hourlyChartData} />
                    </div>
                  </CardContent>
                </Card>
              </div>,

              /* Monthly Watch Time + Completion Ratio + Client Categories */
              <div key="new-stats" className="grid gap-4 md:grid-cols-3">
                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle>Temps Mensuel</CardTitle>
                    <CardDescription>Heures de visionnage par mois (12 derniers mois).</CardDescription>
                  </CardHeader>
                  <CardContent className="pl-0 pb-4">
                    <div className="h-[300px] w-full">
                      {metrics.monthlyWatchData.length > 0 ? (
                        <MonthlyWatchTimeChart data={metrics.monthlyWatchData} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-500 text-sm">Aucune donnée</div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle>Taux de Complétion</CardTitle>
                    <CardDescription>Ratio sessions terminées vs abandonnées vs partielles.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[280px] w-full">
                      {metrics.completionData.length > 0 ? (
                        <CompletionRatioChart data={metrics.completionData} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-500 text-sm">Aucune donnée de durée</div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle>Familles de Clients</CardTitle>
                    <CardDescription>TV, Web, Mobile, Desktop — catégorisation automatique.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[280px] w-full">
                      {metrics.clientCategoryData.length > 0 ? (
                        <ClientCategoryChart data={metrics.clientCategoryData} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-500 text-sm">Aucun client</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>,

              /* Expansion: Server Load Timeline */
              <div key="server-load" className="grid gap-4 md:grid-cols-1">
                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle>Charge Serveur (Concurrent Streams)</CardTitle>
                    <CardDescription>Évolution temporelle absolue du nombre de flux actifs simultanés enregistrés.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ComposedTrendChart data={metrics.serverLoadData} series={[{ key: "peakStreams", color: "#ef4444", name: "Serveur", type: "line" }]} />
                  </CardContent>
                </Card>
              </div>
            ]} />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Suspense fallback={<Skeleton className="h-[400px] w-full bg-zinc-900/50 rounded-xl" />}>
              <DeepInsights type={type} timeRange={timeRange} excludedLibraries={excludedLibraries} />
            </Suspense>
            <Suspense fallback={<Skeleton className="h-[400px] w-full bg-zinc-900/50 rounded-xl" />}>
              <GranularAnalysis type={type} timeRange={timeRange} excludedLibraries={excludedLibraries} />
            </Suspense>
          </TabsContent>

          <TabsContent value="network" className="space-y-6">
            <Suspense fallback={<Skeleton className="h-[400px] w-full bg-zinc-900/50 rounded-xl" />}>
              <NetworkAnalysis type={type} timeRange={timeRange} excludedLibraries={excludedLibraries} />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
