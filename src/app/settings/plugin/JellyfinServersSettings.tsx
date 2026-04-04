"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Plug, Save, ShieldAlert, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type JellyfinServerRow = {
  id: string;
  jellyfinServerId: string;
  name: string;
  url: string;
  isPrimary: boolean;
  hasApiKey: boolean;
  apiKeyMasked: string;
  allowAuthFallback: boolean;
};

export function JellyfinServersSettings() {
  const [servers, setServers] = useState<JellyfinServerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [allowAuthFallback, setAllowAuthFallback] = useState(true);

  const loadServers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/jellyfin-servers", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Impossible de charger les serveurs." });
        return;
      }
      setServers(Array.isArray(data.servers) ? data.servers : []);
    } catch {
      setMessage({ type: "error", text: "Erreur réseau lors du chargement des serveurs." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServers();
  }, []);

  const handleAddServer = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/jellyfin-servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          url,
          apiKey,
          allowAuthFallback,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Impossible d'ajouter ce serveur." });
        return;
      }

      setName("");
      setUrl("");
      setApiKey("");
      setAllowAuthFallback(true);
      setMessage({ type: "success", text: "Serveur ajouté / mis à jour avec succès." });
      await loadServers();
    } catch {
      setMessage({ type: "error", text: "Erreur réseau lors de l'ajout du serveur." });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFallback = async (id: string, next: boolean) => {
    setMessage(null);
    try {
      const res = await fetch("/api/settings/jellyfin-servers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, allowAuthFallback: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Impossible de mettre à jour le fallback." });
        return;
      }
      await loadServers();
    } catch {
      setMessage({ type: "error", text: "Erreur réseau lors de la mise à jour." });
    }
  };

  const handleClearApiKey = async (id: string) => {
    if (!confirm("Supprimer la clé API enregistrée pour ce serveur ?")) return;

    setMessage(null);
    try {
      const res = await fetch("/api/settings/jellyfin-servers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Impossible de supprimer la clé API." });
        return;
      }
      setMessage({ type: "success", text: "Clé API supprimée pour ce serveur." });
      await loadServers();
    } catch {
      setMessage({ type: "error", text: "Erreur réseau lors de la suppression." });
    }
  };

  return (
    <Card className="app-surface">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="w-5 h-5" />
          Serveurs Jellyfin secondaires
        </CardTitle>
        <CardDescription>
          Ajoutez des serveurs (URL + clé API) pour synchroniser leurs bibliothèques et activer le fallback de connexion si le serveur principal tombe.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && (
          <div
            className={`p-3 rounded-md flex items-center gap-2 text-sm border ${
              message.type === "success"
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                : "bg-red-500/10 text-red-500 border-red-500/20"
            }`}
          >
            {message.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-3">
            <Label>Nom (optionnel)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jellyfin Salon" />
          </div>
          <div className="lg:col-span-4">
            <Label>URL serveur</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://jellyfin-secondaire.local" />
          </div>
          <div className="lg:col-span-3">
            <Label>Clé API</Label>
            <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="API key Jellyfin" type="password" />
          </div>
          <div className="lg:col-span-2 flex items-end">
            <button
              type="button"
              onClick={handleAddServer}
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 border border-border hover:bg-muted text-sm font-medium disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Enregistrer
            </button>
          </div>
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={allowAuthFallback}
            onChange={(e) => setAllowAuthFallback(e.target.checked)}
          />
          Autoriser ce serveur en fallback d'authentification
        </label>

        <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
          {loading ? (
            <div className="p-4 text-sm text-muted-foreground">Chargement des serveurs...</div>
          ) : servers.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">Aucun serveur configuré.</div>
          ) : (
            servers.map((server) => (
              <div key={server.id} className="p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {server.name}
                    {server.isPrimary && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">
                        Principal
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{server.url}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Clé API: {server.hasApiKey ? server.apiKeyMasked : "non configurée"}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!server.isPrimary && (
                    <button
                      type="button"
                      onClick={() => handleToggleFallback(server.id, !server.allowAuthFallback)}
                      className={`inline-flex items-center gap-1.5 text-xs rounded-md px-2.5 py-1.5 border ${
                        server.allowAuthFallback
                          ? "border-amber-500/30 text-amber-300 bg-amber-500/10"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      {server.allowAuthFallback ? "Fallback activé" : "Fallback désactivé"}
                    </button>
                  )}

                  {server.hasApiKey && !server.isPrimary && (
                    <button
                      type="button"
                      onClick={() => handleClearApiKey(server.id)}
                      className="inline-flex items-center gap-1.5 text-xs rounded-md px-2.5 py-1.5 border border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Supprimer clé
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
