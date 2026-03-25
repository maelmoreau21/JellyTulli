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

// Simplified but recognizable continent outlines as SVG paths (1000x500 viewBox)
const CONTINENT_PATHS = [
  // North America
  "M130,70 L170,55 L200,50 L240,55 L270,60 L300,75 L320,90 L330,110 L325,130 L310,150 L295,160 L280,170 L265,180 L250,190 L240,200 L230,210 L220,215 L205,220 L195,225 L185,228 L175,232 L165,230 L155,225 L148,218 L145,210 L150,200 L155,190 L160,180 L150,170 L140,160 L135,150 L130,140 L125,130 L120,120 L115,110 L112,100 L115,90 L120,80 Z",
  // South America
  "M290,245 L300,240 L310,243 L320,250 L330,260 L340,275 L345,290 L345,310 L340,330 L335,345 L332,355 L330,365 L325,380 L318,395 L310,405 L305,415 L298,420 L290,418 L285,410 L280,395 L278,380 L280,365 L282,350 L280,335 L275,320 L272,305 L275,290 L278,275 L282,260 Z",
  // Europe
  "M450,100 L460,95 L475,92 L490,90 L510,92 L530,95 L545,100 L555,108 L560,118 L565,130 L568,140 L565,150 L560,158 L555,165 L550,172 L540,178 L530,182 L520,185 L510,188 L500,192 L490,195 L480,197 L470,195 L462,190 L458,182 L455,172 L450,160 L447,148 L445,136 L444,124 L445,112 Z",
  // Africa
  "M470,210 L485,205 L500,205 L518,208 L535,215 L548,225 L558,238 L565,252 L570,268 L572,285 L570,305 L565,322 L558,340 L550,355 L542,368 L535,378 L528,385 L520,388 L510,390 L500,388 L492,382 L485,372 L480,360 L478,345 L480,328 L482,310 L480,292 L475,275 L472,258 L470,240 L468,225 Z",
  // Asia
  "M570,60 L595,55 L620,50 L650,48 L680,50 L710,55 L740,62 L770,70 L795,80 L815,92 L830,108 L840,125 L845,140 L848,158 L845,175 L840,190 L832,205 L820,218 L805,228 L788,235 L770,240 L752,244 L735,246 L718,245 L700,242 L682,238 L665,232 L650,224 L638,215 L628,205 L620,195 L612,185 L605,175 L598,165 L592,155 L585,145 L578,135 L572,122 L568,108 L566,95 L567,78 Z",
  // Australia
  "M798,345 L815,340 L832,342 L848,348 L860,358 L868,370 L872,382 L870,395 L865,405 L855,412 L842,416 L828,418 L815,415 L805,408 L798,398 L794,385 L792,372 L794,358 Z",
];

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
          <div className="relative w-full overflow-hidden rounded-xl bg-gradient-to-b from-slate-50 to-zinc-100 dark:from-zinc-900/60 dark:to-zinc-950/40 border border-border/50">
            <svg viewBox="0 0 1000 500" className="w-full h-auto" style={{ minHeight: 220, maxHeight: 380 }}>
              <defs>
                <radialGradient id="dotGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgb(99, 102, 241)" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="rgb(99, 102, 241)" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="liveGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity="0" />
                </radialGradient>
              </defs>
              
              {/* Latitude/longitude grid lines */}
              <g stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" strokeWidth="0.5" opacity="0.4">
                {[83, 167, 250, 333, 417].map((y) => (
                  <line key={`h-${y}`} x1="0" y1={y} x2="1000" y2={y} strokeDasharray="4 8" />
                ))}
                {[167, 333, 500, 667, 833].map((x) => (
                  <line key={`v-${x}`} x1={x} y1="0" x2={x} y2="500" strokeDasharray="4 8" />
                ))}
                {/* Equator */}
                <line x1="0" y1="250" x2="1000" y2="250" strokeWidth="0.8" strokeDasharray="6 4" opacity="0.5" />
              </g>

              {/* Continent outlines — real shapes */}
              <g className="text-zinc-300 dark:text-zinc-700" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1" strokeOpacity="0.15">
                {CONTINENT_PATHS.map((d, i) => (
                  <path key={i} d={d} />
                ))}
              </g>

              {/* Country dots */}
              {data.countries.map((country) => {
                const pos = COUNTRY_POSITIONS[country.name];
                if (!pos) return null;
                const [cx, cy] = pos;
                const normalizedSize = country.sessions / maxSessions;
                const radius = Math.max(4, Math.min(18, normalizedSize * 18));

                return (
                  <Tooltip key={country.name}>
                    <TooltipTrigger asChild>
                      <g className="cursor-pointer">
                        {/* Outer glow */}
                        <circle cx={cx} cy={cy} r={radius * 2.5} fill="url(#dotGlow)" />
                        {/* Dot */}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={radius}
                          className="fill-indigo-500 dark:fill-indigo-400"
                          stroke="white"
                          strokeWidth="1.5"
                          opacity="0.85"
                          style={{ filter: "drop-shadow(0 1px 3px rgba(99, 102, 241, 0.4))" }}
                        />
                        {/* Session count inside large dots */}
                        {radius > 10 && (
                          <text
                            x={cx}
                            y={cy + 3.5}
                            textAnchor="middle"
                            fill="white"
                            fontSize="9"
                            fontWeight="700"
                          >
                            {country.sessions}
                          </text>
                        )}
                        {/* Country label for large dots */}
                        {radius > 8 && (
                          <text
                            x={cx}
                            y={cy - radius - 5}
                            textAnchor="middle"
                            className="fill-zinc-600 dark:fill-zinc-400"
                            fontSize="9"
                            fontWeight="600"
                          >
                            {country.name}
                          </text>
                        )}
                      </g>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs max-w-[200px]">
                      <div className="font-bold">{country.name}</div>
                      <div className="text-muted-foreground">{country.sessions} sessions</div>
                      {country.cities.length > 0 && (
                        <div className="text-[10px] mt-1 text-muted-foreground">
                          {country.cities.slice(0, 5).join(", ")}{country.cities.length > 5 ? ` +${country.cities.length - 5}` : ""}
                        </div>
                      )}
                    </TooltipContent>
                  </Tooltip>
                );
              })}

              {/* Live stream indicators */}
              {data.liveLocations.map((live, i) => {
                const pos = COUNTRY_POSITIONS[live.country];
                if (!pos) return null;
                const [cx, cy] = pos;
                const offsetX = cx + 18 + (i % 3) * 10;
                const offsetY = cy - 12 + Math.floor(i / 3) * 10;

                return (
                  <Tooltip key={`live-${i}`}>
                    <TooltipTrigger asChild>
                      <g className="cursor-pointer">
                        <circle cx={offsetX} cy={offsetY} r="8" fill="url(#liveGlow)" />
                        <circle
                          cx={offsetX}
                          cy={offsetY}
                          r="3.5"
                          className="fill-emerald-500 animate-pulse"
                          stroke="white"
                          strokeWidth="1"
                        />
                      </g>
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

          {/* Country list — compact grid */}
          {data.countries.length > 0 && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
              {data.countries.slice(0, 8).map((c) => (
                <div key={c.name} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md bg-zinc-50 dark:bg-zinc-900/30 border border-border/50">
                  <MapPin className="w-3 h-3 text-indigo-500 shrink-0" />
                  <span className="truncate font-medium">{c.name}</span>
                  <span className="text-muted-foreground ml-auto shrink-0 font-semibold">{c.sessions}</span>
                </div>
              ))}
            </div>
          )}
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
