"use client";

import { useState, useEffect, useCallback } from "react";
import { PlayCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FallbackImage } from "@/components/FallbackImage";
import { KillStreamButton } from "@/components/dashboard/KillStreamButton";

interface LiveStream {
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
}

function getImageUrl(itemId: string, type: string = 'Primary', fallbackId?: string) {
    let url = `/api/jellyfin/image?itemId=${itemId}&type=${type}`;
    if (fallbackId) url += `&fallbackId=${fallbackId}`;
    return url;
}

export function LiveStreamsPanel({ initialStreams, initialBandwidth }: { initialStreams: LiveStream[]; initialBandwidth: number }) {
    const [streams, setStreams] = useState<LiveStream[]>(initialStreams);
    const [bandwidth, setBandwidth] = useState(initialBandwidth);

    const fetchStreams = useCallback(async () => {
        try {
            const res = await fetch("/api/streams", { cache: "no-store" });
            if (res.ok) {
                const data = await res.json();
                setStreams(data.streams || []);
                setBandwidth(data.totalBandwidthMbps || 0);
            }
        } catch {
            // silently ignore network errors
        }
    }, []);

    useEffect(() => {
        const interval = setInterval(fetchStreams, 10000); // Poll every 10 seconds
        return () => clearInterval(interval);
    }, [fetchStreams]);

    return (
        <Card className="col-span-3 bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
            <CardHeader>
                <CardTitle className="flex gap-2"> En Direct <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse mt-1.5" /></CardTitle>
                <CardDescription>
                    Actuellement {streams.length} stream(s) en cours.{bandwidth > 0 ? ` ~${bandwidth} Mbps` : ''}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                    {streams.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                            Aucun stream en cours de lecture.
                        </p>
                    ) : (
                        streams.map((stream) => (
                            <div
                                key={stream.sessionId}
                                className="flex items-center gap-4 p-3 border rounded-lg border-zinc-800 bg-zinc-950/50"
                            >
                                {stream.itemId ? (
                                    <div className="relative w-12 aspect-[2/3] bg-muted rounded shrink-0 overflow-hidden ring-1 ring-white/10">
                                        <FallbackImage
                                            src={getImageUrl(stream.itemId, 'Primary', stream.parentItemId || undefined)}
                                            alt={stream.mediaTitle}
                                            fill
                                            className="object-cover"
                                        />
                                    </div>
                                ) : (
                                    <div className="w-12 aspect-[2/3] bg-muted rounded shrink-0 flex items-center justify-center ring-1 ring-white/10">
                                        <PlayCircle className="w-5 h-5 opacity-50" />
                                    </div>
                                )}

                                <div className="space-y-1 flex-1 min-w-0">
                                    <p className="text-sm font-medium leading-none truncate">
                                        {stream.mediaTitle}
                                    </p>
                                    {stream.mediaSubtitle && (
                                        <p className="text-[11px] text-zinc-400 truncate">{stream.mediaSubtitle}</p>
                                    )}
                                    <p className="text-xs text-muted-foreground flex flex-col gap-0.5">
                                        <span className="truncate">{stream.user} • {stream.device}</span>
                                        {(stream.city !== "Unknown" || stream.country !== "Unknown") && (
                                            <span className="text-[10px] opacity-70 truncate">
                                                📍 {stream.city !== "Unknown" ? `${stream.city}, ` : ''}{stream.country}
                                            </span>
                                        )}
                                    </p>
                                    {stream.progressPercent > 0 && (
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${stream.isPaused ? 'bg-yellow-500' : 'bg-purple-500'}`}
                                                    style={{ width: `${stream.progressPercent}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] text-zinc-500 w-8 text-right shrink-0">
                                                {stream.isPaused ? '⏸' : ''}{stream.progressPercent}%
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="ml-auto font-medium text-xs shrink-0">
                                    <span
                                        className={`px-2 py-1 rounded-full ${stream.playMethod === "Transcode"
                                            ? "bg-orange-500/10 text-orange-500"
                                            : "bg-emerald-500/10 text-emerald-500"
                                            }`}
                                    >
                                        {stream.playMethod}
                                    </span>
                                    <KillStreamButton sessionId={stream.sessionId} mediaTitle={stream.mediaTitle} />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
