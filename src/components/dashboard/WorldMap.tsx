"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe2, Radio, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslations } from "next-intl";

interface CountryData {
  name: string;
  sessions: number;
  cities: string[];
}

interface LiveLocation {
  country: string;
  city: string;
  username: string;
  mediaTitle: string;
}

interface GeoData {
  countries: CountryData[];
  liveLocations: LiveLocation[];
}

// ISO country name → approximate position on a 1000x500 Mercator-ish grid
// Only the most common countries — unknown ones get listed in the table
const COUNTRY_POSITIONS: Record<string, [number, number]> = {
  "France": [490, 170], "United States": [220, 180], "Germany": [510, 160],
  "United Kingdom": [470, 145], "Canada": [230, 130], "Spain": [470, 195],
  "Italy": [520, 185], "Netherlands": [500, 150], "Belgium": [495, 155],
  "Switzerland": [510, 170], "Australia": [830, 380], "Japan": [860, 180],
  "Brazil": [340, 340], "Mexico": [210, 230], "India": [720, 240],
  "Russia": [650, 120], "China": [780, 190], "South Korea": [840, 180],
  "Sweden": [530, 115], "Norway": [520, 110], "Denmark": [510, 135],
  "Finland": [555, 110], "Poland": [540, 150], "Portugal": [450, 200],
  "Argentina": [320, 400], "Turkey": [580, 195], "South Africa": [560, 400],
  "New Zealand": [880, 420], "Ireland": [455, 145], "Austria": [520, 170],
  "Czech Republic": [525, 155], "Romania": [550, 170], "Ukraine": [570, 155],
  "Colombia": [285, 280], "Chile": [310, 400], "Peru": [285, 320],
  "Egypt": [565, 230], "Morocco": [470, 215], "Israel": [580, 215],
  "Thailand": [765, 260], "Philippines": [815, 260], "Indonesia": [790, 310],
  "Malaysia": [775, 285], "Singapore": [775, 295], "Vietnam": [780, 250],
  "Taiwan": [815, 225], "Hong Kong": [800, 230],
};

export function WorldMap() {
  const t = useTranslations("dashboard");
  const [data, setData] = useState<GeoData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/geo-stats");
        if (res.ok) setData(await res.json());
      } catch { /* silent */ }
      setLoading(false);
    })();
  }, []);

  const maxSessions = useMemo(() => {
    if (!data) return 1;
    return Math.max(...data.countries.map((c) => c.sessions), 1);
  }, [data]);

  if (loading) {
    return (
      <Card className="app-surface-soft border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe2 className="w-5 h-5 text-indigo-500" />
            {t("worldMap")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="w-full h-[280px] rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.countries.length === 0) return null;

  return (
    <Card className="app-surface-soft border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-md flex items-center gap-2">
              <Globe2 className="w-5 h-5 text-indigo-500" />
              {t("worldMap")}
            </CardTitle>
            <CardDescription>{t("worldMapDesc")}</CardDescription>
          </div>
          {data.liveLocations.length > 0 && (
            <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 gap-1 animate-pulse">
              <Radio className="w-3 h-3" />
              {data.liveLocations.length} {t("liveNow")}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          {/* SVG World Map */}
          <div className="relative w-full overflow-hidden rounded-xl bg-zinc-100/50 dark:bg-zinc-900/30 border border-border/50">
            <svg viewBox="0 0 1000 500" className="w-full h-auto" style={{ minHeight: 200, maxHeight: 350 }}>
              {/* Simple world outline — rough continents */}
              <defs>
                <radialGradient id="dotGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgb(99, 102, 241)" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="rgb(99, 102, 241)" stopOpacity="0" />
                </radialGradient>
              </defs>
              
              {/* Continents as simplified paths */}
              <g opacity="0.15" fill="currentColor" className="text-zinc-500 dark:text-zinc-400">
                {/* North America */}
                <ellipse cx="220" cy="170" rx="120" ry="80" />
                {/* South America */}
                <ellipse cx="310" cy="350" rx="60" ry="100" />
                {/* Europe */}
                <ellipse cx="510" cy="155" rx="60" ry="50" />
                {/* Africa */}
                <ellipse cx="530" cy="300" rx="70" ry="100" />
                {/* Asia */}
                <ellipse cx="720" cy="180" rx="120" ry="80" />
                {/* Australia */}
                <ellipse cx="840" cy="380" rx="50" ry="35" />
              </g>

              {/* Grid lines */}
              <g stroke="currentColor" className="text-zinc-300 dark:text-zinc-700" strokeWidth="0.5" opacity="0.3">
                {[100, 200, 300, 400].map((y) => (
                  <line key={`h-${y}`} x1="0" y1={y} x2="1000" y2={y} />
                ))}
                {[200, 400, 600, 800].map((x) => (
                  <line key={`v-${x}`} x1={x} y1="0" x2={x} y2="500" />
                ))}
              </g>

              {/* Country dots */}
              {data.countries.map((country) => {
                const pos = COUNTRY_POSITIONS[country.name];
                if (!pos) return null;
                const [cx, cy] = pos;
                const radius = Math.max(4, Math.min(20, (country.sessions / maxSessions) * 20));

                return (
                  <Tooltip key={country.name}>
                    <TooltipTrigger asChild>
                      <g className="cursor-pointer">
                        {/* Glow */}
                        <circle cx={cx} cy={cy} r={radius * 2.5} fill="url(#dotGlow)" />
                        {/* Dot */}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={radius}
                          className="fill-indigo-500 dark:fill-indigo-400 stroke-white dark:stroke-zinc-900"
                          strokeWidth="1.5"
                          opacity="0.85"
                        />
                        {/* Label for large dots */}
                        {radius > 8 && (
                          <text
                            x={cx}
                            y={cy - radius - 4}
                            textAnchor="middle"
                            className="fill-zinc-600 dark:fill-zinc-400"
                            fontSize="10"
                            fontWeight="600"
                          >
                            {country.name}
                          </text>
                        )}
                      </g>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">
                      <div className="font-bold">{country.name}</div>
                      <div className="text-muted-foreground">{country.sessions} sessions</div>
                      {country.cities.length > 0 && (
                        <div className="text-[10px] mt-1 text-muted-foreground">
                          {country.cities.join(", ")}
                        </div>
                      )}
                    </TooltipContent>
                  </Tooltip>
                );
              })}

              {/* Live indicators */}
              {data.liveLocations.map((live, i) => {
                const pos = COUNTRY_POSITIONS[live.country];
                if (!pos) return null;
                const [cx, cy] = pos;
                // Offset slightly to avoid overlapping with main dot
                const offsetX = cx + 15 + (i % 3) * 8;
                const offsetY = cy - 10 + Math.floor(i / 3) * 8;

                return (
                  <Tooltip key={`live-${i}`}>
                    <TooltipTrigger asChild>
                      <circle
                        cx={offsetX}
                        cy={offsetY}
                        r="3"
                        className="fill-emerald-500 animate-pulse"
                      />
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">
                      <div className="font-bold flex items-center gap-1">
                        <Radio className="w-3 h-3 text-emerald-500" />
                        {live.username}
                      </div>
                      <div className="text-muted-foreground">{live.mediaTitle}</div>
                      <div className="text-[10px] text-muted-foreground">{live.city}, {live.country}</div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </svg>
          </div>

          {/* Country list — compact */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
            {data.countries.slice(0, 8).map((c) => (
              <div key={c.name} className="flex items-center gap-2 text-xs">
                <MapPin className="w-3 h-3 text-indigo-500 shrink-0" />
                <span className="truncate font-medium">{c.name}</span>
                <span className="text-muted-foreground ml-auto shrink-0">{c.sessions}</span>
              </div>
            ))}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
