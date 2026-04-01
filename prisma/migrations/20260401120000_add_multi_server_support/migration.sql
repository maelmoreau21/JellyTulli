-- Multi-server support migration
-- 1) Create canonical Server table
CREATE TABLE "Server" (
    "id" TEXT NOT NULL,
    "jellyfinServerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Server_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Server_jellyfinServerId_key" ON "Server"("jellyfinServerId");

-- 2) Seed legacy mono-server record for existing rows
INSERT INTO "Server" ("id", "jellyfinServerId", "name", "url", "isActive", "createdAt", "updatedAt")
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'legacy-single-server',
    'Legacy Single Server',
    'http://localhost',
    true,
    NOW(),
    NOW()
)
ON CONFLICT ("jellyfinServerId") DO NOTHING;

-- 3) Add serverId columns (nullable first for backfill)
ALTER TABLE "User" ADD COLUMN "serverId" TEXT;
ALTER TABLE "Media" ADD COLUMN "serverId" TEXT;
ALTER TABLE "PlaybackHistory" ADD COLUMN "serverId" TEXT;
ALTER TABLE "TelemetryEvent" ADD COLUMN "serverId" TEXT;
ALTER TABLE "ActiveStream" ADD COLUMN "serverId" TEXT;

-- 4) Backfill existing data
UPDATE "User" SET "serverId" = '00000000-0000-0000-0000-000000000001' WHERE "serverId" IS NULL;
UPDATE "Media" SET "serverId" = '00000000-0000-0000-0000-000000000001' WHERE "serverId" IS NULL;
UPDATE "PlaybackHistory" SET "serverId" = '00000000-0000-0000-0000-000000000001' WHERE "serverId" IS NULL;
UPDATE "TelemetryEvent" SET "serverId" = '00000000-0000-0000-0000-000000000001' WHERE "serverId" IS NULL;
UPDATE "ActiveStream" SET "serverId" = '00000000-0000-0000-0000-000000000001' WHERE "serverId" IS NULL;

-- 5) Enforce NOT NULL
ALTER TABLE "User" ALTER COLUMN "serverId" SET NOT NULL;
ALTER TABLE "Media" ALTER COLUMN "serverId" SET NOT NULL;
ALTER TABLE "PlaybackHistory" ALTER COLUMN "serverId" SET NOT NULL;
ALTER TABLE "TelemetryEvent" ALTER COLUMN "serverId" SET NOT NULL;
ALTER TABLE "ActiveStream" ALTER COLUMN "serverId" SET NOT NULL;

-- 6) Replace legacy uniques with server-scoped composites
DROP INDEX IF EXISTS "User_jellyfinUserId_key";
DROP INDEX IF EXISTS "Media_jellyfinMediaId_key";
DROP INDEX IF EXISTS "ActiveStream_sessionId_key";

CREATE UNIQUE INDEX "User_jellyfinUserId_serverId_key" ON "User"("jellyfinUserId", "serverId");
CREATE UNIQUE INDEX "Media_jellyfinMediaId_serverId_key" ON "Media"("jellyfinMediaId", "serverId");
CREATE UNIQUE INDEX "ActiveStream_sessionId_serverId_key" ON "ActiveStream"("sessionId", "serverId");

-- 7) Add foreign keys
ALTER TABLE "User"
ADD CONSTRAINT "User_serverId_fkey"
FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Media"
ADD CONSTRAINT "Media_serverId_fkey"
FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlaybackHistory"
ADD CONSTRAINT "PlaybackHistory_serverId_fkey"
FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TelemetryEvent"
ADD CONSTRAINT "TelemetryEvent_serverId_fkey"
FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActiveStream"
ADD CONSTRAINT "ActiveStream_serverId_fkey"
FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 8) Add server-oriented indexes
CREATE INDEX "User_serverId_idx" ON "User"("serverId");
CREATE INDEX "Media_serverId_idx" ON "Media"("serverId");
CREATE INDEX "PlaybackHistory_serverId_idx" ON "PlaybackHistory"("serverId");
CREATE INDEX "PlaybackHistory_serverId_startedAt_idx" ON "PlaybackHistory"("serverId", "startedAt");
CREATE INDEX "PlaybackHistory_serverId_userId_startedAt_idx" ON "PlaybackHistory"("serverId", "userId", "startedAt");
CREATE INDEX "PlaybackHistory_serverId_mediaId_startedAt_idx" ON "PlaybackHistory"("serverId", "mediaId", "startedAt");
CREATE INDEX "TelemetryEvent_serverId_idx" ON "TelemetryEvent"("serverId");
CREATE INDEX "TelemetryEvent_serverId_eventType_idx" ON "TelemetryEvent"("serverId", "eventType");
CREATE INDEX "ActiveStream_serverId_idx" ON "ActiveStream"("serverId");
CREATE INDEX "ActiveStream_serverId_lastPingAt_idx" ON "ActiveStream"("serverId", "lastPingAt");
