-- CreateTable
CREATE TABLE "client_logs" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_logs_createdAt_idx" ON "client_logs"("createdAt");

-- CreateIndex
CREATE INDEX "client_logs_level_idx" ON "client_logs"("level");
