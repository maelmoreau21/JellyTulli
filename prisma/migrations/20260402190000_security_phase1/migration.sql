-- Security phase 1: plugin key rotation metadata + admin audit logs

ALTER TABLE "GlobalSettings"
ADD COLUMN "pluginPreviousApiKey" TEXT,
ADD COLUMN "pluginPreviousApiKeyExpiresAt" TIMESTAMP(3),
ADD COLUMN "pluginKeyCreatedAt" TIMESTAMP(3),
ADD COLUMN "pluginKeyExpiresAt" TIMESTAMP(3),
ADD COLUMN "pluginKeyRotationDays" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN "pluginAutoRotateEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "pluginKeyRotationGraceHours" INTEGER NOT NULL DEFAULT 24;

UPDATE "GlobalSettings"
SET
  "pluginKeyCreatedAt" = COALESCE("pluginKeyCreatedAt", NOW()),
  "pluginKeyExpiresAt" = COALESCE(
    "pluginKeyExpiresAt",
    NOW() + make_interval(days => GREATEST(7, LEAST(365, "pluginKeyRotationDays")))
  )
WHERE "pluginApiKey" IS NOT NULL;

CREATE TABLE "AdminAuditLog" (
  "id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actorUserId" TEXT,
  "actorUsername" TEXT,
  "target" TEXT,
  "ipAddress" TEXT,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");
CREATE INDEX "AdminAuditLog_action_createdAt_idx" ON "AdminAuditLog"("action", "createdAt");
CREATE INDEX "AdminAuditLog_actorUserId_createdAt_idx" ON "AdminAuditLog"("actorUserId", "createdAt");
