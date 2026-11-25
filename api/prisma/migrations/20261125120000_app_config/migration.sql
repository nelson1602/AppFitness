-- ADR-P049 amendment 1: app config the backoffice can change without a
-- release (maintenance banner, minimum Android versionCode). Additive only.

-- CreateTable
CREATE TABLE "app_config" (
    "id" VARCHAR(16) NOT NULL DEFAULT 'global',
    "maintenance_enabled" BOOLEAN NOT NULL DEFAULT false,
    "maintenance_tone" VARCHAR(16) NOT NULL DEFAULT 'warning',
    "maintenance_message_es" VARCHAR(300),
    "maintenance_message_en" VARCHAR(300),
    "min_android_version_code" INTEGER,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by_staff_id" UUID,

    CONSTRAINT "app_config_pkey" PRIMARY KEY ("id")
);

-- Exactly one row, with safe values: no banner, no minimum.
ALTER TABLE "app_config"
  ADD CONSTRAINT "ck_app_config_single_row" CHECK ("id" = 'global'),
  ADD CONSTRAINT "ck_app_config_tone" CHECK ("maintenance_tone" IN ('info', 'warning')),
  ADD CONSTRAINT "ck_app_config_min_version" CHECK ("min_android_version_code" IS NULL OR "min_android_version_code" > 0),
  ADD CONSTRAINT "ck_app_config_banner_text" CHECK (
    NOT "maintenance_enabled"
    OR ("maintenance_message_es" IS NOT NULL AND "maintenance_message_en" IS NOT NULL)
  );

INSERT INTO "app_config" ("id", "updated_at") VALUES ('global', CURRENT_TIMESTAMP);
