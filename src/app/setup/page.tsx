"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Server, KeyRound, AlertCircle, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SetupPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [jellyfinUrl, setJellyfinUrl] = useState("");
    const [jellyfinApiKey, setJellyfinApiKey] = useState("");
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleSetup = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        try {
            const res = await fetch("/api/setup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jellyfinUrl, jellyfinApiKey })
            });

            const data = await res.json();

            if (res.ok) {
                setMessage({ type: "success", text: "Configuration réussie ! Redirection..." });
                setTimeout(() => {
                    router.push("/login");
                }, 2000);
            } else {
                setMessage({ type: "error", text: data.error || "La connexion au serveur Jellyfin a échoué." });
            }
        } catch (error) {
            setMessage({ type: "error", text: "Erreur réseau. Impossible de contacter l'API." });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 selection:bg-indigo-500/30">
            <div className="absolute inset-0 z-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900 via-black to-black" />

            <Card className="w-full max-w-lg z-10 bg-zinc-900/80 border-zinc-800/50 backdrop-blur-xl shadow-2xl">
                <CardHeader className="space-y-3 pb-6 border-b border-zinc-800/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-500/20 rounded-xl">
                            <Server className="w-6 h-6 text-indigo-400" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-bold tracking-tight text-white">Création du Serveur</CardTitle>
                            <CardDescription className="text-zinc-400 mt-1 text-sm font-medium">JellyTulli Analytics Dashboard</CardDescription>
                        </div>
                    </div>
                </CardHeader>

                <form onSubmit={handleSetup}>
                    <CardContent className="space-y-6 pt-6">
                        {message && (
                            <div className={`p-4 rounded-lg flex items-start gap-3 text-sm border ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                                <p className="leading-5">{message.text}</p>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="url" className="text-zinc-300 font-medium">URL de votre serveur Jellyfin</Label>
                            <div className="relative">
                                <Server className="absolute left-3 top-3 h-5 w-5 text-zinc-500" />
                                <Input
                                    id="url"
                                    type="url"
                                    required
                                    placeholder="http://192.168.1.10:8096"
                                    className="pl-10 bg-black/50 border-zinc-700 text-white focus-visible:ring-indigo-500 placeholder:text-zinc-600 h-11"
                                    value={jellyfinUrl}
                                    onChange={(e) => setJellyfinUrl(e.target.value)}
                                />
                            </div>
                            <p className="text-xs text-zinc-500 pl-1">Exemple: http://localhost:8096 ou https://jellyfin.mondomaine.com</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="apikey" className="text-zinc-300 font-medium">Clé d'API (Administrateur)</Label>
                            <div className="relative">
                                <KeyRound className="absolute left-3 top-3 h-5 w-5 text-zinc-500" />
                                <Input
                                    id="apikey"
                                    type="password"
                                    required
                                    placeholder="xxxx-xxxx-xxxx-xxxx"
                                    className="pl-10 bg-black/50 border-zinc-700 text-white focus-visible:ring-indigo-500 placeholder:text-zinc-600 h-11 font-mono"
                                    value={jellyfinApiKey}
                                    onChange={(e) => setJellyfinApiKey(e.target.value)}
                                />
                            </div>
                            <p className="text-xs text-zinc-500 pl-1">Générée depuis Jellyfin Dashboard {">"} Tableau de bord {">"} Avancé {">"} Clés d'API</p>
                        </div>
                    </CardContent>

                    <CardFooter className="pt-2 pb-6">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full flex items-center justify-center gap-2 h-11 rounded-md font-medium text-sm transition-all shadow-lg ${isLoading ? 'bg-indigo-600/50 text-indigo-200 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:shadow-indigo-500/25'}`}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Connexion au serveur...
                                </>
                            ) : (
                                <>
                                    Connecter le serveur
                                    <ArrowRight className="w-4 h-4 ml-1" />
                                </>
                            )}
                        </button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
