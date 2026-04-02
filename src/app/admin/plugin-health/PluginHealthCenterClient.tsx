"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Download, HeartPulse, RefreshCw, Send, ShieldCheck, Timer } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

type HealthSnapshot = {
    generatedAt: string;
    plugin: {
        connected: boolean;
        lastSeen: string | null;
        version: string | null;
        serverName: string | null;
        hasApiKey: boolean;
        endpoint: string;
    };
    heartbeat: {
        count24h: number;
        gapSec: number | null;
        intervalP50Sec: number | null;
        intervalP95Sec: number | null;
        jitterP95Sec: number | null;
    };
    ingestion: {
        successEstimate24h: number;
        failureCount24h: number;
        unauthorized24h: number;
        rateLimited24h: number;
        invalidPayload24h: number;
        monitorErrors24h: number;
        successRate24h: number | null;
    };
    streams: {
        active: number;
        transcodes: number;
        stale: number;
        avgBitrateKbps: number | null;
    };
    pluginReportedMetrics: {
        queueDepth: number | null;
        retries: number | null;
        lastHttpCode: number | null;
        note: string;
    };
    recentFailures: Array<{
        id: string;
        action: string;
        ipAddress: string | null;
        createdAt: string;
        details: Record<string, unknown> | null;
    }>;
};

function formatGap(seconds: number | null): string {
    if (seconds === null) return "-";
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
}

function formatBitrateKbps(value: number | null): string {
    if (value === null || !Number.isFinite(value)) return "-";
    if (value >= 1000) return `${(value / 1000).toFixed(1)} Mbps`;
    return `${Math.round(value)} kbps`;
}

export default function PluginHealthCenterClient() {
    const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<"test_connection" | "force_heartbeat" | null>(null);
    const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const loadSnapshot = useCallback(async () => {
        setLoading(true);
        setNotice(null);
        try {
            const res = await fetch("/api/admin/plugin/health", { cache: "no-store" });
            if (!res.ok) {
                throw new Error(`Health endpoint failed (${res.status})`);
            }
            const data = (await res.json()) as HealthSnapshot;
            setSnapshot(data);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load plugin health.";
            setNotice({ type: "error", text: message });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadSnapshot();
    }, [loadSnapshot]);

    const runAction = useCallback(async (action: "test_connection" | "force_heartbeat") => {
        setActionLoading(action);
        setNotice(null);
        try {
            const res = await fetch("/api/admin/plugin/health", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ action }),
            });

            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error((body as { error?: string }).error || `Action failed (${res.status})`);
            }

            const latency = typeof (body as { latencyMs?: number }).latencyMs === "number"
                ? `${(body as { latencyMs: number }).latencyMs}ms`
                : "n/a";

            setNotice({
                type: "success",
                text: action === "test_connection"
                    ? `Connection test completed (latency ${latency}).`
                    : `Manual heartbeat sent (latency ${latency}).`,
            });

            await loadSnapshot();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Action failed.";
            setNotice({ type: "error", text: message });
        } finally {
            setActionLoading(null);
        }
    }, [loadSnapshot]);

    const connectionBadge = useMemo(() => {
        if (!snapshot?.plugin.connected) {
            return <Badge className="bg-red-500/15 text-red-400 border-red-500/30">offline</Badge>;
        }
        return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">online</Badge>;
    }, [snapshot?.plugin.connected]);

    return (
        <div className="flex-col md:flex">
            <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6 max-w-[1400px] mx-auto w-full">
                <header className="flex flex-col gap-3">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                            <HeartPulse className="w-7 h-7 text-primary" />
                            Plugin Health Center
                        </h1>
                        <p className="text-sm text-muted-foreground mt-2 max-w-3xl">
                            Centralized diagnostics for heartbeat stability, ingestion reliability, and stream health.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => void loadSnapshot()} disabled={loading}>
                            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => void runAction("test_connection")}
                            disabled={actionLoading !== null}
                        >
                            <ShieldCheck className="w-4 h-4" />
                            {actionLoading === "test_connection" ? "Testing..." : "Test Connection"}
                        </Button>
                        <Button
                            onClick={() => void runAction("force_heartbeat")}
                            disabled={actionLoading !== null}
                        >
                            <Send className="w-4 h-4" />
                            {actionLoading === "force_heartbeat" ? "Sending..." : "Force Heartbeat"}
                        </Button>
                        <Button asChild variant="secondary">
                            <a href="/api/admin/plugin/health?export=1">
                                <Download className="w-4 h-4" />
                                Export Diagnostic JSON
                            </a>
                        </Button>
                    </div>
                </header>

                {notice && (
                    <div className={`rounded-md border px-3 py-2 text-sm ${notice.type === "success"
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                            : "border-red-500/40 bg-red-500/10 text-red-400"
                        }`}>
                        {notice.text}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    <Card className="app-surface-soft border-border/60">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-muted-foreground">Connection</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1.5 text-sm">
                            <div className="flex items-center justify-between">
                                <span>Status</span>
                                {connectionBadge}
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <span>Last seen</span>
                                <span className="font-medium">{snapshot?.plugin.lastSeen ? new Date(snapshot.plugin.lastSeen).toLocaleString() : "-"}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <span>Server</span>
                                <span className="font-medium truncate">{snapshot?.plugin.serverName || "-"}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="app-surface-soft border-border/60">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-muted-foreground">Heartbeat jitter</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1.5 text-sm">
                            <div className="flex items-center justify-between">
                                <span>P50 interval</span>
                                <span className="font-semibold">{snapshot?.heartbeat.intervalP50Sec ?? "-"}s</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>P95 interval</span>
                                <span className="font-semibold">{snapshot?.heartbeat.intervalP95Sec ?? "-"}s</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>P95 jitter</span>
                                <span className="font-semibold">{snapshot?.heartbeat.jitterP95Sec ?? "-"}s</span>
                            </div>
                            <div className="flex items-center justify-between text-muted-foreground">
                                <span>Gap now</span>
                                <span>{formatGap(snapshot?.heartbeat.gapSec ?? null)}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="app-surface-soft border-border/60">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-muted-foreground">Ingestion reliability</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1.5 text-sm">
                            <div className="flex items-center justify-between">
                                <span>Success rate (24h)</span>
                                <span className="font-semibold">{snapshot?.ingestion.successRate24h ?? "-"}%</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Failures (24h)</span>
                                <span className="font-semibold">{snapshot?.ingestion.failureCount24h ?? 0}</span>
                            </div>
                            <div className="flex items-center justify-between text-muted-foreground">
                                <span>Unauthorized</span>
                                <span>{snapshot?.ingestion.unauthorized24h ?? 0}</span>
                            </div>
                            <div className="flex items-center justify-between text-muted-foreground">
                                <span>Rate limited</span>
                                <span>{snapshot?.ingestion.rateLimited24h ?? 0}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="app-surface-soft border-border/60">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-muted-foreground">Live stream health</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1.5 text-sm">
                            <div className="flex items-center justify-between">
                                <span>Active streams</span>
                                <span className="font-semibold">{snapshot?.streams.active ?? 0}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Transcodes</span>
                                <span className="font-semibold">{snapshot?.streams.transcodes ?? 0}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Stale streams</span>
                                <span className="font-semibold">{snapshot?.streams.stale ?? 0}</span>
                            </div>
                            <div className="flex items-center justify-between text-muted-foreground">
                                <span>Avg bitrate</span>
                                <span>{formatBitrateKbps(snapshot?.streams.avgBitrateKbps ?? null)}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <Card className="app-surface border-border/60 lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-400" />
                                Recent ingest failures
                            </CardTitle>
                            <CardDescription>
                                Latest plugin validation/security failures recorded by the server.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>When</TableHead>
                                        <TableHead>Action</TableHead>
                                        <TableHead>IP</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(snapshot?.recentFailures || []).map((entry) => (
                                        <TableRow key={entry.id}>
                                            <TableCell>{new Date(entry.createdAt).toLocaleString()}</TableCell>
                                            <TableCell>{entry.action}</TableCell>
                                            <TableCell>{entry.ipAddress || "-"}</TableCell>
                                        </TableRow>
                                    ))}
                                    {(snapshot?.recentFailures || []).length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center text-muted-foreground">
                                                No recent failures detected.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    <Card className="app-surface border-border/60">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Timer className="w-4 h-4 text-cyan-400" />
                                Plugin-reported metrics
                            </CardTitle>
                            <CardDescription>
                                Metrics expected from plugin queue telemetry.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                                <span>Queue depth</span>
                                <span className="font-medium">{snapshot?.pluginReportedMetrics.queueDepth ?? "-"}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Retries</span>
                                <span className="font-medium">{snapshot?.pluginReportedMetrics.retries ?? "-"}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Last HTTP code</span>
                                <span className="font-medium">{snapshot?.pluginReportedMetrics.lastHttpCode ?? "-"}</span>
                            </div>
                            <p className="text-xs text-muted-foreground pt-2 border-t border-border/60">
                                {snapshot?.pluginReportedMetrics.note || "-"}
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
