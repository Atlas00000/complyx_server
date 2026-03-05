-- CreateTable
CREATE TABLE "client_errors" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "code" TEXT,
    "url" TEXT,
    "userAgent" TEXT,
    "userId" TEXT,
    "level" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_errors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_errors_createdAt_idx" ON "client_errors"("createdAt");

-- CreateIndex
CREATE INDEX "client_errors_userId_idx" ON "client_errors"("userId");
