"use client";

import { useState, useEffect } from "react";
import { Settings as SettingsIcon, RefreshCw, CheckCircle2, AlertCircle, Save } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [isSavingDiscord, setIsSavingDiscord] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [discordMsg, setDiscordMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const [discordEnabled, setDiscordEnabled] = useState(false);
    const [discordUrl, setDiscordUrl] = useState("");

    // Load initial settings
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch("/api/settings");
                if (res.ok) {
                    const data = await res.json();
                    setDiscordEnabled(data.discordAlertsEnabled || false);
                    setDiscordUrl(data.discordWebhookUrl || "");
                }
            } catch (err) {
                console.error("Failed to load settings");
            }
        };
        fetchSettings();
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

    const handleSaveDiscord = async () => {
        setIsSavingDiscord(true);
        setDiscordMsg(null);

        try {
            const res = await fetch("/api/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    discordWebhookUrl: discordUrl,
                    discordAlertsEnabled: discordEnabled
                })
            });

            if (res.ok) {
                setDiscordMsg({ type: "success", text: "Paramètres enregistrés avec succès." });
            } else {
                setDiscordMsg({ type: "error", text: "Erreur lors de la sauvegarde." });
            }
        } catch (error) {
            setDiscordMsg({ type: "error", text: "Erreur réseau." });
        } finally {
            setIsSavingDiscord(false);
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
                        {discordMsg && (
                            <div className={`p-4 rounded-md flex items-center gap-3 text-sm ${discordMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
                                }`}>
                                {discordMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                {discordMsg.text}
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
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
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
                        )}
                    </CardContent>
                    <CardFooter>
                        <button
                            onClick={handleSaveDiscord}
                            disabled={isSavingDiscord}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors
                                ${isSavingDiscord
                                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                }`}
                        >
                            <Save className={`w-4 h-4 ${isSavingDiscord ? 'animate-pulse' : ''}`} />
                            {isSavingDiscord ? 'Enregistrement...' : 'Enregistrer les paramètres'}
                        </button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
