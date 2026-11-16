-- ADR-P046 (security hardening S1). Additive only: new columns with defaults,
-- one new table. No existing column changes type or loses data.

-- Session: absolute lifetime. Existing rows take their own creation time as the
-- session start (conservative: a long-lived chain ends sooner, never later).
ALTER TABLE "refresh_tokens" ADD COLUMN     "session_started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "refresh_tokens" SET "session_started_at" = "created_at";

-- Payments: newest-wins watermark for provider snapshots.
ALTER TABLE "subscription_entitlements" ADD COLUMN     "last_fetched_at" TIMESTAMPTZ(6);

-- Sessions: access-token version (bumped on password reset / log out everywhere).
ALTER TABLE "users" ADD COLUMN     "token_version" INTEGER NOT NULL DEFAULT 0;

-- Brute force: per-account sign-in backoff, keyed by SHA-256 of the normalized
-- email (never the address).
CREATE TABLE "login_attempts" (
    "email_hash" CHAR(64) NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "last_failed_at" TIMESTAMPTZ(6) NOT NULL,
    "locked_until" TIMESTAMPTZ(6),

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("email_hash")
);

-- CreateIndex
CREATE INDEX "idx_login_attempts_last_failed" ON "login_attempts"("last_failed_at");
