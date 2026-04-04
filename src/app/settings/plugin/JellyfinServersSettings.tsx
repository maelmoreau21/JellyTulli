"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Plug,
  Plus,
  RefreshCw,
  Server,
} from "lucide-react";
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
  hasPluginKey: boolean;
  pluginKeyMasked: string;
  connectionState: "online" | "offline" | "no_api_key";
  connectionMessage: string;
};

type PluginConnectionState = "connected" | "ready" | "missing";

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }
}

export function JellyfinServersSettings() {
  const [servers, setServers] = useState<JellyfinServerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pluginLoadingServerId, setPluginLoadingServerId] = useState<string | null>(null);
  const [globalPluginKeyLoading, setGlobalPluginKeyLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pluginKeyReady, setPluginKeyReady] = useState(false);
  const [jellytrackMode, setJellytrackMode] = useState("single");
  const [pluginEndpointPath, setPluginEndpointPath] = useState("/api/plugin/events");
  const [pluginConnected, setPluginConnected] = useState(false);
  const [pluginServerName, setPluginServerName] = useState<string | null>(null);
  const [pluginLastSeen, setPluginLastSeen] = useState<string | null>(null);
  const [pluginKeyByServerId, setPluginKeyByServerId] = useState<Record<string, string>>({});
  const [pluginKeyVisible, setPluginKeyVisible] = useState<Record<string, boolean>>({});
  const [copiedPluginKeyServerId, setCopiedPluginKeyServerId] = useState<string | null>(null);
  const [copiedPluginEndpointServerId, setCopiedPluginEndpointServerId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [allowAuthFallback, setAllowAuthFallback] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  const isMultiMode = jellytrackMode === "multi";
  const effectivePluginEndpoint = useMemo(() => {
    if (typeof window === "undefined") return pluginEndpointPath;
    return `${window.location.origin}${pluginEndpointPath}`;
  }, [pluginEndpointPath]);

  const getPluginStateForServer = (server: JellyfinServerRow): PluginConnectionState => {
    if (!pluginKeyReady) return "missing";
    if (pluginConnected && pluginServerName && pluginServerName === server.name) return "connected";
    return "ready";
  };

  const loadServers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/jellyfin-servers", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) {
          setMessage({ type: "error", text: "Vous devez être connecté pour charger les serveurs." });
        } else if (res.status === 403) {
          setMessage({ type: "error", text: "Accès admin requis pour gérer les serveurs." });
        } else {
          setMessage({ type: "error", text: data.error || "Impossible de charger les serveurs." });
        }
        return;
      }
      const nextServers = Array.isArray(data.servers) ? data.servers : [];
      setServers(nextServers);
      setPluginKeyReady(Boolean(data.pluginKeyReady));
      setPluginConnected(Boolean(data.pluginConnected));
      setPluginServerName(typeof data.pluginServerName === "string" ? data.pluginServerName : null);
      setPluginLastSeen(typeof data.pluginLastSeen === "string" ? data.pluginLastSeen : null);
      const mode = typeof data.jellytrackMode === "string" ? data.jellytrackMode.trim().toLowerCase() : "single";
      setJellytrackMode(mode || "single");
      if (typeof data.pluginEndpointPath === "string" && data.pluginEndpointPath.trim()) {
        setPluginEndpointPath(data.pluginEndpointPath.trim());
      }
      if (nextServers.length === 0 && (mode || "single") === "multi") {
        setShowAddForm(true);
      }
    } catch {
      setMessage({ type: "error", text: "Erreur réseau lors du chargement des serveurs." });
    } finally {
      setLoading(false);
    }
  };

  const fetchServerPluginKey = async (id: string, force = false): Promise<string | null> => {
    const cached = pluginKeyByServerId[id];
    if (cached && !force) return cached;

    setPluginLoadingServerId(id);
    try {
      const res = await fetch("/api/settings/jellyfin-servers/plugin-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Impossible de récupérer la clé plugin du serveur." });
        return null;
      }

      const nextKey = String(data.pluginApiKey || "").trim();
      if (!nextKey) {
        setMessage({ type: "error", text: "Clé plugin serveur invalide." });
        return null;
      }

      if (typeof data.pluginEndpointPath === "string" && data.pluginEndpointPath.trim()) {
        setPluginEndpointPath(data.pluginEndpointPath.trim());
      }

      setPluginKeyByServerId((prev) => ({ ...prev, [id]: nextKey }));
      return nextKey;
    } catch {
      setMessage({ type: "error", text: "Erreur réseau lors de la récupération de la clé plugin." });
      return null;
    } finally {
      setPluginLoadingServerId((prev) => (prev === id ? null : prev));
    }
  };

  useEffect(() => {
    loadServers();
  }, []);

  const handleGenerateGlobalPluginKey = async () => {
    setGlobalPluginKeyLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/plugin/api-key", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Impossible de générer la clé plugin globale." });
        return;
      }

      setPluginKeyByServerId({});
      setPluginKeyVisible({});
      setPluginKeyReady(true);
      setMessage({ type: "success", text: "Clé plugin globale générée. Les clés serveur sont prêtes." });
      await loadServers();
    } catch {
      setMessage({ type: "error", text: "Erreur réseau lors de la génération de la clé plugin globale." });
    } finally {
      setGlobalPluginKeyLoading(false);
    }
  };

  const handleAddServer = async () => {
    if (!isMultiMode) {
      setMessage({ type: "error", text: "Ajout de serveurs secondaires disponible uniquement en mode multi." });
      return;
    }

    if (!url.trim()) {
      setMessage({ type: "error", text: "URL serveur Jellyfin requise." });
      return;
    }
    if (!apiKey.trim()) {
      setMessage({ type: "error", text: "Clé API Jellyfin requise." });
      return;
    }

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
      setShowAddForm(true);
      setMessage({ type: "success", text: "Serveur ajouté. Vous pouvez en ajouter un autre juste en dessous." });
      await loadServers();
    } catch {
      setMessage({ type: "error", text: "Erreur réseau lors de l'ajout du serveur." });
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePluginKeyVisibility = async (id: string) => {
    if (pluginKeyVisible[id]) {
      setPluginKeyVisible((prev) => ({ ...prev, [id]: false }));
      return;
    }

    const key = await fetchServerPluginKey(id);
    if (!key) return;
    setPluginKeyVisible((prev) => ({ ...prev, [id]: true }));
  };

  const handleCopyPluginKey = async (id: string) => {
    const key = await fetchServerPluginKey(id);
    if (!key) return;

    await copyText(key);
    setCopiedPluginKeyServerId(id);
    setTimeout(() => {
      setCopiedPluginKeyServerId((prev) => (prev === id ? null : prev));
    }, 1800);
  };

  const handleCopyPluginEndpoint = async (id: string) => {
    await copyText(effectivePluginEndpoint);
    setCopiedPluginEndpointServerId(id);
    setTimeout(() => {
      setCopiedPluginEndpointServerId((prev) => (prev === id ? null : prev));
    }, 1800);
  };

  const handleRegeneratePluginKey = async (id: string) => {
    const key = await fetchServerPluginKey(id, true);
    if (!key) return;

    setPluginKeyVisible((prev) => ({ ...prev, [id]: true }));
    setMessage({ type: "success", text: "Clé plugin serveur rafraichie." });
  };

  const primaryServer = servers.find((server) => server.isPrimary);
  const fallbackServerInUse =
    primaryServer?.connectionState === "offline"
      ? servers.find(
          (server) => !server.isPrimary && server.allowAuthFallback && server.connectionState === "online"
        )
      : null;

  return (
    <Card className="app-surface">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="w-5 h-5" />
          Connexion Jellyfin
        </CardTitle>
        <CardDescription>
          Un seul bloc par serveur: paramètres Jellyfin + connexion plugin. Le serveur principal est verrouillé.
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

        {fallbackServerInUse && (
          <div className="p-3 rounded-md flex items-start gap-2 text-sm border bg-amber-500/10 text-amber-200 border-amber-500/30">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-100">Serveur principal indisponible</p>
              <p className="text-amber-100/90">
                Connexion de secours disponible sur {fallbackServerInUse.name}.
              </p>
            </div>
          </div>
        )}

        <div className="rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1 flex items-center gap-2">
            <Server className="w-3.5 h-3.5" />
            Mode JellyTrack actif: {isMultiMode ? "multi" : "single"}
          </p>
          <p>
            En mode <strong>{isMultiMode ? "multi" : "single"}</strong>, le serveur principal vient du docker-compose et reste en lecture seule.
            En mode multi, vous pouvez ajouter des serveurs secondaires a l'infini.
          </p>
        </div>

        {!pluginKeyReady && (
          <div className="p-3 rounded-md flex flex-col gap-3 text-sm border bg-red-500/10 text-red-300 border-red-500/30 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5" />
              <div>
                <p className="font-semibold text-red-200">Clé plugin globale manquante</p>
                <p className="text-red-200/90">
                  Generez-la pour activer les cles plugin de chaque serveur.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleGenerateGlobalPluginKey}
              disabled={globalPluginKeyLoading}
              className="inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 border border-red-400/30 bg-red-500/20 hover:bg-red-500/30 text-red-100 text-xs font-medium disabled:opacity-60"
            >
              {globalPluginKeyLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Generer la cle plugin globale
            </button>
          </div>
        )}

        <div className="space-y-3">
          {loading ? (
            <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">Chargement des serveurs...</div>
          ) : servers.length === 0 ? (
            <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
              Aucun serveur configure.
            </div>
          ) : (
            servers.map((server) => (
              <div key={server.id} className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">{server.name}</p>
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span
                        className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 ${
                          server.isPrimary
                            ? "bg-primary/15 text-primary border-primary/30"
                            : "bg-zinc-500/10 text-zinc-300 border-zinc-500/30"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            server.isPrimary ? "bg-primary" : "bg-zinc-400"
                          }`}
                        />
                        {server.isPrimary ? "Serveur principal" : "Serveur secondaire"}
                      </span>

                      <span
                        className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 ${
                          server.connectionState === "online"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : server.connectionState === "no_api_key"
                              ? "bg-zinc-500/10 text-zinc-300 border-zinc-500/30"
                              : "bg-red-500/10 text-red-400 border-red-500/30"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            server.connectionState === "online"
                              ? "bg-emerald-400"
                              : server.connectionState === "no_api_key"
                                ? "bg-zinc-400"
                                : "bg-red-400"
                          }`}
                        />
                        {server.connectionState === "online"
                          ? "Jellyfin connecte"
                          : server.connectionState === "no_api_key"
                            ? "Cle API manquante"
                            : "Jellyfin hors ligne"}
                      </span>

                      <span
                        className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 ${
                          getPluginStateForServer(server) === "connected"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : getPluginStateForServer(server) === "ready"
                              ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                              : "bg-red-500/10 text-red-300 border-red-500/30"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            getPluginStateForServer(server) === "connected"
                              ? "bg-emerald-400 animate-pulse"
                              : getPluginStateForServer(server) === "ready"
                                ? "bg-amber-300"
                                : "bg-red-300"
                          }`}
                        />
                        {getPluginStateForServer(server) === "connected"
                          ? "Plugin connecte"
                          : getPluginStateForServer(server) === "ready"
                            ? "Plugin pret"
                            : "Plugin non configure"}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground max-w-lg">{server.connectionMessage}</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                  <div className="lg:col-span-3">
                    <Label className="text-xs">Nom du serveur</Label>
                    <Input value={server.name} readOnly className="text-xs" />
                  </div>
                  <div className="lg:col-span-5">
                    <Label className="text-xs">URL serveur</Label>
                    <Input value={server.url} readOnly className="font-mono text-xs" />
                  </div>
                  <div className="lg:col-span-4">
                    <Label className="text-xs">Cle d'API serveur</Label>
                    <Input value={server.hasApiKey ? server.apiKeyMasked : "non configuree"} readOnly className="font-mono text-xs" />
                  </div>
                </div>

                {server.isPrimary && (
                  <p className="text-[11px] text-muted-foreground">
                    Serveur principal verrouille: ces champs viennent de la configuration Docker/.env.
                  </p>
                )}

                <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/10">
                  <p className="text-xs font-semibold text-foreground">Connexion plugin ({server.name})</p>

                  {pluginLastSeen && (
                    <p className="text-[11px] text-muted-foreground">
                      Dernier heartbeat plugin: {new Date(pluginLastSeen).toLocaleString("fr-FR")}
                    </p>
                  )}

                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-2">
                    <div className="xl:col-span-8">
                      <Label className="text-xs">URL plugin</Label>
                      <Input value={effectivePluginEndpoint} readOnly className="font-mono text-xs" />
                    </div>
                    <div className="xl:col-span-4 flex items-end">
                      <button
                        type="button"
                        onClick={() => handleCopyPluginEndpoint(server.id)}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 border border-border hover:bg-muted text-xs font-medium"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {copiedPluginEndpointServerId === server.id ? "URL copiée" : "Copier URL"}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-2">
                    <div className="xl:col-span-8 relative">
                      <Label className="text-xs">Clé plugin serveur</Label>
                      <Input
                        readOnly
                        type={pluginKeyVisible[server.id] ? "text" : "password"}
                        value={
                          pluginKeyVisible[server.id]
                            ? pluginKeyByServerId[server.id] || ""
                            : server.pluginKeyMasked || ""
                        }
                        className="font-mono text-xs pr-10"
                        placeholder={pluginKeyReady ? "Cliquez sur Afficher" : "Générez la clé plugin globale"}
                      />
                      <button
                        type="button"
                        onClick={() => handleTogglePluginKeyVisibility(server.id)}
                        disabled={!pluginKeyReady || pluginLoadingServerId === server.id}
                        className="absolute right-2 top-[30px] text-zinc-500 hover:text-zinc-300 disabled:opacity-40"
                      >
                        {pluginKeyVisible[server.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="xl:col-span-4 flex items-end">
                      <button
                        type="button"
                        onClick={() => handleCopyPluginKey(server.id)}
                        disabled={!pluginKeyReady || pluginLoadingServerId === server.id}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 border border-border hover:bg-muted text-xs font-medium disabled:opacity-60"
                      >
                        {pluginLoadingServerId === server.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        {copiedPluginKeyServerId === server.id ? "Clé copiée" : "Copier clé"}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleRegeneratePluginKey(server.id)}
                      disabled={!pluginKeyReady || pluginLoadingServerId === server.id}
                      className="inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 border border-border hover:bg-muted text-xs font-medium disabled:opacity-60"
                    >
                      {pluginLoadingServerId === server.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      Regenerer la cle
                    </button>
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    Configurez le plugin de ce serveur avec cette URL et cette cle dediee.
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {isMultiMode ? (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowAddForm((prev) => !prev)}
                className="inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 border border-border hover:bg-muted text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                {showAddForm ? "Masquer l'ajout" : "Ajouter un serveur"}
              </button>
            </div>

            {showAddForm && (
              <div className="rounded-lg border border-border p-3 space-y-3">
                <p className="text-sm font-medium text-foreground">Nouveau serveur secondaire</p>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                  <div className="lg:col-span-3">
                    <Label>Nom du serveur</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jellyfin Salon" />
                  </div>
                  <div className="lg:col-span-5">
                    <Label>URL serveur</Label>
                    <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://jellyfin-secondaire.local" />
                  </div>
                  <div className="lg:col-span-4">
                    <Label>Cle d'API serveur</Label>
                    <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="API key Jellyfin" type="password" />
                  </div>
                </div>

                <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={allowAuthFallback}
                    onChange={(e) => setAllowAuthFallback(e.target.checked)}
                  />
                  Autoriser ce serveur en fallback d'authentification
                </label>

                <button
                  type="button"
                  onClick={handleAddServer}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 border border-border hover:bg-muted text-sm font-medium disabled:opacity-60"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Ajouter ce serveur
                </button>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Le bouton "Ajouter un serveur" reste disponible en permanence pour en ajouter autant que necessaire.
            </p>
          </div>
        ) : (
          <div className="rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
            L'ajout de serveurs secondaires est disponible uniquement en mode multi.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
