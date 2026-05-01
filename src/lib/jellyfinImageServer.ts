import "server-only";

import prisma from "@/lib/prisma";
import { buildJellyfinApiKeyHeaders } from "@/lib/jellyfinServers";

type JellyfinConnection = {
    baseUrl: string;
    apiKey: string;
};

function normalizeUrl(value: string | null | undefined): string {
    return String(value || "").trim().replace(/\/+$/, "");
}

function normalizeApiKey(value: string | null | undefined): string | null {
    const trimmed = String(value || "").trim();
    return trimmed.length > 0 ? trimmed : null;
}

async function resolveJellyfinConnection(serverId?: string | null): Promise<JellyfinConnection | null> {
    const envBaseUrl = normalizeUrl(process.env.JELLYFIN_URL);
    const envApiKey = normalizeApiKey(process.env.JELLYFIN_API_KEY);

    if (serverId) {
        const server = await prisma.server.findUnique({
            where: { id: serverId },
            select: { url: true, jellyfinApiKey: true },
        });

        if (server) {
            const baseUrl = normalizeUrl(server.url) || envBaseUrl;
            const apiKey = normalizeApiKey(server.jellyfinApiKey) || envApiKey;
            if (baseUrl && apiKey) {
                return { baseUrl, apiKey };
            }
        }
    }

    if (!envBaseUrl || !envApiKey) return null;
    return { baseUrl: envBaseUrl, apiKey: envApiKey };
}

export async function fetchJellyfinImage(itemId: string, type: string, serverId?: string | null) {
    const connection = await resolveJellyfinConnection(serverId);

    if (!connection) {
        throw new Error("JELLYFIN_URL ou JELLYFIN_API_KEY non configurées dans les variables d'environnement.");
    }

    const url = `${connection.baseUrl}/Items/${encodeURIComponent(itemId)}/Images/${encodeURIComponent(type)}?fillWidth=300&quality=80`;

    return fetch(url, {
        method: "GET",
        headers: buildJellyfinApiKeyHeaders(connection.apiKey),
        next: { revalidate: 86400 },
    });
}

export async function fetchJellyfinJson<T>(path: string, serverId?: string | null): Promise<T | null> {
    const connection = await resolveJellyfinConnection(serverId);
    if (!connection) return null;

    try {
        const separator = path.includes("?") ? "&" : "?";
        const url = `${connection.baseUrl}${path}${separator}api_key=${encodeURIComponent(connection.apiKey)}`;
        const response = await fetch(url, {
            method: "GET",
            headers: buildJellyfinApiKeyHeaders(connection.apiKey),
            next: { revalidate: 3600 },
        });

        if (!response.ok) return null;
        return await response.json() as T;
    } catch {
        return null;
    }
}
