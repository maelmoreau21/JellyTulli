"use client";

import React, { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";

export default function RecentClosuresClient({ events, defaultCount = 5 }: { events?: Array<any>, defaultCount?: number }) {
    const t = useTranslations("dashboard");
    const [count, setCount] = useState<number>(defaultCount);

    const sorted = useMemo(() => {
        if (!Array.isArray(events)) return [];
        return [...events].sort((a, b) => {
            const ta = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
            const tb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
            return tb - ta;
        });
    }, [events]);

    const list = sorted.slice(0, count);

    const formatDate = (s?: string | null) => {
        if (!s) return t("never");
        try { return new Date(s).toLocaleString(); } catch { return String(s); }
    };

    return (
        <div>
            <div className="flex items-center justify-between">
                <div />
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{t("show")}</span>
                    <div className="inline-flex rounded-md border bg-transparent p-0.5">
                        {[5, 10].map((n) => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => setCount(n)}
                                className={`px-2 py-1 text-xs font-medium ${count === n ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100' } rounded`}
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-h-[320px] mt-3 space-y-2 overflow-y-auto pr-1">
                {list.length === 0 && (
                    <div className="app-surface-soft rounded-lg border border-dashed border-border py-8 text-center text-sm italic text-muted-foreground">{t("noRecentEvents")}</div>
                )}

                {list.map((event: any) => (
                    <div key={event.id} className="app-surface-soft rounded-lg border border-border p-3">
                        <div className="flex items-start gap-3 text-sm font-medium text-foreground">
                            {String(event.kind || "").includes("error")
                                ? <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                                : <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />}
                            <div className="flex-1 leading-relaxed">{event.message}</div>
                        </div>
                        <div className="mt-2 text-right text-[10px] font-mono text-muted-foreground">{formatDate(event.createdAt)}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
