# AppFitness PostgreSQL Schema Design

Version: 1.0
Status: Active (Phase 3 baseline — live migration validation deferred)
Last Updated: 2026-07-03

---

# Purpose

Design record for the target PostgreSQL system-of-record schema
(ADR-0004), produced in migration Phase 3 (ADR-0013,
`.ai/13_MIGRATION_ROADMAP.md`). The authoritative implementation is
`api/prisma/schema.prisma` — this document records the rationale,
deviations, deferred work, and decisions that the schema file itself
cannot express.

The user-approved conceptual design (entities, relationships, indexes,
sync fields, security model) was delivered and accepted on 2026-07-03;
this document assumes that baseline and focuses on implementation-level
decisions.

---

# Schema Inventory

30 models, 16 enums, in `api/prisma/schema.prisma`:

* Identity/auth: `users`, `devices`, `refresh_tokens`
* Sync: `sync_operations`, `sync_conflicts`
* Audit: `audit_logs`
* Profile/goals: `user_profiles`, `goals`
* Medical: `medical_evaluations`, `medical_restrictions`, `health_logs`
* Workout: `exercises`, `routines`, `routine_exercises`,
  `workout_logs`, `workout_sets`
* Nutrition: `foods`, `nutrition_logs`, `meals`, `meal_items`
* Progress: `body_weights`, `body_measurements`, `progress_snapshots`
* Coach/engine: `recommendations`, `coach_insights`, `notifications`
* Gamification: `achievements`, `user_achievements`, `user_stats`

Every entity from the MVP schema (`server/prisma/schema.prisma`, 22
models) has a target-side equivalent. Coverage deltas, both deliberate:

* `RefreshToken.token` (raw) → `refresh_tokens.token_hash` — raw tokens
  are never stored server-side anymore; plus rotation-chain columns
  (`revoked_at`, `replaced_by_id`, `device_id`) for reuse detection.
* `UserProfile.injuries`/blood-pressure fields → moved to the medical
  domain (`medical_restrictions` structured model, `medical_evaluations`).
  Profile keeps training/lifestyle/target fields only.
* `UserProfile.primaryGoal/targetWeightKg/targetDate` → extracted to the
  history-preserving `goals` table.

# Key Implementation Decisions

## Prisma 7 (not 5.x)

`npm install` resolved Prisma **7.8.0** (current stable). Prisma 7
removed `url` from the schema datasource block — connection config now
lives in `api/prisma.config.ts`, and the runtime client requires a
driver adapter (`@prisma/adapter-pg`, to be installed when live DB work
is approved). Adopted rather than downgrading to the MVP's 5.x to avoid
a major-version upgrade mid-migration. Consequences:

* `prisma validate` / `prisma generate` run without any DB connection ✅
* `prisma migrate` (deferred) reads the URL from `prisma.config.ts` env
* Phase 6+ runtime needs `@prisma/adapter-pg` + `pg` (a future,
  explicitly-approved install)

## Raw SQL — SHIPPED (2026-07-03, Phase 5 pre-step)

The deferred raw SQL now lives in the initial migration
(`api/prisma/migrations/20260703181824_init/migration.sql`, hand-authored
section at the end) and was applied + behaviorally verified against a
disposable Docker Postgres 16 (`api/docker-compose.yml`, host port 5433):

1. **`sync_seq` assignment** — global sequence `sync_seq_global` +
   `assign_sync_seq()` BEFORE INSERT OR UPDATE triggers on all 23
   synchronized tables. Verified: assigns on insert, increments on
   update. The schema's `@default(0)` is overridden by the trigger.
2. **Partial indexes** — `WHERE deleted_at IS NULL` variants
   (`idx_*_live`) on the hot list-query paths.
3. **CHECK constraints** — full parity with the mobile SQLite DDL
   (positive measures, 0–100 percentages, BP/HR ranges, RPE 1–10,
   `version >= 1` on all versioned tables). Verified: invalid insert
   rejected.
4. **`audit_logs` immutability** — `reject_audit_mutation()` trigger on
   UPDATE/DELETE. Verified: UPDATE rejected, INSERT unaffected.

## Other decisions

* **UUIDv4 everywhere; client-generatable IDs** (`@id @db.Uuid` without
  a default) on every entity the mobile app can create offline;
  server-only rows (`recommendations`, `progress_snapshots`, catalogs)
  keep `@default(uuid())`.
* **Denormalized `user_id` on child tables** (`routine_exercises`,
  `workout_sets`, `meals`, `meal_items`) — deliberate: incremental sync
  pulls scope every table by `(user_id, sync_seq)` without joins.
* **`deleted_by`/`resolved_by`/`replaced_by_id` are plain UUID columns**,
  not FK relations — audit metadata, not navigable domain links.
* **No unique constraint on `foods.name`** (MVP had one): user-created
  custom foods may collide with catalog names; `is_verified` + nullable
  `created_by` distinguish catalog vs. custom.
* **`meals.type` is a `MealType` enum** (MVP used free strings
  "Breakfast"…). Enum evolution requires a migration — accepted
  trade-off, documented.
* **Dates are `@db.Date`** (MVP stored "YYYY-MM-DD" strings as a SQLite
  workaround).
* **`users.password_hash` is algorithm-agnostic** (PHC string), so
  Phase 6's bcrypt→Argon2 rehash-on-login needs no schema change.
* **`progress_snapshots` keeps derived weekly rollups** — a deliberate,
  documented materialization for iCoach trend analysis (approved in the
  Phase 3 design review).

## Supplements domain — resolved: no tables

Phase 0 flagged the MVP's supplements feature as "persistence unknown."
Inspection of `server/src/services/supplement.service.ts` (2026-07-03,
read-only) shows it is a pure rule engine: suggestions are computed
on-request from workout/profile/health data against a hardcoded in-code
catalog, with nothing persisted. Therefore the target schema needs **no
supplement tables**; the feature becomes deterministic iCoach rule logic
in Phase 9.

# Security Model (schema-level)

* `users.role` (USER/ADMIN) — RBAC foundation for Phase 6 guards.
* `users.status` includes `PENDING_DELETION` for the GDPR deletion flow;
  physical cleanup is retention-policy-driven, backend-only.
* Encrypted-at-rest medical free-text: `doctor_notes_enc`,
  `medical_conditions_enc`, `medications_enc`,
  `medical_restrictions.notes_enc` — `bytea` ciphertext with `enc_key_id`
  key-version tracking. Encryption mechanism is **ADR-P006 (Proposed —
  must be Accepted before Phase 8 writes real medical data)**.
* `audit_logs` metadata carries operational data only — never medical or
  personal field values.

# Migration Strategy (deferred execution)

1. When live-DB validation is approved: run `prisma migrate dev` against
   a disposable local PostgreSQL (Docker or native — owner's choice).
2. Hand-extend the generated SQL with the deferred raw SQL above; review
   line-by-line against `.ai/04_DATABASE.md`'s Database Quality Checklist.
3. Commit `api/prisma/migrations/` to git (verified: root `.gitignore`
   excludes only `server/prisma/migrations/` — the new path is tracked).
4. Historical migrations are never edited afterward (`.ai/04_DATABASE.md`).

# AI Instructions

* `api/prisma/schema.prisma` is the implementation source of truth; this
  document explains *why*. Update both together.
* Never run `prisma migrate` / connect to a database without explicit
  owner approval (live validation is deferred as of 2026-07-03).
* Do not weaken the universal sync column set or soft-delete model on
  any synchronized entity without an ADR.
* Phase 8 (medical data) is blocked on ADR-P006 acceptance.
