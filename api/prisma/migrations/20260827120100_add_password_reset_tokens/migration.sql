-- ADR-P026 Vertical 1 — password reset tokens.
--
-- Mirrors the shipped refresh-token design (Phase 6): the raw 32-byte
-- base64url token is delivered ONLY in the emailed link, and only its SHA-256
-- hash is persisted, in a UNIQUE column. A database leak therefore exposes no
-- usable reset token.
--
-- Lifecycle columns:
--   consumed_at     single-use marker, set atomically on redemption
--   invalidated_at  superseded by a newer issuance, or by a completed reset
-- A token is ACTIVE only while consumed_at IS NULL AND invalidated_at IS NULL
-- AND expires_at > now().
--
-- Additive and forward-only: a new table plus its constraints. No existing
-- table, column, or row is touched, so this migration is safe to deploy ahead
-- of the application code that uses it (expand-first, api/DEPLOYMENT.md).

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "invalidated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_password_reset_tokens_token_hash" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "idx_password_reset_tokens_user" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "idx_password_reset_tokens_expires" ON "password_reset_tokens"("expires_at");

-- AddForeignKey
-- CASCADE matches refresh_tokens: deleting an account (ADR-P011) removes its
-- reset tokens with it.
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "fk_password_reset_tokens_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
-- One-active-token-per-user, enforced by the database rather than trusted to
-- application sequencing. "Active" is exactly the predicate the redemption
-- path tests, so a second live token for the same user cannot be inserted even
-- if the service were bypassed or a concurrent issuance slipped past the
-- per-user row lock the service takes.
--
-- Partial indexes are not expressible in schema.prisma (see the file header in
-- prisma/schema.prisma); like the initial migration's `... WHERE deleted_at IS
-- NULL` indexes, this is reviewed raw SQL.
CREATE UNIQUE INDEX "uq_password_reset_tokens_one_active_per_user"
  ON "password_reset_tokens"("user_id")
  WHERE "consumed_at" IS NULL AND "invalidated_at" IS NULL;
