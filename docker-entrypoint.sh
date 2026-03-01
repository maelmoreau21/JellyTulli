#!/bin/sh
set -e

echo "Starting JellyTulli Server..."

# ─── PUID / PGID Support ───────────────────────────────────────────
PUID=${PUID:-1001}
PGID=${PGID:-1001}

echo "Configuring user: UID=$PUID, GID=$PGID"

# Update the nextjs group GID and user UID on the fly
if [ "$(id -g nextjs)" != "$PGID" ]; then
    groupmod -o -g "$PGID" nodejs 2>/dev/null || true
fi
if [ "$(id -u nextjs)" != "$PUID" ]; then
    usermod -o -u "$PUID" nextjs 2>/dev/null || true
fi

# Fix ownership of critical directories
chown -R "$PUID:$PGID" /app /data/backups 2>/dev/null || true

# ─── Prisma Migration ──────────────────────────────────────────────
echo "Running Prisma db push..."
su-exec "$PUID:$PGID" npx prisma db push --accept-data-loss --skip-generate

echo "Prisma schema pushed successfully."

# ─── Launch App as the configured user ──────────────────────────────
echo "Launching Next.js Standalone server..."
exec su-exec "$PUID:$PGID" node server.js
