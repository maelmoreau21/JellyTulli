"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from 'next-intl';
import { Activity, AlertTriangle, CheckCircle2, Clock3, DatabaseBackup, HeartPulse, RefreshCw, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type Snapshot = {
    status: any;
    excludedLibraries: string[];
    counts: {
        activeStreams: number;
        openPlaybackOrphans: number;
        dbStreamsWithoutRedis: number;
        redisOrphans: number;
    };
};

export function SystemHealthWidgets({ initialSnapshot }: { initialSnapshot: Snapshot }) {
    const t = useTranslations('dashboard');
    const [snapshot, setSnapshot] = useState(initialSnapshot);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 60_000);
        return () => clearInterval(id);
    }, []);

    function formatRelative(dateString: string | null) {
        if (!dateString) return t('never') || 'Never';
        const deltaMinutes = Math.max(0, Math.round((now - new Date(dateString).getTime()) / 60000));
        if (deltaMinutes < 1) return t('justNow') || 'just now';
        if (deltaMinutes < 60) return t('minutesAgo', { count: deltaMinutes }) || `about ${deltaMinutes} min ago`;
        const deltaHours = Math.round(deltaMinutes / 60);
        if (deltaHours < 24) return t('hoursAgo', { count: deltaHours }) || `about ${deltaHours} h ago`;
        return new Date(dateString).toLocaleString();
    }

    useEffect(() => {
        let cancelled = false;
        const refresh = async () => {
            try {
                const res = await fetch('/api/admin/health', { cache: 'no-store' });
                if (!res.ok) return;
                const data = await res.json();
                if (!cancelled) setSnapshot(data);
            } catch {
                // Ignore transient polling errors in the UI.
            }
        };

        const timer = setInterval(refresh, 15000);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, []);

    const monitorTone = snapshot.status.monitor.status === 'error'
        ? 'text-red-300 bg-red-500/10 border-red-500/20'
        : 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20';

    return (
        <div className="space-y-4">
            <div className="dashboard-banner flex flex-wrap items-center gap-2 rounded-2xl px-4 py-3 md:gap-3">
                <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] ${monitorTone}`}>
                    <Activity className="h-3.5 w-3.5" />
                    {t('monitor')} {snapshot.status.monitor.status === 'error' ? t('monitorStatusError') : t('monitorStatusActive')}
                </div>
                <div className="dashboard-pill inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                    <Clock3 className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-300" />
                    {t('lastPoll')}: {formatRelative(snapshot.status.monitor.lastPollAt)}
                </div>
                <div className="dashboard-pill inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                    <RefreshCw className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300" />
                    {t('lastSync')}: {formatRelative(snapshot.status.sync.lastSuccessAt)}
                </div>
                <div className="dashboard-pill inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                    <DatabaseBackup className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
                    {t('lastBackup')}: {formatRelative(snapshot.status.backup.lastSuccessAt)}
                </div>
                <Link href="/admin/log-health" className="ml-auto inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-700 dark:text-cyan-200 hover:bg-cyan-500/15">
                    <HeartPulse className="h-3.5 w-3.5" />
                    {t('logHealth')}
                </Link>
            </div>

            <Card className="border-zinc-200/60 dark:border-white/5 bg-white/80 dark:bg-zinc-950/90 backdrop-blur-xl shadow-[0_4px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
                <CardContent className="grid gap-4 p-5 md:grid-cols-4">
                    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-black/20 p-4">
                        <div className="flex items-center gap-2 text-sm text-zinc-400"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> {t('activeStreams')}</div>
                        <div className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">{snapshot.counts.activeStreams}</div>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-black/20 p-4">
                        <div className="flex items-center gap-2 text-sm text-zinc-400"><ShieldAlert className="h-4 w-4 text-orange-400" /> {t('openPlaybackOrphans')}</div>
                        <div className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">{snapshot.counts.openPlaybackOrphans}</div>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-black/20 p-4">
                        <div className="flex items-center gap-2 text-sm text-zinc-400"><AlertTriangle className="h-4 w-4 text-red-400" /> {t('dbWithoutRedis')}</div>
                        <div className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">{snapshot.counts.dbStreamsWithoutRedis}</div>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-black/20 p-4">
                        <div className="flex items-center gap-2 text-sm text-zinc-400"><HeartPulse className="h-4 w-4 text-cyan-400" /> {t('excludedLibraries')}</div>
                        <div className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">{snapshot.excludedLibraries.length}</div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
