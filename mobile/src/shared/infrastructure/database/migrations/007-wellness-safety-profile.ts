import type { Migration } from './index';

/**
 * ADR-P017 **W-1** — Wellness Safety Profile contract and storage (SQLite).
 * Mirrors the Postgres migration `20260908120000_add_wellness_safety_profiles`.
 *
 * NEVER edit shipped migrations (`.ai/04_DATABASE.md`). Migration 006 shipped
 * with ADR-P030 C-1 and is immutable, so W-1 takes **007** — the first version
 * after it, exactly as ADR-P030 Decision 8 records.
 *
 * Forward-only and PURELY ADDITIVE: one new table plus its own indexes and
 * validation triggers, no change to any existing table, so no preflight data
 * guard is needed and every v6 row (including the C-1 user-scoped `sync_queue`
 * / `sync_state` / `sync_conflicts` rows) survives untouched.
 *
 * ── What this table holds ───────────────────────────────────────────────────
 * `wellness_safety_profiles` is a wellness-owned, per-user, synchronizable
 * aggregate: whether a professional physical evaluation was completed and when,
 * plus self-declared physical limitations as structured language-neutral
 * tokens. The contract, both closed token vocabularies and the invariants live
 * in `features/wellness/domain/wellness-safety-profile.ts`.
 *
 * It holds no provider identity, no evaluation result or finding, no clearance,
 * no diagnosis, no named condition, no medication, no treatment, no blood
 * pressure, no rehabilitation instruction, no symptom, no severity, no dosage,
 * no supplement data, no document and **no free-text column of any kind**. The
 * two token columns are allowlisted below, so an arbitrary clinical sentence
 * cannot be stored in them either. It is not the retained medical model: no
 * medical table, column, enum or row is read, copied or changed here, and they
 * all stay dormant under ADR-0011 / P001 / P006 / P011.
 *
 * ── Ownership ───────────────────────────────────────────────────────────────
 * Ownership is **structurally represented and cascade-protected**: `user_id` is
 * `NOT NULL`, references `local_user(id)`, and the row is erased with the
 * account. That is not access control — a query by `id` alone would still read
 * another account's row. **W-2 must apply the authenticated `user_id`
 * predicate to every read, write, delete, dirty-row scan, push and pull**, and
 * must ship explicit cross-user denial tests. W-1 adds no repository
 * behaviour.
 *
 * ── Representation ──────────────────────────────────────────────────────────
 * Both token lists are JSON-array `TEXT`, following the shipped
 * `user_profiles.equipment` precedent (`001-initial.ts`) — the established way
 * this schema stores a language-neutral token array, since SQLite has no array
 * type. Keeping them inline keeps the profile ONE atomic sync entity: a device
 * can never publish the evaluation flag and the limitations as two
 * independently ordered changes, and a per-token child table would multiply the
 * sync surface for tokens that carry no state of their own. The Postgres side
 * stores the same tokens as `text[]`, so the sync mapping is a pure
 * serialization.
 *
 * ── What the database enforces ──────────────────────────────────────────────
 * At most one LIVE profile per user (partial unique index); evaluation
 * flag/date consistency; `YYYY-MM-DD` shape via a deterministic `GLOB`;
 * JSON-array shape and a bounded length for both lists; the standard
 * `version >= 1` and `sync_status` constraints; FK ownership with cascade; and
 * — through the two `BEFORE INSERT` / `BEFORE UPDATE` triggers below — that
 * **every element of both lists is JSON text drawn from its closed
 * vocabulary**. A CHECK cannot express that: per-element validation needs
 * `json_each`, which is a subquery. Unknown tokens, uppercase variants, blank
 * strings, numbers, booleans, `null` and nested arrays/objects are all
 * rejected, so a lowercase clinical sentence cannot be stored either.
 *
 * Deliberately NOT enforced: "the evaluation date is not in the future" —
 * clock-dependent, so a CHECK would let a stored row's validity change over
 * time. That, calendar validity (e.g. 2026-02-31) and the
 * trim/lowercase/deduplicate/sort normalization remain application validation
 * owned by W-2/W-3: the database rejects an invalid token but neither reorders
 * nor de-duplicates a valid one. A vocabulary change needs a new forward-only
 * migration on both sides.
 *
 * SCHEMA ONLY: no repository, store, sync applier, entity registration,
 * composition-root wiring, UI or iCoach input (W-2 … W-4).
 */

/**
 * The closed vocabularies, as SQL literal lists.
 *
 * They are written out here rather than imported so the migration stays a
 * self-contained snapshot of the contract at version 007 — a later contract
 * edit must add a new migration instead of silently changing this one.
 * `wellness-safety-profile.spec.ts` asserts these lists match the TypeScript
 * contract exactly.
 */
const AFFECTED_AREAS = [
  'abdomen',
  'ankle',
  'chest',
  'elbow',
  'foot',
  'forearm',
  'groin',
  'hand',
  'hip',
  'knee',
  'lower_back',
  'lower_leg',
  'neck',
  'shoulder',
  'thigh',
  'upper_arm',
  'upper_back',
  'wrist',
];

const MOVEMENTS_TO_AVOID = [
  'bridging',
  'deep_squat',
  'dips',
  'front_rack_loading',
  'good_morning',
  'heavy_hinge',
  'heavy_pressing',
  'high_impact_cardio',
  'jumping',
  'loaded_carries',
  'loaded_spinal_flexion',
  'lunge',
  'max_effort_lifts',
  'overhead_press',
  'running',
  'skull_crushers',
  'sprinting',
  'valsalva_heavy_lifts',
];

const asSqlList = (tokens: readonly string[]): string =>
  tokens.map((token) => `'${token}'`).join(',');

/**
 * `EXISTS` over the elements of one token column that are not JSON text or not
 * in the allowed set. `json_each` flattens only the top level, so a nested
 * array or object element is reported with its own type and rejected.
 */
const invalidElements = (column: string, tokens: readonly string[]): string =>
  `EXISTS (
         SELECT 1 FROM json_each(NEW.${column})
          WHERE json_each.type != 'text'
             OR json_each.value NOT IN (${asSqlList(tokens)})
       )`;

const tokenGuard = (event: 'INSERT' | 'UPDATE'): string =>
  `CREATE TRIGGER trg_wellness_safety_profiles_tokens_${event.toLowerCase()}
     BEFORE ${event} ON wellness_safety_profiles
     FOR EACH ROW
     WHEN ${invalidElements('affected_areas', AFFECTED_AREAS)}
       OR ${invalidElements('movements_to_avoid', MOVEMENTS_TO_AVOID)}
   BEGIN
     SELECT RAISE(ABORT, 'wellness_safety_profiles: token outside the allowed vocabulary');
   END`;

export const wellnessSafetyProfileMigration: Migration = {
  version: 7,
  name: 'wellness-safety-profile',
  statements: [
    `CREATE TABLE wellness_safety_profiles (
      id                   TEXT PRIMARY KEY NOT NULL,
      user_id              TEXT NOT NULL REFERENCES local_user(id) ON DELETE CASCADE,
      created_at           TEXT NOT NULL,
      updated_at           TEXT NOT NULL,
      version              INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
      deleted_at           TEXT,
      deleted_by           TEXT,
      sync_status          TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending','synced','conflict')),
      -- Whether the user reports a completed professional evaluation. The flag
      -- and its date only: never a result, finding, provider or clearance.
      evaluation_completed INTEGER NOT NULL DEFAULT 0 CHECK (evaluation_completed IN (0,1)),
      -- ISO-8601 calendar date, YYYY-MM-DD (the 001-initial date convention).
      -- GLOB is deterministic, so it is CHECK-safe; date() is not.
      evaluation_date      TEXT
                             CHECK (evaluation_date IS NULL
                                    OR evaluation_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
      -- Self-declared limitations. Structured tokens only, empty array never
      -- null, bounded (WELLNESS_TOKEN_LIST_MAX). Element-level vocabulary
      -- validation lives in the triggers below (a CHECK cannot subquery).
      affected_areas       TEXT NOT NULL DEFAULT '[]'
                             CHECK (json_valid(affected_areas)
                                    AND json_type(affected_areas) = 'array'
                                    AND json_array_length(affected_areas) <= 64),
      movements_to_avoid   TEXT NOT NULL DEFAULT '[]'
                             CHECK (json_valid(movements_to_avoid)
                                    AND json_type(movements_to_avoid) = 'array'
                                    AND json_array_length(movements_to_avoid) <= 64),
      -- Completion and its date move together in both directions.
      CHECK ((evaluation_completed = 0 AND evaluation_date IS NULL)
             OR (evaluation_completed = 1 AND evaluation_date IS NOT NULL))
    )`,
    // Zero or one ACTIVE profile per user. Tombstones may accumulate so a
    // delete still syncs; only the live row is constrained.
    `CREATE UNIQUE INDEX uq_wellness_safety_profiles_user_live
       ON wellness_safety_profiles (user_id) WHERE deleted_at IS NULL`,
    // Dirty-row scan for the future sync worker. Composite and user-scoped
    // because every W-2 scan is per authenticated account, so `user_id` must
    // lead: a status-only index would invite an unscoped scan.
    `CREATE INDEX idx_wellness_safety_profiles_user_dirty
       ON wellness_safety_profiles (user_id, sync_status) WHERE sync_status != 'synced'`,
    // Closed-vocabulary enforcement, on both write paths.
    tokenGuard('INSERT'),
    tokenGuard('UPDATE'),
  ],
};
