-- ADR-P034 / FEATURE-012 S-1: server-authoritative entitlement mirror and
-- minimal RevenueCat webhook idempotency ledger. No receipts or raw provider
-- payloads are retained.

ALTER TYPE "AuditAction" ADD VALUE 'SUBSCRIPTION_ENTITLEMENT_CHANGE';
ALTER TYPE "AuditAction" ADD VALUE 'SUBSCRIPTION_PROVIDER_DELETE';

CREATE TYPE "SubscriptionWebhookStatus" AS ENUM (
  'RECEIVED',
  'PROCESSED',
  'IGNORED',
  'FAILED'
);

CREATE TABLE "subscription_entitlements" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "entitlement_id" VARCHAR(255) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "expires_at" TIMESTAMPTZ(6),
  "period_type" VARCHAR(32),
  "product_id" VARCHAR(255),
  "store" VARCHAR(32),
  "environment" VARCHAR(32),
  "will_renew" BOOLEAN,
  "last_provider_event_at" TIMESTAMPTZ(6),
  "last_reconciled_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "subscription_entitlements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subscription_webhook_events" (
  "id" VARCHAR(255) NOT NULL,
  "user_id" UUID,
  "event_type" VARCHAR(80) NOT NULL,
  "event_timestamp" TIMESTAMPTZ(6) NOT NULL,
  "environment" VARCHAR(32),
  "payload_hash" CHAR(64) NOT NULL,
  "status" "SubscriptionWebhookStatus" NOT NULL DEFAULT 'RECEIVED',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "failure_code" VARCHAR(64),
  "processed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "subscription_webhook_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chk_subscription_webhook_events_attempt_count"
    CHECK ("attempt_count" >= 0)
);

CREATE UNIQUE INDEX "uq_subscription_entitlements_user"
  ON "subscription_entitlements"("user_id");
CREATE INDEX "idx_subscription_entitlements_active_expires"
  ON "subscription_entitlements"("is_active", "expires_at");
CREATE INDEX "idx_subscription_webhook_events_status_created"
  ON "subscription_webhook_events"("status", "created_at");
CREATE INDEX "idx_subscription_webhook_events_user_created"
  ON "subscription_webhook_events"("user_id", "created_at");

ALTER TABLE "subscription_entitlements"
  ADD CONSTRAINT "fk_subscription_entitlements_user"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subscription_webhook_events"
  ADD CONSTRAINT "fk_subscription_webhook_events_user"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
