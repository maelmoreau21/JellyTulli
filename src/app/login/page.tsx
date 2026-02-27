"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { PlayCircle, Lock, Loader2 } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        const result = await signIn("credentials", {
            password,
            redirect: false,
        });

        if (result?.error) {
            setError("Mot de passe incorrect");
            setIsLoading(false);
        } else {
            router.push("/");
            router.refresh();
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="w-full max-w-md space-y-8">
                <div className="flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <PlayCircle className="w-10 h-10 text-primary" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-foreground tracking-tight">
                        JellyTulli
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Authentification requise pour accéder au dashboard
                    </p>
                </div>

                <div className="bg-card border border-border rounded-xl shadow-sm p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                                <span className="flex items-center gap-2">
                                    <Lock className="w-4 h-4" /> Mot de passe Administrateur
                                </span>
                            </label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full form-input block rounded-md border-border bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm px-4 py-3 border"
                                placeholder="••••••••"
                            />
                        </div>

                        {error && (
                            <div className="text-sm text-red-500 font-medium">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading || !password}
                            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                "Se connecter"
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
