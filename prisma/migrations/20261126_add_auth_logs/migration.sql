-- CreateTable
CREATE TABLE IF NOT EXISTS "auth_logs" (
    "id" SERIAL NOT NULL,
    "event" VARCHAR(64) NOT NULL,
    "email" VARCHAR(255),
    "user_id" VARCHAR(255),
    "provider" VARCHAR(64),
    "reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "auth_logs_event_idx" ON "auth_logs"("event");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "auth_logs_email_idx" ON "auth_logs"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "auth_logs_created_at_idx" ON "auth_logs"("created_at");
