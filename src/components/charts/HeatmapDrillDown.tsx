"use client";

import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, User, Film, Play } from "lucide-react";
import { useTranslations } from "next-intl";

interface DrillDownSession {
  username: string;
  mediaTitle: string;
  mediaType: string;
  durationMin: number;
  playMethod: string;
  clientName: string;
  startedAt: string;
}

interface HeatmapDrillDownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: number;
  hour: number;
  dayLabel: string;
}

export function HeatmapDrillDown({ open, onOpenChange, day, hour, dayLabel }: HeatmapDrillDownProps) {
  const t = useTranslations("charts");
  const [sessions, setSessions] = useState<DrillDownSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchData = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/heatmap-detail?day=${day}&hour=${hour}`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error("HeatmapDrillDown fetch failed:", err);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [day, hour, loaded]);

  // Fetch when dialog opens
  const handleOpenChange = (val: boolean) => {
    onOpenChange(val);
    if (val && !loaded) {
      fetchData();
    }
    if (!val) {
      setLoaded(false);
      setSessions([]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Clock className="w-5 h-5 text-indigo-500" />
            {dayLabel} — {hour}h00
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t("drilldownDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {loading && (
            <>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </>
          )}

          {!loading && sessions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t("noSessionsForSlot")}
            </p>
          )}

          {!loading &&
            sessions.map((s, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-border/50"
              >
                <div className="shrink-0 mt-0.5">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{s.username}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {s.playMethod}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Film className="w-3 h-3" />
                    <span className="truncate">{s.mediaTitle}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Play className="w-3 h-3" />
                      {s.durationMin} min
                    </span>
                    <span>{s.clientName}</span>
                    <span className="text-[10px] opacity-60">
                      {new Date(s.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
