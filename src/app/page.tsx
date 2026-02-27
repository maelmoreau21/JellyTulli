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
import { ActivityByHourChart, ActivityHourData } from "@/components/charts/ActivityByHourChart";
import { PlatformDistributionChart, PlatformData } from "@/components/charts/PlatformDistributionChart";
import Image from "next/image";
import { getJellyfinImageUrl } from "@/lib/jellyfin";
import { LogoutButton } from "@/components/LogoutButton";
import { Navigation } from "@/components/Navigation";

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

export default async function DashboardPage() {
  // 1. Prisma : Utilisateurs Totaux
  const totalUsers = await prisma.user.count();

  // 2. Prisma : Heures Visionnées
  const hoursWatchedAgg = await prisma.playbackHistory.aggregate({
    _sum: {
      durationWatched: true,
    },
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

  // 4. Prisma : Données du graphique (7 derniers jours)
  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 6); // On prend les 6 jours précédents + aujourd'hui (7 j au total)
  last7Days.setHours(0, 0, 0, 0);

  const histories = await prisma.playbackHistory.findMany({
    where: {
      startedAt: {
        gte: last7Days,
      },
    },
    select: {
      startedAt: true,
      durationWatched: true,
    },
  });

  // Agréger par jour en JS
  const daysMap = new Map<string, number>();

  // Initialiser les 7 derniers jours avec 0
  const dayNames = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dayStr = dayNames[d.getDay()];
    // Pour gérer les éventuels doublons de noms de jours (si la fenêtre > 7 j), on pourrait utiliser des dates.
    // Mais ici 7 jours stricts, on va utiliser "Lun", "Mar", etc.
    daysMap.set(dayStr, 0);
  }

  histories.forEach((h: { startedAt: Date; durationWatched: number; }) => {
    const dayName = dayNames[h.startedAt.getDay()];
    if (daysMap.has(dayName)) {
      const currentSeconds = daysMap.get(dayName)!;
      daysMap.set(dayName, currentSeconds + h.durationWatched);
    }
  });

  // 5. Statistiques avancées (24h) : DirectPlay %
  const last24h = new Date();
  last24h.setHours(last24h.getHours() - 24);

  const last24hHistories = await prisma.playbackHistory.findMany({
    where: { startedAt: { gte: last24h } },
    select: { playMethod: true }
  });

  const total24h = last24hHistories.length;
  const directPlay24h = last24hHistories.filter(h => h.playMethod === "DirectPlay").length;
  const directPlayPercent = total24h > 0 ? Math.round((directPlay24h / total24h) * 100) : 100;

  // 6. Top 5 Utilisateurs
  const topUsersAgg = await prisma.playbackHistory.groupBy({
    by: ['userId'],
    _sum: { durationWatched: true },
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

  const chartData = Array.from(daysMap.entries()).map(([name, seconds]) => {
    return { name, hours: parseFloat((seconds / 3600).toFixed(1)) };
  });

  return (
    <div className="flex-col md:flex">
      <div className="border-b">
        <div className="flex h-16 items-center px-4">
          <h1 className="text-xl font-bold tracking-tight text-primary flex items-center gap-2 hover:opacity-80 transition-opacity">
            <PlayCircle className="w-6 h-6" /> JellyTulli
          </h1>
          <Navigation />
          <div className="ml-auto flex items-center space-x-4">
            <LogoutButton />
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md border">Données mises en cache (60s)</span>
        </div>

        {/* Global Metrics Row 1 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Streams Actifs</CardTitle>
              <Activity className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeStreamsCount}</div>
              <p className="text-xs text-muted-foreground">En cours de lecture</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bande Passante</CardTitle>
              <ActivitySquare className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">~{activeStreamsCount * 12} Mbps</div>
              <p className="text-xs text-muted-foreground">Outbound estimé en direct</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Efficacité DirectPlay</CardTitle>
              <MonitorPlay className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{directPlayPercent}%</div>
              <p className="text-xs text-muted-foreground">Ratio Serveur (24h)</p>
            </CardContent>
          </Card>

          <Card>
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
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Volume de lecture (7 derniers jours)</CardTitle>
            </CardHeader>
            <CardContent className="pl-2 pb-4">
              <div className="h-[300px] min-h-[300px] w-full">
                <DashboardChart data={chartData} />
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-3">
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

          <Card className="col-span-2">
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
          <Card className="col-span-3">
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
