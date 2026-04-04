import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin, isAuthError } from "@/lib/auth";
import { fetchJellyfinSystemInfo, getConfiguredJellyfinServers, maskSecret } from "@/lib/jellyfinServers";
import { getMasterServerIdentityFromEnv } from "@/lib/serverRegistry";

export const dynamic = "force-dynamic";

function normalizeUrl(value: unknown): string {
  return String(value || "").trim().replace(/\/+$/, "");
}

function normalizeSecret(value: unknown): string {
  return String(value || "").trim();
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    if (lowered === "true") return true;
    if (lowered === "false") return false;
  }
  return fallback;
}

export async function GET() {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;

  const servers = await getConfiguredJellyfinServers();
  return NextResponse.json(
    {
      servers: servers.map((server) => ({
        id: server.id,
        jellyfinServerId: server.jellyfinServerId,
        name: server.name,
        url: server.url,
        isPrimary: server.isPrimary,
        hasApiKey: !!server.apiKey,
        apiKeyMasked: maskSecret(server.apiKey),
        allowAuthFallback: server.allowAuthFallback,
      })),
    },
    { status: 200 }
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const url = normalizeUrl(body.url);
  const apiKey = normalizeSecret(body.apiKey);
  const displayName = String(body.name || "").trim();
  const allowAuthFallback = asBoolean(body.allowAuthFallback, true);

  if (!url) {
    return NextResponse.json({ error: "URL serveur Jellyfin requise." }, { status: 400 });
  }
  if (!apiKey) {
    return NextResponse.json({ error: "Clé API Jellyfin requise." }, { status: 400 });
  }

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "URL Jellyfin invalide." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "URL Jellyfin invalide." }, { status: 400 });
  }

  const info = await fetchJellyfinSystemInfo({ url, apiKey });
  if (!info) {
    return NextResponse.json(
      { error: "Connexion Jellyfin impossible. Vérifiez l'URL et la clé API." },
      { status: 400 }
    );
  }

  const master = getMasterServerIdentityFromEnv();

  const updated = await prisma.server.upsert({
    where: { jellyfinServerId: info.serverId },
    update: {
      name: displayName || info.serverName,
      url,
      jellyfinApiKey: apiKey,
      allowAuthFallback: allowAuthFallback && info.serverId !== master.jellyfinServerId,
      isActive: true,
    },
    create: {
      jellyfinServerId: info.serverId,
      name: displayName || info.serverName,
      url,
      jellyfinApiKey: apiKey,
      allowAuthFallback: allowAuthFallback && info.serverId !== master.jellyfinServerId,
      isActive: true,
    },
    select: {
      id: true,
      jellyfinServerId: true,
      name: true,
      url: true,
      allowAuthFallback: true,
    },
  });

  return NextResponse.json({ server: updated }, { status: 200 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(body.id || "").trim();
  if (!id) {
    return NextResponse.json({ error: "Serveur introuvable." }, { status: 400 });
  }

  const master = getMasterServerIdentityFromEnv();
  const prismaAny = prisma as any;
  const existing = await prismaAny.server.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Serveur introuvable." }, { status: 404 });
  }

  const nextAllowFallback =
    body.allowAuthFallback === undefined
      ? existing.allowAuthFallback
      : asBoolean(body.allowAuthFallback, existing.allowAuthFallback);

  const nextIsActive =
    body.isActive === undefined ? existing.isActive : asBoolean(body.isActive, existing.isActive);

  const updated = await prismaAny.server.update({
    where: { id },
    data: {
      allowAuthFallback:
        existing.jellyfinServerId === master.jellyfinServerId ? false : Boolean(nextAllowFallback),
      isActive: Boolean(nextIsActive),
    },
    select: {
      id: true,
      jellyfinServerId: true,
      name: true,
      url: true,
      allowAuthFallback: true,
      isActive: true,
    },
  });

  return NextResponse.json({ server: updated }, { status: 200 });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(body.id || "").trim();
  if (!id) {
    return NextResponse.json({ error: "Serveur introuvable." }, { status: 400 });
  }

  const prismaAny = prisma as any;
  const updated = await prismaAny.server.update({
    where: { id },
    data: {
      jellyfinApiKey: null,
      allowAuthFallback: false,
    },
    select: {
      id: true,
      jellyfinServerId: true,
      name: true,
      url: true,
      allowAuthFallback: true,
    },
  });

  return NextResponse.json({ server: updated }, { status: 200 });
}
