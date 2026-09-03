-- ADR-P026 Vertical 2 (V2-A) — email verification schema.
--
-- Two additive changes: a nullable marker on users, and the verification-token
-- table. Mirrors migration 20260827120100 (password reset tokens), which in
-- turn mirrors the shipped refresh-token design (Phase 6): the raw 32-byte
-- base64url token is delivered ONLY in the emailed link, and only its SHA-256
-- hash is persisted, in a UNIQUE column. A database leak therefore exposes no
-- usable verification token.
--
-- Lifecycle columns:
--   consumed_at     single-use marker, set atomically on redemption
--   invalidated_at  superseded by a newer issuance
--
-- Two DIFFERENT notions, deliberately not conflated:
--   REDEEMABLE token  consumed_at IS NULL AND invalidated_at IS NULL
--                     AND expires_at > now()  — what V2-C must test on redemption.
--   OPEN row          consumed_at IS NULL AND invalidated_at IS NULL — what the
--                     partial unique index below constrains. An EXPIRED row is
--                     still OPEN: it is not redeemable, but it still occupies
--                     the user's single open slot.
--
-- Additive, expand-first and forward-only: a nullable column with no default
-- plus a new table and its constraints. No existing row is rewritten and no
-- existing table, column, or constraint is altered or dropped, so this
-- migration is safe to deploy ahead of the application code that uses it
-- (expand-first, api/DEPLOYMENT.md). Issuance, redemption and the soft-gate
-- reminder are V2-C / V2-D; nothing here changes runtime behaviour.

-- AlterTable
-- Legacy backfill is the absence of a write: every existing account receives
-- NULL naturally because the column is nullable with no default, and NULL means
-- legacy-unverified. No account is locked out (ADR-P026 Decision 10). No
-- DEFAULT, no NOT NULL, and no UPDATE — so this takes only a brief catalogue
-- lock and rewrites no heap pages.
ALTER TABLE "users" ADD COLUMN "email_verified_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "invalidated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_email_verification_tokens_token_hash" ON "email_verification_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "idx_email_verification_tokens_user" ON "email_verification_tokens"("user_id");

-- CreateIndex
CREATE INDEX "idx_email_verification_tokens_expires" ON "email_verification_tokens"("expires_at");

-- AddForeignKey
-- CASCADE matches refresh_tokens and password_reset_tokens: deleting an account
-- (ADR-P011) removes its verification tokens with it.
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "fk_email_verification_tokens_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
-- At most one OPEN row per user: unconsumed and uninvalidated, REGARDLESS of
-- expiry. The predicate deliberately omits `expires_at > now()` — now() is not
-- immutable, so PostgreSQL cannot use a time-varying expression in a partial
-- index predicate: the index would silently disagree with the heap as rows aged.
--
-- Consequence for V2-C: this index is a BACKSTOP, not a substitute for correct
-- service sequencing. Because an expired row still counts as OPEN, issuance
-- MUST opportunistically invalidate (set invalidated_at) or delete the user's
-- previous open row — INCLUDING AN EXPIRED ONE — before inserting a
-- replacement, or the insert is rejected with a unique violation. The index
-- guarantees the invariant holds; it does not sequence the writes, and no
-- locking strategy is assumed or implied here.
--
-- Consumed or invalidated rows fall out of the predicate, so verification
-- history is retained without bound.
--
-- Partial indexes are not expressible in schema.prisma (see the file header in
-- prisma/schema.prisma); like the initial migration's `... WHERE deleted_at IS
-- NULL` indexes, this is reviewed raw SQL. The index NAME retains "one_active_
-- per_user" for consistency with the shipped password-recovery precedent
-- (20260827120100); "open row" above is the precise reading of its predicate.
CREATE UNIQUE INDEX "uq_email_verification_tokens_one_active_per_user"
  ON "email_verification_tokens"("user_id")
  WHERE "consumed_at" IS NULL AND "invalidated_at" IS NULL;
