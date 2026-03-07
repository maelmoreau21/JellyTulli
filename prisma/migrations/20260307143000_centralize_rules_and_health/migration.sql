ALTER TABLE "GlobalSettings"
ADD COLUMN "libraryRules" JSONB;

CREATE TABLE "SystemHealthState" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "monitor" JSONB NOT NULL,
    "sync" JSONB NOT NULL,
    "backup" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemHealthState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SystemHealthEvent" (
    "id" TEXT NOT NULL,
    "stateId" TEXT NOT NULL DEFAULT 'global',
    "source" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemHealthEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SystemHealthEvent_createdAt_idx" ON "SystemHealthEvent"("createdAt");
CREATE INDEX "SystemHealthEvent_source_createdAt_idx" ON "SystemHealthEvent"("source", "createdAt");
CREATE INDEX "SystemHealthEvent_kind_createdAt_idx" ON "SystemHealthEvent"("kind", "createdAt");

ALTER TABLE "SystemHealthEvent"
ADD CONSTRAINT "SystemHealthEvent_stateId_fkey"
FOREIGN KEY ("stateId") REFERENCES "SystemHealthState"("id") ON DELETE CASCADE ON UPDATE CASCADE;