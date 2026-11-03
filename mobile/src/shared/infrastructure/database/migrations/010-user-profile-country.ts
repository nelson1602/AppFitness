import type { Migration } from './index';

/**
 * v8.1 — the person's country (ISO 3166-1 alpha-2) on the profile. Mirrors the
 * Prisma migration `20261102120000_user_profile_country`: NOT NULL DEFAULT 'DO',
 * so every existing row reads as the Dominican Republic (owner decision), and
 * the same two-uppercase-letters CHECK. Additive; no row is rewritten or
 * re-queued for sync.
 */
export const userProfileCountryMigration: Migration = {
  version: 10,
  name: 'user-profile-country',
  statements: [
    `ALTER TABLE user_profiles
       ADD COLUMN country TEXT NOT NULL DEFAULT 'DO'
       CHECK (length(country) = 2 AND country GLOB '[A-Z][A-Z]')`,
  ],
};
