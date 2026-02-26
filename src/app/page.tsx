import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Activity, Users, Clock, PlayCircle } from "lucide-react";
import { DashboardChart } from "@/components/DashboardChart";
import Image from "next/image";
import { getJellyfinImageUrl } from "@/lib/jellyfin";

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

export const revalidate = 0; // Disable static caching for dashboard since it's real-time

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

  if (activeStreamsCount > 0) {
    const payloads = await Promise.all(keys.map((k) => redis.get(k)));
    liveStreams = payloads
      .filter((p): p is string => p !== null)
      .map((p) => {
        const payload: WebhookPayload = JSON.parse(p);
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

  histories.forEach((h: { startedAt: Date; durationWatched: number }) => {
    const dayName = dayNames[h.startedAt.getDay()];
    if (daysMap.has(dayName)) {
      const currentSeconds = daysMap.get(dayName)!;
      daysMap.set(dayName, currentSeconds + h.durationWatched);
    }
  });

  const chartData = Array.from(daysMap.entries()).map(([name, seconds]) => {
    return { name, hours: parseFloat((seconds / 3600).toFixed(1)) };
  });

  return (
    <div className="flex-col md:flex">
      <div className="border-b">
        <div className="flex h-16 items-center px-4">
          <h1 className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
            <PlayCircle className="w-6 h-6" /> JellyTulli
          </h1>
        </div>
      </div>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        </div>

        {/* Global Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Streams Actifs
              </CardTitle>
              <Activity className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeStreamsCount}</div>
              <p className="text-xs text-muted-foreground">
                En cours de lecture
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Utilisateurs
              </CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsers}</div>
              <p className="text-xs text-muted-foreground">
                Inscrits sur la plateforme
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Heures Visionnées
              </CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{hoursWatched.toLocaleString()}h</div>
              <p className="text-xs text-muted-foreground">
                Temps de lecture total
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          {/* Chart Section */}
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Temps de lecture (7 derniers jours)</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
              <div className="h-[300px] w-full">
                <DashboardChart data={chartData} />
              </div>
            </CardContent>
          </Card>

          {/* Live Streams Section */}
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
                        <div className="relative w-10 h-14 bg-muted rounded shrink-0 overflow-hidden">
                          <Image
                            src={getJellyfinImageUrl(stream.itemId, 'Primary')}
                            alt={stream.mediaTitle}
                            fill
                            unoptimized
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-14 bg-muted rounded shrink-0 flex items-center justify-center">
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
