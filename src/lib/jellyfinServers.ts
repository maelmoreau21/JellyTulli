import prisma from "@/lib/prisma";
import { ensureMasterServer, getMasterServerIdentityFromEnv } from "@/lib/serverRegistry";
import { buildSelectableServerOptions } from "@/lib/selectableServers";

export interface JellyfinServerConnection {
  id: string;
  jellyfinServerId: string;
  name: string;
  url: string;
  apiKey: string | null;
  allowAuthFallback: boolean;
  isPrimary: boolean;
}

export interface JellyfinAuthResponse {
  userId: string;
  username: string;
  isAdmin: boolean;
}

export type JellyfinAuthAttemptStatus = "success" | "invalid_credentials" | "unreachable" | "error";

export interface JellyfinAuthAttemptResult {
  status: JellyfinAuthAttemptStatus;
  user: JellyfinAuthResponse | null;
}

function normalizeUrl(value: string | null | undefined): string {
  return String(value || "").trim().replace(/\/+$/, "");
}

function normalizeApiKey(value: string | null | undefined): string | null {
  const trimmed = String(value || "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getServerSortRank(server: Pick<JellyfinServerConnection, "isPrimary" | "name">): string {
  const prefix = server.isPrimary ? "0" : "1";
  return `${prefix}:${server.name.toLowerCase()}`;
}

export async function getConfiguredJellyfinServers(): Promise<JellyfinServerConnection[]> {
  const masterIdentity = getMasterServerIdentityFromEnv();
  const ensuredMaster = await ensureMasterServer();

  const serverModel = (prisma as any)?.server;
  let rows: Array<Record<string, any>> = [];
  if (!serverModel || typeof serverModel.findMany !== 'function') {
    // In some test environments the prisma mock doesn't include the `server` model.
    // Fall back to an empty list so `ensureMasterServer()` can still provide a master entry.
    console.warn('Prisma "server" model not available; falling back to empty server list for tests.');
  } else {
    rows = await serverModel.findMany({
      where: { isActive: true },
      select: {
        id: true,
        jellyfinServerId: true,
        name: true,
        url: true,
        jellyfinApiKey: true,
        allowAuthFallback: true,
      },
    });
  }

  const masterUrl = normalizeUrl(masterIdentity.url);
  const list: JellyfinServerConnection[] = rows.map((row) => {
    const rowUrl = normalizeUrl(row.url);
    const isPrimary =
      row.id === ensuredMaster.id ||
      row.jellyfinServerId === masterIdentity.jellyfinServerId ||
      (!!masterUrl && rowUrl === masterUrl);

    return {
      id: row.id,
      jellyfinServerId: row.jellyfinServerId,
      name: row.name,
      url: rowUrl,
      apiKey: normalizeApiKey(row.jellyfinApiKey),
      allowAuthFallback: row.allowAuthFallback === true,
      isPrimary,
    };
  });

  const hasPrimary = list.some((server) => server.isPrimary);
  if (!hasPrimary) {
    list.push({
      id: ensuredMaster.id,
      jellyfinServerId: masterIdentity.jellyfinServerId,
      name: masterIdentity.name,
      url: masterUrl,
      apiKey: null,
      allowAuthFallback: false,
      isPrimary: true,
    });
  }

  const visibleServerIds = new Set(
    buildSelectableServerOptions(
      list.map((server) => ({
        id: server.id,
        name: server.name,
        isActive: true,
        url: server.url,
        jellyfinServerId: server.jellyfinServerId,
      }))
    ).map((server) => server.id)
  );

  const filteredList = list.filter((server) => visibleServerIds.has(server.id));

  filteredList.sort((left, right) => getServerSortRank(left).localeCompare(getServerSortRank(right)));
  return filteredList;
}

export async function authenticateAgainstJellyfin(input: {
  url: string;
  username: string;
  password: string;
  timeoutMs?: number;
}): Promise<JellyfinAuthResponse | null> {
  const attempt = await authenticateAgainstJellyfinDetailed(input);
  return attempt.status === "success" ? attempt.user : null;
}

export async function authenticateAgainstJellyfinDetailed(input: {
  url: string;
  username: string;
  password: string;
  timeoutMs?: number;
}): Promise<JellyfinAuthAttemptResult> {
  const baseUrl = normalizeUrl(input.url);
  if (!baseUrl) return { status: "error", user: null };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1500, input.timeoutMs ?? 7000));
  try {
    const response = await fetch(`${baseUrl}/Users/AuthenticateByName`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:
          'MediaBrowser Client="JellyTrack", Device="Server", DeviceId="JellyTrack-1", Version="1.0.0"',
      },
      body: JSON.stringify({
        Username: input.username,
        Pw: input.password,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (response.status === 401 || response.status === 403) {
      return { status: "invalid_credentials", user: null };
    }

    if (!response.ok) {
      if (response.status >= 500) {
        return { status: "unreachable", user: null };
      }
      return { status: "error", user: null };
    }

    const data = await response.json();
    const userNode = (data?.User || {}) as Record<string, unknown>;
    const userId = String(userNode.Id || "").trim();
    const username = String(userNode.Name || input.username || "").trim();

    if (!userId || !username) return { status: "error", user: null };

    const policy = (userNode.Policy || {}) as Record<string, unknown>;
    const isAdmin = policy.IsAdministrator === true;

    return {
      status: "success",
      user: { userId, username, isAdmin },
    };
  } catch {
    return { status: "unreachable", user: null };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchJellyfinSystemInfo(input: {
  url: string;
  apiKey: string;
}): Promise<{ serverId: string; serverName: string } | null> {
  const baseUrl = normalizeUrl(input.url);
  const apiKey = normalizeApiKey(input.apiKey);
  if (!baseUrl || !apiKey) return null;

  try {
    const response = await fetch(`${baseUrl}/System/Info`, {
      method: "GET",
      headers: { "X-Emby-Token": apiKey },
      cache: "no-store",
    });

    if (!response.ok) return null;

    const data = await response.json();
    const record = (data || {}) as Record<string, unknown>;
    const serverId = String(record.Id || record.ServerId || "").trim();
    const serverName = String(record.ServerName || record.LocalAddress || record.WanAddress || baseUrl).trim();

    if (!serverId) return null;
    return { serverId, serverName: serverName || baseUrl };
  } catch {
    return null;
  }
}

export function maskSecret(secret: string | null | undefined): string {
  const value = String(secret || "").trim();
  if (!value) return "";
  if (value.length <= 6) return "*".repeat(value.length);
  return `${value.slice(0, 3)}${"*".repeat(Math.max(4, value.length - 6))}${value.slice(-3)}`;
}
