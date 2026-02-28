"use client";

import { useState, useEffect, useRef } from "react";
import { Settings as SettingsIcon, RefreshCw, CheckCircle2, AlertCircle, Save, Download, UploadCloud, Clock, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [isImportingJellystat, setIsImportingJellystat] = useState(false);
    const [isImportingPR, setIsImportingPR] = useState(false);

    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [settingsMsg, setSettingsMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [backupMsg, setBackupMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [migrationMsg, setMigrationMsg] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);

    const [jellystatUrl, setJellystatUrl] = useState("");
    const [jellystatApiKey, setJellystatApiKey] = useState("");

    const fileInputRef = useRef<HTMLInputElement>(null);
    const prFileInputRef = useRef<HTMLInputElement>(null);
    const jellystatFileInputRef = useRef<HTMLInputElement>(null);

    const [discordEnabled, setDiscordEnabled] = useState(false);
    const [discordUrl, setDiscordUrl] = useState("");
    const [discordAlertCondition, setDiscordAlertCondition] = useState("ALL");
    const [excludedLibraries, setExcludedLibraries] = useState("");

    // Auto-backup state
    const [autoBackups, setAutoBackups] = useState<{name: string, sizeMb: string, date: string}[]>([]);
    const [isRestoringAuto, setIsRestoringAuto] = useState<string | null>(null);
    const [autoBackupMsg, setAutoBackupMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    // Upload progress state
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);

    // Load initial settings
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
                }
            } catch (err) {
                console.error("Failed to load settings");
            }
        };
        fetchSettings();
    }, []);

    // Load auto-backups list
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

    const handleSync = async () => {
        setIsLoading(true);
        setMessage(null);

        try {
            const res = await fetch("/api/sync", { method: "POST" });
            const data = await res.json();

            if (res.ok) {
                setMessage({ type: "success", text: data.message });
            } else {
                setMessage({ type: "error", text: data.message || "Une erreur est survenue." });
            }
        } catch (error) {
            setMessage({ type: "error", text: "Erreur réseau lors de la synchronisation." });
        } finally {
            setIsLoading(false);
        }
    };

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

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleImportJellystat = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImportingJellystat(true);
        const sizeMb = (file.size / 1024 / 1024).toFixed(0);
        setMigrationMsg({ type: "info", text: `Découpage et envoi du fichier JSON Jellystat (${sizeMb} Mo)...` });
        setUploadProgress(0);

        try {
            // Client-side chunking: split file into 5MB chunks
            const CHUNK_SIZE = 5 * 1024 * 1024; // 5 Mo
            const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
            const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

            // Send each chunk sequentially
            for (let i = 0; i < totalChunks; i++) {
                const start = i * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);
                const chunk = file.slice(start, end);

                const res = await fetch("/api/backup/import/jellystat/chunk", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/octet-stream",
                        "X-Upload-Id": uploadId,
                        "X-Chunk-Index": String(i),
                        "X-Total-Chunks": String(totalChunks),
                        "X-File-Name": file.name,
                    },
                    body: chunk,
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || `Chunk ${i + 1} failed`);
                }

                const pct = Math.round(((i + 1) / totalChunks) * 50); // 0-50% for upload
                setUploadProgress(pct);
                setMigrationMsg({ type: "info", text: `Upload: ${i + 1}/${totalChunks} chunks envoyés (${pct}%)...` });
            }

            // Finalize: tell server to merge and process
            setMigrationMsg({ type: "info", text: "Fusion et analyse du fichier sur le serveur..." });
            setUploadProgress(55);

            const finalRes = await fetch("/api/backup/import/jellystat/finalize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ uploadId, totalChunks, fileName: file.name }),
            });

            const data = await finalRes.json();
            setUploadProgress(100);

            if (finalRes.ok) {
                setMigrationMsg({ type: "success", text: data.message || "Importation depuis Jellystat réussie." });
            } else {
                setMigrationMsg({ type: "error", text: data.error || "Erreur lors de l'import Jellystat." });
            }
        } catch (e: any) {
            setMigrationMsg({ type: "error", text: e.message || "Erreur réseau lors de la communication du fichier." });
        } finally {
            setIsImportingJellystat(false);
            setUploadProgress(null);
            if (jellystatFileInputRef.current) {
                jellystatFileInputRef.current.value = "";
            }
        }
    };

    const handleImportPR = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImportingPR(true);
        setMigrationMsg({ type: "info", text: "Envoi et analyse du fichier TSV Playback Reporting..." });

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/backup/import/playback-reporting", {
                method: "POST",
                body: formData
            });

            const data = await res.json();
            if (res.ok) {
                setMigrationMsg({ type: "success", text: data.message || "Importation Playback Reporting réussie." });
            } else {
                setMigrationMsg({ type: "error", text: data.error || "Erreur lors de l'import." });
            }
        } catch {
            setMigrationMsg({ type: "error", text: "Erreur réseau lors de la communication du fichier." });
        } finally {
            setIsImportingPR(false);
            if (prFileInputRef.current) {
                prFileInputRef.current.value = "";
            }
        }
    };

    return (
        <div className="flex-col md:flex">
            <div className="flex-1 space-y-6 p-8 pt-6 max-w-4xl mx-auto w-full">
                <div className="flex items-center justify-between space-y-2 mb-6">
                    <h2 className="text-3xl font-bold tracking-tight">Configuration</h2>
                </div>

                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle>Synchronisation Jellyfin</CardTitle>
                        <CardDescription>
                            Forcez la mise à jour immédiate de votre base de données locale (Séries, Films, Utilisateurs) avec votre instance Jellyfin.
                            Une tâche de fond tourne déjà automatiquement chaque nuit à 3h00 du matin.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {message && (
                            <div className={`p-4 rounded-md flex items-center gap-3 text-sm ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
                                }`}>
                                {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                {message.text}
                            </div>
                        )}
                        <p className="text-sm text-muted-foreground">
                            Attention: Selon la taille de votre bibliothèque, cette opération peut prendre quelques secondes.
                        </p>
                    </CardContent>
                    <CardFooter>
                        <button
                            onClick={handleSync}
                            disabled={isLoading}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors
                                ${isLoading
                                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                }`}
                        >
                            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                            {isLoading ? 'Synchronisation en cours...' : 'Forcer la synchronisation manuelle'}
                        </button>
                    </CardFooter>
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
                            <div className={`p-4 rounded-md flex items-center gap-3 text-sm ${settingsMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
                                }`}>
                                {settingsMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                {settingsMsg.text}
                            </div>
                        )}

                        <div className="flex items-center justify-between space-x-2 border p-4 rounded-lg">
                            <div className="space-y-0.5 mt-0.5">
                                <Label htmlFor="discord-alerts" className="text-base">
                                    Activer les notifications Discord
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                    Envoie un beau message visuel sur ton serveur Discord à chaque fois qu'un utilisateur lance un média.
                                </p>
                            </div>
                            <Switch
                                id="discord-alerts"
                                checked={discordEnabled}
                                onCheckedChange={setDiscordEnabled}
                            />
                        </div>

                        {discordEnabled && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="space-y-2">
                                    <Label htmlFor="discord-url">URL du Webhook Discord</Label>
                                    <Input
                                        id="discord-url"
                                        type="url"
                                        placeholder="https://discord.com/api/webhooks/..."
                                        value={discordUrl}
                                        onChange={(e) => setDiscordUrl(e.target.value)}
                                        className="font-mono text-sm"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Assurez-vous que l'URL soit valide et fonctionnelle. Vous pouvez écraser la variable d'environnement avec ce champ.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="discord-condition">Conditions de notification</Label>
                                    <select
                                        id="discord-condition"
                                        value={discordAlertCondition}
                                        onChange={(e) => setDiscordAlertCondition(e.target.value)}
                                        className="flex h-9 w-full rounded-md border border-zinc-700 bg-zinc-900/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    >
                                        <option value="ALL">Toutes les lectures</option>
                                        <option value="TRANSCODE_ONLY">Uniquement les transcodages</option>
                                        <option value="NEW_IP_ONLY">Uniquement les nouvelles adresses IP</option>
                                    </select>
                                    <p className="text-xs text-muted-foreground">
                                        Filtrez le type d'événements qui déclencheront le webhook.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="border-t border-zinc-800/50 pt-6 mt-6">
                            <Label htmlFor="excluded-libraries" className="text-base">Filtrage des collections</Label>
                            <p className="text-sm text-muted-foreground mb-4">
                                Exclus certains types de médias (ex: Photo, HomeVideos) des statistiques globales du Dashboard. Séparé par des virgules.
                            </p>
                            <Input
                                id="excluded-libraries"
                                placeholder="Photo, HomeVideos"
                                value={excludedLibraries}
                                onChange={(e) => setExcludedLibraries(e.target.value)}
                                className="font-mono text-sm"
                            />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <button
                            onClick={handleSaveSettings}
                            disabled={isSavingSettings}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors
                                ${isSavingSettings
                                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                }`}
                        >
                            <Save className={`w-4 h-4 ${isSavingSettings ? 'animate-pulse' : ''}`} />
                            {isSavingSettings ? 'Enregistrement...' : 'Enregistrer les paramètres'}
                        </button>
                    </CardFooter>
                </Card>

                {/* BACKUP & RESTORE CARD */}
                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm mt-6">
                    <CardHeader>
                        <CardTitle>Données & Sauvegardes</CardTitle>
                        <CardDescription>
                            Exportez l'ensemble de votre base de données et de vos statistiques, ou restaurez une configuration précédente sans aucune perte.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {backupMsg && (
                            <div className={`p-4 rounded-md flex items-center gap-3 text-sm ${backupMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                {backupMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                {backupMsg.text}
                            </div>
                        )}
                        <input
                            type="file"
                            accept=".json"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleImportBackup}
                        />
                    </CardContent>
                    <CardFooter className="flex flex-col sm:flex-row gap-4">
                        <button
                            onClick={handleExportBackup}
                            className="flex-1 flex justify-center items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors border border-zinc-700 hover:bg-zinc-800"
                        >
                            <Download className="w-4 h-4" />
                            Exporter la sauvegarde
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isRestoring}
                            className={`flex-1 flex justify-center items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors ${isRestoring ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                }`}
                        >
                            <UploadCloud className={`w-4 h-4 ${isRestoring ? 'animate-bounce' : ''}`} />
                            {isRestoring ? 'Restauration en cours...' : 'Importer une sauvegarde'}
                        </button>
                    </CardFooter>
                </Card>

                {/* EXTERNAL MIGRATIONS CARD */}
                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm mt-6">
                    <CardHeader>
                        <CardTitle>Migrations Externes (Mode API)</CardTitle>
                        <CardDescription>
                            Importez votre historique complet sans saturer le serveur via ces connexions directes aux API d'autres plugins.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {migrationMsg && (
                            <div className={`p-4 rounded-md flex items-center gap-3 text-sm ${migrationMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                                migrationMsg.type === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                                    'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                                }`}>
                                {migrationMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> :
                                    migrationMsg.type === 'error' ? <AlertCircle className="w-5 h-5" /> :
                                        <RefreshCw className="w-5 h-5 animate-spin" />}
                                {migrationMsg.text}
                            </div>
                        )}

                        <div className="space-y-4 border p-4 rounded-lg bg-black/20">
                            <h4 className="text-sm font-semibold opacity-90">1. Depuis Jellystat</h4>
                            <p className="text-xs text-muted-foreground">Importez le fichier JSON d'export généré par Jellystat.</p>

                            <input
                                type="file"
                                accept=".json"
                                ref={jellystatFileInputRef}
                                className="hidden"
                                onChange={handleImportJellystat}
                            />
                            <button
                                onClick={() => jellystatFileInputRef.current?.click()}
                                disabled={isImportingJellystat || isImportingPR}
                                className={`w-full flex justify-center items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors ${isImportingJellystat ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                    }`}
                            >
                                <UploadCloud className={`w-4 h-4 ${isImportingJellystat ? 'animate-bounce' : ''}`} />
                                {isImportingJellystat ? 'Analyse du fichier JSON en cours...' : 'Uploader le JSON Jellystat'}
                            </button>
                            {uploadProgress !== null && (
                                <div className="w-full bg-zinc-800 rounded-full h-2 mt-2">
                                    <div
                                        className="bg-primary h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="space-y-4 border p-4 rounded-lg bg-black/20">
                            <h4 className="text-sm font-semibold opacity-90">2. Depuis Playback Reporting</h4>
                            <p className="text-xs text-muted-foreground">Importez le fichier TSV d'export généré par le plugin officiel Playback Reporting de Jellyfin.</p>

                            <input
                                type="file"
                                accept=".csv,.tsv"
                                ref={prFileInputRef}
                                className="hidden"
                                onChange={handleImportPR}
                            />
                            <button
                                onClick={() => prFileInputRef.current?.click()}
                                disabled={isImportingPR || isImportingJellystat}
                                className={`w-full flex justify-center items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors ${isImportingPR ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                    }`}
                            >
                                <UploadCloud className={`w-4 h-4 ${isImportingPR ? 'animate-bounce' : ''}`} />
                                {isImportingPR ? 'Analyse du fichier TSV en cours...' : 'Uploader le TSV Playback Reporting'}
                            </button>
                        </div>
                    </CardContent>
                </Card>

                {/* AUTO-BACKUPS CARD */}
                <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-sm mt-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="w-5 h-5" />
                            Sauvegardes Automatiques
                        </CardTitle>
                        <CardDescription>
                            JellyTulli effectue une sauvegarde automatique chaque nuit à 3h30. Les 5 sauvegardes les plus récentes sont conservées (rotation automatique).
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {autoBackupMsg && (
                            <div className={`p-4 rounded-md flex items-center gap-3 text-sm ${autoBackupMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                {autoBackupMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                {autoBackupMsg.text}
                            </div>
                        )}

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
                                        <button
                                            onClick={async () => {
                                                if (!confirm(`Restaurer la sauvegarde ${backup.name} ? Cela écrasera toutes les données actuelles.`)) return;
                                                setIsRestoringAuto(backup.name);
                                                setAutoBackupMsg(null);
                                                try {
                                                    const res = await fetch("/api/backup/auto/restore", {
                                                        method: "POST",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify({ fileName: backup.name }),
                                                    });
                                                    const data = await res.json();
                                                    if (res.ok) {
                                                        setAutoBackupMsg({ type: "success", text: data.message || "Restauration réussie ! Rechargement..." });
                                                        setTimeout(() => window.location.reload(), 3000);
                                                    } else {
                                                        setAutoBackupMsg({ type: "error", text: data.error || "Erreur lors de la restauration." });
                                                    }
                                                } catch {
                                                    setAutoBackupMsg({ type: "error", text: "Erreur réseau." });
                                                } finally {
                                                    setIsRestoringAuto(null);
                                                }
                                            }}
                                            disabled={isRestoringAuto !== null}
                                            className={`ml-3 shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                                isRestoringAuto === backup.name
                                                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                            }`}
                                        >
                                            <UploadCloud className={`w-3 h-3 ${isRestoringAuto === backup.name ? 'animate-bounce' : ''}`} />
                                            {isRestoringAuto === backup.name ? 'Restauration...' : 'Restaurer'}
                                        </button>
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
