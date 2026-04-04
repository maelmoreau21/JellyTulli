import { createHmac, timingSafeEqual } from "node:crypto";

const SCOPED_PLUGIN_KEY_PREFIX = "jts2";

function normalizeValue(value: string | null | undefined): string {
  return String(value || "").trim();
}

function safeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;

  try {
    return timingSafeEqual(leftBuffer, rightBuffer);
  } catch {
    return false;
  }
}

function encodeServerId(serverId: string): string {
  return Buffer.from(serverId, "utf8").toString("base64url");
}

function decodeServerId(encoded: string): string | null {
  try {
    const decoded = Buffer.from(encoded, "base64url").toString("utf8").trim();
    return decoded || null;
  } catch {
    return null;
  }
}

function buildScopedPluginKeySignature(seedPluginKey: string, jellyfinServerId: string): string {
  return createHmac("sha256", seedPluginKey)
    .update(`server:${jellyfinServerId}`)
    .digest("base64url");
}

export function deriveScopedPluginApiKey(seedPluginKey: string | null | undefined, jellyfinServerId: string | null | undefined): string | null {
  const normalizedSeed = normalizeValue(seedPluginKey);
  const normalizedServerId = normalizeValue(jellyfinServerId);
  if (!normalizedSeed || !normalizedServerId) return null;

  const encodedServerId = encodeServerId(normalizedServerId);
  const signature = buildScopedPluginKeySignature(normalizedSeed, normalizedServerId);
  return `${SCOPED_PLUGIN_KEY_PREFIX}.${encodedServerId}.${signature}`;
}

export function verifyScopedPluginApiKey(candidateToken: string | null | undefined, seedPluginKey: string | null | undefined): { valid: boolean; jellyfinServerId: string | null } {
  const token = normalizeValue(candidateToken);
  const normalizedSeed = normalizeValue(seedPluginKey);
  if (!token || !normalizedSeed) {
    return { valid: false, jellyfinServerId: null };
  }

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== SCOPED_PLUGIN_KEY_PREFIX) {
    return { valid: false, jellyfinServerId: null };
  }

  const serverId = decodeServerId(parts[1]);
  if (!serverId) {
    return { valid: false, jellyfinServerId: null };
  }

  const expected = deriveScopedPluginApiKey(normalizedSeed, serverId);
  if (!expected) {
    return { valid: false, jellyfinServerId: null };
  }

  return {
    valid: safeEquals(token, expected),
    jellyfinServerId: serverId,
  };
}
