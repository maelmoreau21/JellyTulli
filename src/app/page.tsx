"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Activity, Users, Clock, PlayCircle } from "lucide-react";

// Types fictifs pour le rendu initial avant branchement réel backend
type LiveStream = {
  sessionId: string;
  user: string;
  mediaTitle: string;
  playMethod: string;
  device: string;
};

export default function DashboardPage() {
  const [stats, setStats] = useState({
    activeStreams: 0,
    totalUsers: 0,
    hoursWatched: 0,
  });

  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);

  // Données fictives pour le graphique en attendant l'API (7 derniers jours)
  const chartData = [
    { name: "Lun", hours: 12 },
    { name: "Mar", hours: 19 },
    { name: "Mer", hours: 15 },
    { name: "Jeu", hours: 22 },
    { name: "Ven", hours: 35 },
    { name: "Sam", hours: 48 },
    { name: "Dim", hours: 42 },
  ];

  // Simulation d'un fetch de données de l'API (à remplacer par de vrais fetch React Server Components ou SWR)
  useEffect(() => {
    // Dans une version finale, on appellerait une route API GET /api/stats et /api/live
    // Pour l'instant on mock les données
    setStats({
      activeStreams: 2,
      totalUsers: 14,
      hoursWatched: 342,
    });

    setLiveStreams([
      {
        sessionId: "session-1",
        user: "Mael",
        mediaTitle: "Big Buck Bunny",
        playMethod: "Transcode",
        device: "Chrome",
      },
      {
        sessionId: "session-2",
        user: "Alice",
        mediaTitle: "Sintel",
        playMethod: "DirectPlay",
        device: "Nvidia Shield",
      },
    ]);
  }, []);

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
              <div className="text-2xl font-bold">{stats.activeStreams}</div>
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
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
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
              <div className="text-2xl font-bold">{stats.hoursWatched}h</div>
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
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{
                      top: 10,
                      right: 30,
                      left: 0,
                      bottom: 0,
                    }}
                  >
                    <defs>
                      <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                    <XAxis
                      dataKey="name"
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${value}h`}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: "8px" }}
                      itemStyle={{ color: "#fff" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="hours"
                      stroke="#8884d8"
                      fillOpacity={1}
                      fill="url(#colorHours)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
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
                      className="flex items-center p-3 border rounded-lg bg-card/50"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {stream.mediaTitle}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {stream.user} • {stream.device}
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
