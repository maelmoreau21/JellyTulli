"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "next-intl";

type LibraryRule = {
    completionEnabled: boolean;
    completedThreshold: number;
    partialThreshold: number;
    abandonedThreshold: number;
};

export default function SettingsLibraryRulesPage() {
    const t = useTranslations('settings');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [availableLibraries, setAvailableLibraries] = useState<string[]>([]);
    const [rules, setRules] = useState<Record<string, LibraryRule>>({});

    const defaultKeys = useMemo(() => ['movies','tvshows','music','books','homevideos','photos','livetv'], []);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const res = await fetch('/api/settings');
                if (!res.ok) throw new Error('Failed');
                const data = await res.json();
                if (!mounted) return;
                setAvailableLibraries(data.availableLibraries || []);
                setRules(data.libraryRules || {});
            } catch (err) {
                setMsg({ type: 'error', text: (err as any)?.message || 'Failed to load' });
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, []);

    const keys = useMemo(() => {
        return Array.from(new Set([...defaultKeys, ...Object.keys(rules)])).filter(Boolean);
    }, [defaultKeys, rules]);

    const humanize = (k: string) => {
        const map: Record<string,string> = { movies: 'Movies', tvshows: 'TV Shows', music: 'Music', books: 'Books', homevideos: 'Home Videos', photos: 'Photos', livetv: 'Live TV' };
        return map[k] || k.replace(/([a-z])([A-Z])/g, '$1 $2');
    };

    const setRule = (key: string, r: Partial<LibraryRule>) => {
        setRules(prev => ({ ...prev, [key]: { ...(prev[key] || { completionEnabled: true, completedThreshold: 80, partialThreshold: 20, abandonedThreshold: 10 }), ...r } }));
    };

    const handleSave = async () => {
        setSaving(true); setMsg(null);
        try {
            const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ libraryRules: rules }) });
            const data = await res.json().catch(() => ({}));
            if (res.ok) setMsg({ type: 'success', text: t('savedSuccess') });
            else setMsg({ type: 'error', text: data.error || t('saveError') });
        } catch (err) {
            setMsg({ type: 'error', text: (err as any)?.message || t('saveError') });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 max-w-[900px] mx-auto">{t('loading') || 'Loading...'}</div>;

    return (
        <div className="p-4 md:p-8 max-w-[1100px] mx-auto space-y-4">
            <Card className="app-surface">
                <CardHeader>
                    <CardTitle>{t('libraryRules')}</CardTitle>
                    <CardDescription>{t('libraryRules')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {msg && (
                        <div className={`p-3 rounded text-sm ${msg.type === 'success' ? 'text-emerald-400 bg-emerald-500/5' : 'text-red-400 bg-red-500/5'}`}>{msg.text}</div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {keys.map((key) => {
                            const r = rules[key] || { completionEnabled: true, completedThreshold: 80, partialThreshold: 20, abandonedThreshold: 10 };
                            return (
                                <div key={key} className="p-4 border rounded-lg app-surface-soft">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="font-semibold">{humanize(key)}</div>
                                        <div className="text-xs text-muted-foreground">{key}</div>
                                    </div>
                                    <div className="space-y-2">
                                        <div>
                                            <Label>Completion Enabled</Label>
                                            <div className="mt-1">
                                                <label className="inline-flex items-center gap-2">
                                                    <input type="checkbox" checked={!!r.completionEnabled} onChange={(e) => setRule(key, { completionEnabled: e.target.checked })} />
                                                    <span className="text-sm">{r.completionEnabled ? 'Enabled' : 'Disabled'}</span>
                                                </label>
                                            </div>
                                        </div>
                                        <div>
                                            <Label>Completed Threshold (%)</Label>
                                            <Input type="number" min={1} max={100} value={r.completedThreshold} onChange={(e) => setRule(key, { completedThreshold: Number(e.target.value || 0) })} />
                                        </div>
                                        <div>
                                            <Label>Partial Threshold (%)</Label>
                                            <Input type="number" min={1} max={100} value={r.partialThreshold} onChange={(e) => setRule(key, { partialThreshold: Number(e.target.value || 0) })} />
                                        </div>
                                        <div>
                                            <Label>Abandoned Threshold (%)</Label>
                                            <Input type="number" min={0} max={100} value={r.abandonedThreshold} onChange={(e) => setRule(key, { abandonedThreshold: Number(e.target.value || 0) })} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
                <CardFooter>
                    <div className="flex gap-3">
                        <button onClick={handleSave} disabled={saving} className={`px-4 py-2 rounded-md font-medium ${saving ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>
                            {saving ? t('saving') : t('saveSettings')}
                        </button>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}
