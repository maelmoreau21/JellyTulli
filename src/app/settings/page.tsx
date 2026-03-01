"use client";

import { useState, useEffect, useRef } from "react";
import { RefreshCw, CheckCircle2, AlertCircle, Save, Download, UploadCloud, Clock, Trash2, Activity, Zap, Database, Play } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);

    const [settingsMsg, setSettingsMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [backupMsg, setBackupMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const [discordEnabled, setDiscordEnabled] = useState(false);
    const [discordUrl, setDiscordUrl] = useState("");
    const [discordAlertCondition, setDiscordAlertCondition] = useState("ALL");
    const [excludedLibraries, setExcludedLibraries] = useState("");

    // Monitor settings
    const [monitorActive, setMonitorActive] = useState(1000);
    const [monitorIdle, setMonitorIdle] = useState(5000);
    const [isSavingMonitor, setIsSavingMonitor] = useState(false);
    const [monitorMsg, setMonitorMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Task scheduler state
    const [taskStatus, setTaskStatus] = useState<Record<string, { loading: boolean; msg: { type: 'success' | 'error', text: string } | null }>>({
        recentSync: { loading: false, msg: null },
        fullSync: { loading: false, msg: null },
        backup: { loading: false, msg: null },
    });

    // Auto-backup state
    const [autoBackups, setAutoBackups] = useState<{name: string, sizeMb: string, date: string}[]>([]);
    const [isRestoringAuto, setIsRestoringAuto] = useState<string | null>(null);
    const [isDeletingAuto, setIsDeletingAuto] = useState<string | null>(null);
    const [isTriggering, setIsTriggering] = useState(false);
    const [autoBackupMsg, setAutoBackupMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch("/api/settings");
                if (res.ok) {
                    const data = await res.json();
                    setDiscordEnabled(data.discordAlertsEnabled || false);
                    setDiscordUrl(data.discordWebhookUrl || "");
                    setDiscordAlertCondition(data.discordAlertCondition || "ALL");
                    setExcludedLibraries((data.excludedLibraries || []).join(", "));
                    setMonitorActive(data.monitorIntervalActive ?? 1000);
                    setMonitorIdle(data.monitorIntervalIdle ?? 5000);
                }
            } catch (err) {
                console.error("Failed to load settings");
            }
        };
        fetchSettings();
    }, []);

    useEffect(() => {
        const fetchAutoBackups = async () => {
            try {
                const res = await fetch("/api/backup/auto");
                if (res.ok) {
                    const data = await res.json();
                    setAutoBackups(data.backups || []);
                }
            } catch (err) {
                console.error("Failed to load auto-backups");
            }
        };
        fetchAutoBackups();
    }, []);

    const handleSaveSettings = async () => {
        setIsSavingSettings(true);
        setSettingsMsg(null);
        try {
            const res = await fetch("/api/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    discordWebhookUrl: discordUrl,
                    discordAlertCondition: discordAlertCondition,
                    discordAlertsEnabled: discordEnabled,
                    excludedLibraries: excludedLibraries.split(',').map(s => s.trim()).filter(s => s)
                })
            });
            if (res.ok) {
                setSettingsMsg({ type: "success", text: "Paramètres enregistrés avec succès." });
            } else {
                setSettingsMsg({ type: "error", text: "Erreur lors de la sauvegarde." });
            }
        } catch (error) {
            setSettingsMsg({ type: "error", text: "Erreur réseau." });
        } finally {
            setIsSavingSettings(false);
        }
    };

    const handleSaveMonitor = async () => {
        setIsSavingMonitor(true);
        setMonitorMsg(null);
        try {
            const res = await fetch("/api/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    monitorIntervalActive: monitorActive,
                    monitorIntervalIdle: monitorIdle,
                })
            });
            if (res.ok) {
                setMonitorMsg({ type: "success", text: "Intervalles mis à jour en temps réel." });
            } else {
                setMonitorMsg({ type: "error", text: "Erreur lors de la sauvegarde." });
            }
        } catch {
            setMonitorMsg({ type: "error", text: "Erreur réseau." });
        } finally {
            setIsSavingMonitor(false);
        }
    };

    const runTask = async (taskKey: string, url: string, body?: object) => {
        setTaskStatus(prev => ({ ...prev, [taskKey]: { loading: true, msg: null } }));
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: body ? { "Content-Type": "application/json" } : undefined,
                body: body ? JSON.stringify(body) : undefined,
            });
            const data = await res.json();
            if (res.ok) {
                setTaskStatus(prev => ({ ...prev, [taskKey]: { loading: false, msg: { type: "success", text: data.message || "Terminé." } } }));
                // Refresh backup list after backup task
                if (taskKey === 'backup') {
                    const listRes = await fetch("/api/backup/auto");
                    if (listRes.ok) { const listData = await listRes.json(); setAutoBackups(listData.backups || []); }
                }
            } else {
                setTaskStatus(prev => ({ ...prev, [taskKey]: { loading: false, msg: { type: "error", text: data.error || data.message || "Erreur." } } }));
            }
        } catch {
            setTaskStatus(prev => ({ ...prev, [taskKey]: { loading: false, msg: { type: "error", text: "Erreur réseau." } } }));
        }
    };

    const handleExportBackup = () => {
        window.location.href = "/api/backup/export";
    };

    const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setIsRestoring(true);
        setBackupMsg(null);
        try {
            const fileReader = new FileReader();
            fileReader.onload = async (e) => {
                const text = e.target?.result;
                if (typeof text !== 'string') return;
                try {
                    const parsedJson = JSON.parse(text);
                    const res = await fetch("/api/backup/import", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(parsedJson)
                    });
                    const data = await res.json();
                    if (res.ok) {
                        setBackupMsg({ type: "success", text: "Restauration terminée avec succès ! La page va redémarrer dans 3 secondes..." });
                        setTimeout(() => window.location.reload(), 3000);
                    } else {
                        setBackupMsg({ type: "error", text: data.error || "Le fichier de sauvegarde est invalide ou corrompu." });
                        setIsRestoring(false);
                    }
                } catch (err) {
                    setBackupMsg({ type: "error", text: "Erreur lors de l'analyse du fichier JSON." });
                    setIsRestoring(false);
                }
            };
            fileReader.readAsText(file);
        } catch (error) {
            setBackupMsg({ type: "error", text: "Impossible de lire le fichier." });
            setIsRestoring(false);
        }
        if (fileInputRef.current) { fileInputRef.current.value = ""; }
    };

    return (
        <div className="flex-col md:flex">
            <div className="flex-1 space-y-6 p-8 pt-6 max-w-4xl mx-auto w-full">
                <div className="flex items-center justify-between space-y-2 mb-6">
                    <h2 className="text-3xl font-bold tracking-tight">Configuration</h2>
                </div>

                {/* ACTIVITY MONITORING CARD */}
                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5" /> Surveillance d&apos;activité</CardTitle>
                        <CardDescription>
                            Configurez la fréquence de vérification des sessions Jellyfin. Les modifications sont appliquées en temps réel sans redémarrage du serveur.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {monitorMsg && (
                            <div className={`p-4 rounded-md flex items-center gap-3 text-sm ${monitorMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                {monitorMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                {monitorMsg.text}
                            </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="monitor-active">Intervalle avec sessions actives (ms)</Label>
                                <Input
                                    id="monitor-active"
                                    type="number"
                                    min={500}
                                    max={30000}
                                    value={monitorActive}
                                    onChange={(e) => setMonitorActive(parseInt(e.target.value) || 1000)}
                                    className="font-mono text-sm"
                                />
                                <p className="text-xs text-muted-foreground">Fréquence de vérification quand des utilisateurs regardent du contenu (recommandé: 1000ms)</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="monitor-idle">Intervalle en veille (ms)</Label>
                                <Input
                                    id="monitor-idle"
                                    type="number"
                                    min={1000}
                                    max={60000}
                                    value={monitorIdle}
                                    onChange={(e) => setMonitorIdle(parseInt(e.target.value) || 5000)}
                                    className="font-mono text-sm"
                                />
                                <p className="text-xs text-muted-foreground">Fréquence de vérification quand aucune session active (recommandé: 5000ms)</p>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <button onClick={handleSaveMonitor} disabled={isSavingMonitor} className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors ${isSavingMonitor ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>
                            <Save className={`w-4 h-4 ${isSavingMonitor ? 'animate-pulse' : ''}`} />
                            {isSavingMonitor ? 'Enregistrement...' : 'Appliquer'}
                        </button>
                    </CardFooter>
                </Card>

                {/* TASK SCHEDULER CARD */}
                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Zap className="w-5 h-5" /> Planificateur de tâches</CardTitle>
                        <CardDescription>
                            Lancez manuellement les tâches de maintenance ou attendez leur exécution automatique programmée.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {/* Task 1: Recent Sync */}
                        <div className="flex items-center justify-between p-4 border border-zinc-800/50 rounded-lg bg-black/20">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <RefreshCw className="w-4 h-4 text-sky-400 shrink-0" />
                                    <span className="font-medium text-sm">Synchronisation du contenu récent</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 ml-6">Synchronise les médias ajoutés dans les 7 derniers jours.</p>
                                {taskStatus.recentSync.msg && (
                                    <div className={`mt-2 ml-6 text-xs ${taskStatus.recentSync.msg.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {taskStatus.recentSync.msg.text}
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => runTask('recentSync', '/api/sync', { mode: 'recent' })}
                                disabled={taskStatus.recentSync.loading}
                                className={`ml-3 shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${taskStatus.recentSync.loading ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-sky-600 text-white hover:bg-sky-500'}`}
                            >
                                <Play className={`w-3 h-3 ${taskStatus.recentSync.loading ? 'animate-spin' : ''}`} />
                                {taskStatus.recentSync.loading ? 'En cours...' : 'Lancer'}
                            </button>
                        </div>

                        {/* Task 2: Full Sync */}
                        <div className="flex items-center justify-between p-4 border border-zinc-800/50 rounded-lg bg-black/20">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <Database className="w-4 h-4 text-violet-400 shrink-0" />
                                    <span className="font-medium text-sm">Synchronisation complète avec Jellyfin</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 ml-6">Synchronise tous les utilisateurs et médias. Automatique chaque nuit à 3h00.</p>
                                {taskStatus.fullSync.msg && (
                                    <div className={`mt-2 ml-6 text-xs ${taskStatus.fullSync.msg.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {taskStatus.fullSync.msg.text}
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => runTask('fullSync', '/api/sync', { mode: 'full' })}
                                disabled={taskStatus.fullSync.loading}
                                className={`ml-3 shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${taskStatus.fullSync.loading ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-violet-600 text-white hover:bg-violet-500'}`}
                            >
                                <Play className={`w-3 h-3 ${taskStatus.fullSync.loading ? 'animate-spin' : ''}`} />
                                {taskStatus.fullSync.loading ? 'En cours...' : 'Lancer'}
                            </button>
                        </div>

                        {/* Task 3: Backup */}
                        <div className="flex items-center justify-between p-4 border border-zinc-800/50 rounded-lg bg-black/20">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <Save className="w-4 h-4 text-amber-400 shrink-0" />
                                    <span className="font-medium text-sm">Sauvegarde de JellyTulli</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 ml-6">Sauvegarde complète de la base de données. Automatique chaque nuit à 3h30.</p>
                                {taskStatus.backup.msg && (
                                    <div className={`mt-2 ml-6 text-xs ${taskStatus.backup.msg.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {taskStatus.backup.msg.text}
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => runTask('backup', '/api/backup/auto/trigger')}
                                disabled={taskStatus.backup.loading}
                                className={`ml-3 shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${taskStatus.backup.loading ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-amber-600 text-white hover:bg-amber-500'}`}
                            >
                                <Play className={`w-3 h-3 ${taskStatus.backup.loading ? 'animate-spin' : ''}`} />
                                {taskStatus.backup.loading ? 'En cours...' : 'Lancer'}
                            </button>
                        </div>
                    </CardContent>
                </Card>

                {/* DISCORD SETTINGS CARD */}
                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm mt-6">
                    <CardHeader>
                        <CardTitle>Notifications & Alertes Extérieures</CardTitle>
                        <CardDescription>
                            Gérez les alertes externes (Discord, Slack via webhook) lors du lancement d'une nouvelle session de lecture sur votre serveur.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {settingsMsg && (
                            <div className={`p-4 rounded-md flex items-center gap-3 text-sm ${settingsMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                {settingsMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                {settingsMsg.text}
                            </div>
                        )}
                        <div className="flex items-center justify-between space-x-2 border p-4 rounded-lg">
                            <div className="space-y-0.5 mt-0.5">
                                <Label htmlFor="discord-alerts" className="text-base">Activer les notifications Discord</Label>
                                <p className="text-sm text-muted-foreground">Envoie un message visuel sur ton serveur Discord à chaque nouvelle lecture.</p>
                            </div>
                            <Switch id="discord-alerts" checked={discordEnabled} onCheckedChange={setDiscordEnabled} />
                        </div>
                        {discordEnabled && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="space-y-2">
                                    <Label htmlFor="discord-url">URL du Webhook Discord</Label>
                                    <Input id="discord-url" type="url" placeholder="https://discord.com/api/webhooks/..." value={discordUrl} onChange={(e) => setDiscordUrl(e.target.value)} className="font-mono text-sm" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="discord-condition">Conditions de notification</Label>
                                    <select id="discord-condition" value={discordAlertCondition} onChange={(e) => setDiscordAlertCondition(e.target.value)} className="flex h-9 w-full rounded-md border border-zinc-700 bg-zinc-900/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                                        <option value="ALL">Toutes les lectures</option>
                                        <option value="TRANSCODE_ONLY">Uniquement les transcodages</option>
                                        <option value="NEW_IP_ONLY">Uniquement les nouvelles adresses IP</option>
                                    </select>
                                </div>
                            </div>
                        )}
                        <div className="border-t border-zinc-800/50 pt-6 mt-6">
                            <Label htmlFor="excluded-libraries" className="text-base">Filtrage des collections</Label>
                            <p className="text-sm text-muted-foreground mb-4">Exclus certains types de médias (ex: Photo, HomeVideos) des statistiques. Séparé par des virgules.</p>
                            <Input id="excluded-libraries" placeholder="Photo, HomeVideos" value={excludedLibraries} onChange={(e) => setExcludedLibraries(e.target.value)} className="font-mono text-sm" />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <button onClick={handleSaveSettings} disabled={isSavingSettings} className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors ${isSavingSettings ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>
                            <Save className={`w-4 h-4 ${isSavingSettings ? 'animate-pulse' : ''}`} />
                            {isSavingSettings ? 'Enregistrement...' : 'Enregistrer les paramètres'}
                        </button>
                    </CardFooter>
                </Card>

                {/* BACKUP & RESTORE CARD */}
                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm mt-6">
                    <CardHeader>
                        <CardTitle>Données & Sauvegardes</CardTitle>
                        <CardDescription>Exportez l'ensemble de votre base de données, ou restaurez une configuration précédente.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {backupMsg && (
                            <div className={`p-4 rounded-md flex items-center gap-3 text-sm ${backupMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                {backupMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                {backupMsg.text}
                            </div>
                        )}
                        <input type="file" accept=".json" ref={fileInputRef} className="hidden" onChange={handleImportBackup} />
                    </CardContent>
                    <CardFooter className="flex flex-col sm:flex-row gap-4">
                        <button onClick={handleExportBackup} className="flex-1 flex justify-center items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors border border-zinc-700 hover:bg-zinc-800">
                            <Download className="w-4 h-4" /> Exporter la sauvegarde
                        </button>
                        <button onClick={() => fileInputRef.current?.click()} disabled={isRestoring} className={`flex-1 flex justify-center items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors ${isRestoring ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>
                            <UploadCloud className={`w-4 h-4 ${isRestoring ? 'animate-bounce' : ''}`} />
                            {isRestoring ? 'Restauration en cours...' : 'Importer une sauvegarde'}
                        </button>
                    </CardFooter>
                </Card>

                {/* AUTO-BACKUPS CARD */}
                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm mt-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5" /> Gestion des Sauvegardes</CardTitle>
                        <CardDescription>
                            JellyTulli effectue une sauvegarde automatique chaque nuit à 3h30. Les 5 plus récentes sont conservées.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {autoBackupMsg && (
                            <div className={`p-4 rounded-md flex items-center gap-3 text-sm ${autoBackupMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                {autoBackupMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                {autoBackupMsg.text}
                            </div>
                        )}
                        <button
                            onClick={async () => {
                                setIsTriggering(true); setAutoBackupMsg(null);
                                try {
                                    const res = await fetch("/api/backup/auto/trigger", { method: "POST" });
                                    const data = await res.json();
                                    if (res.ok) {
                                        setAutoBackupMsg({ type: "success", text: data.message || "Sauvegarde créée." });
                                        const listRes = await fetch("/api/backup/auto"); if (listRes.ok) { const listData = await listRes.json(); setAutoBackups(listData.backups || []); }
                                    } else { setAutoBackupMsg({ type: "error", text: data.error || "Erreur." }); }
                                } catch { setAutoBackupMsg({ type: "error", text: "Erreur réseau." }); }
                                finally { setIsTriggering(false); }
                            }}
                            disabled={isTriggering}
                            className={`w-full flex justify-center items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors ${isTriggering ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
                        >
                            <Save className={`w-4 h-4 ${isTriggering ? 'animate-pulse' : ''}`} />
                            {isTriggering ? 'Sauvegarde en cours...' : 'Sauvegarder maintenant'}
                        </button>
                        {autoBackups.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                                <Clock className="w-8 h-8 mx-auto mb-3 opacity-50" />
                                <p>Aucune sauvegarde automatique disponible.</p>
                                <p className="text-xs mt-1">La première sera créée cette nuit à 3h30.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {autoBackups.map((backup) => (
                                    <div key={backup.name} className="flex items-center justify-between p-3 border border-zinc-800/50 rounded-lg bg-black/20 hover:bg-zinc-800/30 transition-colors">
                                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                            <span className="text-sm font-medium truncate">{backup.name}</span>
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                <span>{new Date(backup.date).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                <span>{backup.sizeMb} Mo</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 ml-3 shrink-0">
                                            <button
                                                onClick={async () => {
                                                    if (!confirm(`Restaurer la sauvegarde ${backup.name} ?`)) return;
                                                    setIsRestoringAuto(backup.name); setAutoBackupMsg(null);
                                                    try {
                                                        const res = await fetch("/api/backup/auto/restore", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: backup.name }) });
                                                        const data = await res.json();
                                                        if (res.ok) { setAutoBackupMsg({ type: "success", text: "Restauration réussie ! Rechargement..." }); setTimeout(() => window.location.reload(), 3000); }
                                                        else { setAutoBackupMsg({ type: "error", text: data.error || "Erreur." }); }
                                                    } catch { setAutoBackupMsg({ type: "error", text: "Erreur réseau." }); }
                                                    finally { setIsRestoringAuto(null); }
                                                }}
                                                disabled={isRestoringAuto !== null || isDeletingAuto !== null}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${isRestoringAuto === backup.name ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
                                            >
                                                <UploadCloud className={`w-3 h-3 ${isRestoringAuto === backup.name ? 'animate-bounce' : ''}`} />
                                                {isRestoringAuto === backup.name ? 'Restauration...' : 'Restaurer'}
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    if (!confirm(`Supprimer la sauvegarde ${backup.name} ?`)) return;
                                                    setIsDeletingAuto(backup.name); setAutoBackupMsg(null);
                                                    try {
                                                        const res = await fetch("/api/backup/auto/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: backup.name }) });
                                                        const data = await res.json();
                                                        if (res.ok) { setAutoBackupMsg({ type: "success", text: "Supprimée." }); setAutoBackups(prev => prev.filter(b => b.name !== backup.name)); }
                                                        else { setAutoBackupMsg({ type: "error", text: data.error || "Erreur." }); }
                                                    } catch { setAutoBackupMsg({ type: "error", text: "Erreur réseau." }); }
                                                    finally { setIsDeletingAuto(null); }
                                                }}
                                                disabled={isRestoringAuto !== null || isDeletingAuto !== null}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${isDeletingAuto === backup.name ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'border border-red-500/30 text-red-400 hover:bg-red-500/10'}`}
                                            >
                                                <Trash2 className={`w-3 h-3 ${isDeletingAuto === backup.name ? 'animate-pulse' : ''}`} />
                                                {isDeletingAuto === backup.name ? '...' : 'Supprimer'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
