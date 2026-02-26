"use client";

import { useState } from "react";
import { Settings as SettingsIcon, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";

export default function SettingsPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

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

    return (
        <div className="flex-col md:flex">
            <div className="border-b">
                <div className="flex h-16 items-center px-4">
                    <h1 className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
                        <SettingsIcon className="w-6 h-6" /> Paramètres
                    </h1>
                </div>
            </div>

            <div className="flex-1 space-y-4 p-8 pt-6 max-w-4xl mx-auto w-full">
                <div className="flex items-center justify-between space-y-2 mb-6">
                    <h2 className="text-3xl font-bold tracking-tight">Configuration</h2>
                </div>

                <Card>
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
            </div>
        </div>
    );
}
