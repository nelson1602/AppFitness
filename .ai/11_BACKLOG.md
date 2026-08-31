# AppFitness Backlog Management

Version: 1.1
Status: Active
Last Updated: 2026-07-07

---

# Purpose

This document is the official backlog management system for AppFitness.

It is used to track:

* Features
* Bugs
* Technical debt
* Refactors
* Security tasks
* Performance improvements
* Documentation tasks
* Testing tasks
* Research items
* Future ideas

This file must remain organized, prioritized, and updated as the project evolves.

---

# Backlog Philosophy

The backlog exists to keep work visible, intentional, and prioritized.

No task should be implemented only because it seems interesting.

Every task must support:

* Product value
* User safety
* Data integrity
* Security
* Maintainability
* Performance
* Scalability
* Developer productivity

---

# Priority Levels

## P0 — Critical

Must be addressed immediately.

Examples:

* Data loss
* Security vulnerability
* Authentication failure
* Broken synchronization
* App crash on startup
* Production outage
* Health data corruption

---

## P1 — High

Important and should be addressed soon.

Examples:

* Core feature broken
* Offline mode unreliable
* iCoach calculation issue
* Major performance problem
* Important UX blocker
* Missing validation

---

## P2 — Medium

Important but not urgent.

Examples:

* UX improvements
* Refactoring
* Non-critical bugs
* Test coverage improvements
* Documentation improvements
* Performance tuning

---

## P3 — Low

Nice-to-have.

Examples:

* Visual polish
* Minor usability improvements
* Future enhancements
* Optional automation
* Internal tooling

---

# Task Status

Use the following statuses:

## Proposed

Idea or task not yet approved.

## Approved

Task accepted and ready for planning.

## In Progress

Currently being worked on.

## Blocked

Cannot proceed due to dependency or missing information.

## Review

Implementation completed and awaiting review.

## Done

Completed, tested, and documented.

## Rejected

Reviewed and intentionally not pursued.

---

# Task Template

Use this template for every backlog item.

```md
## [ID] Task Title

Status: Proposed  
Priority: P2  
Type: Feature | Bug | Refactor | Security | Performance | Testing | Documentation | Research  
Owner: Unassigned  
Created: YYYY-MM-DD  
Updated: YYYY-MM-DD  

### Description

Clear explanation of the task.

### Problem

What problem does this solve?

### Expected Outcome

What should be true when this task is complete?

### Scope

Included:

- Item 1
- Item 2

Excluded:

- Item 1
- Item 2

### Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

### Technical Notes

Relevant technical information.

### Risks

- Risk 1
- Risk 2

### Dependencies

- Dependency 1
- Dependency 2

### Related Documents

- .ai/00_PROJECT.md
- .ai/01_ARCHITECTURE.md
```

---

# Migration Backlog

## [MIGRATION-001] Web MVP to Mobile Offline-First Migration

Status: Approved
Priority: P0
Type: Feature
Owner: Unassigned
Created: 2026-07-03
Updated: 2026-07-03

### Description

Migrate AppFitness from the current Vite + React + Express + SQLite web
MVP to the target React Native + Expo + NestJS + PostgreSQL offline-first
mobile architecture defined across `.ai/*`, per ADR-0013.

### Problem

The current MVP diverges from the documented target architecture across
platform, backend framework, database strategy, offline-first
synchronization, and the deterministic iCoach engine. This item tracks
the overarching migration initiative.

### Expected Outcome

The mobile app and NestJS/PostgreSQL backend reach functional parity
with the current MVP and satisfy ADR-0013's acceptance criteria, executed
incrementally without disrupting the existing MVP.

### Scope

Included:

- All 12 migration phases defined in `.ai/13_MIGRATION_ROADMAP.md`

Excluded:

- Detailed phase-level task tracking (tracked in the roadmap document,
  not duplicated here)
- Decommissioning of the existing MVP (requires separate explicit
  approval per ADR-0013)

### Acceptance Criteria

- [ ] All phases in `.ai/13_MIGRATION_ROADMAP.md` meet their exit criteria
- [ ] ADR-0013 acceptance criteria satisfied
- [ ] Existing MVP (`client/`, `server/`) remains untouched and
      operational throughout the migration

### Technical Notes

See `.ai/13_MIGRATION_ROADMAP.md` for phase-by-phase objectives,
dependencies, risks, validation commands, and exit criteria. Update
phase status in the roadmap document itself — do not duplicate phase
detail here.

### Risks

- Dual maintenance of the MVP and the new stack during the transition
- Sensitive medical data handling (Phase 8) requires ADR-P001 resolution
  first
- Password hashing migration (bcrypt to Argon2) requires a
  rehash-on-login strategy

### Dependencies

- ADR-0013 (Accepted)
- ADR-P001 (SQLite Encryption Strategy) — must resolve before Phase 4/8

### Related Documents

- .ai/12_DECISIONS.md (ADR-0013)
- .ai/13_MIGRATION_ROADMAP.md

---

# Feature Backlog

## [FEATURE-001] Mobile Architecture Foundation

Status: Proposed
Priority: P1
Type: Feature
Owner: Unassigned
Created: 2026-07-03
Updated: 2026-07-03

### Description

Define and implement the initial React Native + Expo architecture for AppFitness.

### Problem

The project needs a scalable mobile foundation before implementing advanced features.

### Expected Outcome

A production-ready mobile structure aligned with Clean Architecture, DDD, Feature-First organization, and offline-first principles.

### Acceptance Criteria

* [ ] Expo project structure validated
* [ ] Feature-first folder organization created
* [ ] TypeScript strict mode enabled
* [ ] Navigation strategy defined
* [ ] State management strategy confirmed
* [ ] SQLite access layer planned
* [ ] No business logic placed inside UI components

### Related Documents

* .ai/01_ARCHITECTURE.md
* .ai/06_MOBILE.md

---

## [FEATURE-002] Medical Evaluation Module

Status: Proposed
Priority: P1
Type: Feature
Owner: Unassigned
Created: 2026-07-03
Updated: 2026-07-03

### Description

Create the module where users enter doctor-provided physical and medical evaluation data.

### Expected Outcome

Users can safely store medical and physical metrics locally and prepare them for synchronization.

### Acceptance Criteria

* [ ] User can enter height, weight, body fat, muscle mass, blood pressure, injuries, restrictions, and doctor notes
* [ ] Sensitive data is stored securely
* [ ] Data is saved locally first
* [ ] Historical records are preserved
* [ ] Validation rules are enforced
* [ ] iCoach can consume evaluation data

### Related Documents

* .ai/04_DATABASE.md
* .ai/05_SECURITY.md
* .ai/07_ICOACH.md

---

## [FEATURE-003] Deterministic iCoach Engine

Status: Proposed
Priority: P1
Type: Feature
Owner: Unassigned
Created: 2026-07-03
Updated: 2026-07-03

### Description

Implement the deterministic local iCoach Engine.

### Expected Outcome

The app generates explainable recommendations based on deterministic TypeScript rules.

### Acceptance Criteria

* [ ] Engine runs offline
* [ ] Outputs are deterministic
* [ ] Recommendations are explainable
* [ ] Rules are versioned
* [ ] Historical recommendations are preserved
* [ ] Medical restrictions override performance goals
* [ ] Unit tests cover core rules

### Related Documents

* .ai/07_ICOACH.md
* .ai/09_TESTING.md

---

## [FEATURE-004] Offline Sync Queue

Status: Proposed
Priority: P1
Type: Feature
Owner: Unassigned
Created: 2026-07-03
Updated: 2026-07-03

### Description

Create the synchronization queue that stores local changes and sends them to the backend when connectivity is available.

### Expected Outcome

The app remains usable offline for up to 48 hours and synchronizes safely when online.

### Acceptance Criteria

* [ ] Local changes generate sync queue items
* [ ] Queue supports retries
* [ ] Queue is idempotent
* [ ] Failed sync attempts are tracked
* [ ] Conflicts are detected
* [ ] Critical health data is not overwritten automatically

### Related Documents

* .ai/04_DATABASE.md
* .ai/06_MOBILE.md

---

## [FEATURE-005] Product-Completion Continuation (Phases 13–20)

Status: Approved (planning)
Priority: P1
Type: Feature
Owner: Unassigned
Created: 2026-07-09
Updated: 2026-08-05

> **Phase 20 (Store-Submission Re-Gate) STARTED 2026-08-05.** Phases 13–17 are
> complete and E2E-verified (Progress Monitoring / ADR-P016 done, `mobile-e2e`
> run 31008855392 green on `d5fa45c`). **Slice 1 (docs-only re-gate audit)**
> refreshed `docs/RELEASE_READINESS.md`: in-repo engineering = COMPLETE; open
> gates are all owner/external (Sentry, legal sign-off, Play listing/Data
> Safety/privacy URL, Production env, rollback dry-run, production smoke, mobile
> production validation, submission approval). Phases 18/19 remain post-v1. See
> ADR-P016 and `13_MIGRATION_ROADMAP.md` "Phase 20".

### Description

Tracks the post-migration product-completion work identified by the
2026-07-09 re-audit: closing the gap between the Phase 0–12 foundation and
the full `00_PROJECT.md` §Product Scope. Phase-level detail lives in
`.ai/13_MIGRATION_ROADMAP.md` (Phases 13–20) and is not duplicated here.

### Problem

Profile/goal/medical layers are foundation-only (no entry UI) and
nutrition/workout/progress/habit/notification capabilities are unbuilt, so
the app is not yet meaningfully testable by real users (see
`docs/RELEASE_READINESS.md` verdict 2/4).

### Scope

Included (roadmap Phases 13–20): profile/goal entry UI (13), evaluation
entry UI (14), nutrition (15), workout (16), progress (17), habits (18),
notifications (19), store-submission re-gate (20). Boundaries:
internal-test = 13–14; commercial v1 = 13–17; post-v1 = 18–19.

### Relationship to existing items (no duplication)

- **FEATURE-002** (Medical Evaluation Module) — its UI delivery is roadmap
  Phase 14; the module foundation shipped in migration Phase 8.
- **FEATURE-003/004** (iCoach engine / sync queue) — complete; consumed by
  these phases, not re-done.
- **TEST-004** — the deferred E2E flows (login, evaluation-entry,
  offline-entry, plan-generation) are closed by Phases 13–14/15–16.
- **RELEASE-001** — store readiness; its external gates + Phase 20 re-gate
  remain the submission path.

### Acceptance Criteria

- [ ] Each of roadmap Phases 13–20 meets its own Exit Criteria.
- [ ] `docs/RELEASE_READINESS.md` product-completeness verdict reaches the
      v1 boundary (Phases 13–17) before store submission.

### Related Documents

- .ai/00_PROJECT.md (§Product Scope)
- .ai/13_MIGRATION_ROADMAP.md (Phases 13–20)
- docs/RELEASE_READINESS.md

---

## [FEATURE-006] Dietary Preferences, Allergies, and Food Exclusions

Status: **Approved — ADR-P014 Accepted (Option A, 2026-07-16 by project
owner); implementation AUTHORIZED but NOT STARTED.** Each slice below still
needs its own scoped owner authorization to land.
Priority: P2
Type: Feature

### Problem

Users need to indicate foods / food categories they cannot or will not eat.
The catalog already carries `avoidFor` tags and the meal generator already
excludes via `excludeAvoidTags`, but there is no user-facing model, UI,
persistence, or sync for dietary preferences or allergies, and clinical
medical restrictions do not map to nutrition avoid tags
(`restriction-map.ts` returns `[]` today). This is the "separate future
slice" deliberately carved out of the 2026-07-16 nutrition data-gap UX
correction.

### Decision gate — ACCEPTED

**ADR-P014 was Accepted (Option A) on 2026-07-16 by the project owner.** The
accepted design: a nutrition-domain `DietaryPreference` entity (avoid tags +
explicit catalogKey exclusions + per-item allergy vs preference `kind`),
synced offline-first, with allergies treated as health-sensitive (ADR-0011)
and preferences as wellness; meal plans stay deterministic and reflect
exclusions via `avoidFor` / `excludeAvoidTags` + a new catalogKey exclusion;
logging an excluded food warns but never hard-blocks. See ADR-P014 for the
full decision + acceptance resolution. **Implementation authorized, not
started.**

### Implementation slices (authorized; each needs its own scoped go-ahead)

- **Slice 1 — Schema + contract foundation — IMPLEMENTED 2026-07-16 (not yet
  committed at time of writing):** additive forward-only SQLite migration
  `003-dietary-preferences` + Postgres migration
  `20260716120000_add_dietary_preferences` creating a nutrition-domain
  `dietary_preferences` table (SYNCED-columns + `exclusion_type`
  avoid_tag/catalog_key, `avoid_tag`, `catalog_key`, `kind`
  allergy/preference, encrypted `note_enc`/`enc_key_id`, CHECK: exactly one
  target matching type); Prisma `DietaryPreference` model + `User` reverse
  relation; mobile `DietaryPreferenceRow` type + nutrition-domain
  `DietaryPreference` contract + pure `rowToDietaryPreference` mapper + test.
  **No behavior change: no repository/store/sync-applier, no backend sync
  handler/mapper/module wiring, no UI, no meal-plan/food-log use.** The
  mobile repository/store + sync-applier registration and the backend
  NestJS sync handler are intentionally deferred to **Slice 2**, where they
  are exercisable and testable end-to-end with a data producer/consumer.
- **Slice 2A — Repository/store + backend sync handler (NO UI) — IMPLEMENTED
  2026-07-16 (not yet committed at time of writing):** mobile
  `dietary-preference.repository` (create / listActive / soft-delete /
  applyServer / markConflict; encrypts the optional note, enqueues sync ops
  in-transaction, marked `sensitive`), `dietary-preference.service`
  (session-scoped) + `dietary-preference.store` (load/add/remove), and
  `dietary_preferences` sync-applier registration; backend
  payload/mapper/repository/`DietaryPreferenceSyncHandler` (ownership-scoped
  CREATE/UPDATE/DELETE, version/conflict via the pipeline, AES-256-GCM note
  encryption + conflict redaction, ADR-P006) registered in the nutrition
  module; plus a forward-only Postgres migration
  `20260716130000_dietary_preferences_sync_seq_trigger` attaching the
  `sync_seq` trigger the Slice 1 table was missing. Focused tests: mobile
  repo (create/list/soft-delete/enqueue + note-encryption safety), store
  orchestration, backend handler (ownership/version/CREATE-validation/
  UPDATE/DELETE/pull/redaction), sync registration via the module.
  **No UI, no meal-plan wiring, no food-log behavior.**
- **Slice 2B — Preference/allergy UI — IMPLEMENTED 2026-07-16 (not yet
  committed at time of writing):** session-guarded `/dietary-preferences`
  route + `DietaryPreferences` management screen binding to the Slice 2A store
  (`load`/`add`/`remove`) — view active exclusions, add an avoid-tag category
  exclusion (closed `AVOID_TAGS` vocabulary) or an explicit catalog-food
  exclusion (search/select over the committed canonical catalog), classify as
  allergy/sensitivity or preference/dislike (`kind`), optional encrypted note,
  and soft-delete/remove; plus a "Dietary preferences" dashboard entry point
  and user copy (personalizes meal planning, not emergency medical advice,
  saved locally first then synced, plan may not change until Slice 3). All
  persistence routes through the store → service → repository; the UI never
  touches SQLite. Focused tests: route guard (unknown/anonymous/authenticated),
  screen loading/empty/list states, add-avoidTag flow, add-explicit-food-
  exclusion flow, remove flow, dashboard navigation entry, and a no-direct-
  SQLite-access guard. **No meal-plan wiring, no food-log behavior.**
- **Slice 3 — Meal-plan integration + deterministic regeneration/explanations
  — IMPLEMENTED 2026-07-16 (not yet committed at time of writing):** the
  meal-plan service now loads the user's active dietary preferences and
  collapses them (via pure `toMealExclusions`) into deterministic, sorted,
  deduped avoid-tag + explicit-catalogKey exclusion sets. `MealPlanInput`
  gained `excludeCatalogKeys`; the pure generator removes any food whose
  catalog id is excluded (alongside the existing avoidFor-tag exclusion) from
  every selection pool, and the `MealPlan` output now carries
  `excludedCatalogKeys` plus a conditional exclusion clause in its rationale.
  `buildMealSeed` folds the sorted exclusion sets into the seed **only when
  present**, so changing exclusions deterministically re-seeds/regenerates the
  plan while a user with no preferences keeps their exact pre-Slice-3
  seed/plan. `NutritionPlanScreen` loads preferences (additive: on
  loading/error it still builds with no exclusions), gates the loading state
  on the preference store, and renders an "applied exclusions" explanation
  card with the non-medical disclaimer intact. Generator stays PURE (no
  Date.now/Math.random/network/storage). Focused tests: generator excludes
  avoidTag foods, generator excludes explicit catalogKey foods, deterministic
  for identical exclusions + changes when exclusions change, service
  `toMealExclusions`/seed/`selectMealPlan` preference application, ready state
  unchanged when no preferences exist, screen loads/applies preferences +
  safe loading/error states. **No schema/backend/sync-protocol changes; no
  food-log warning behavior (Slice 4).**
- **Slice 4 — Food-log warning behavior + E2E validation — IMPLEMENTED
  2026-07-16 (unit/component; E2E PENDING a build — not yet committed at time
  of writing):** a pure `matchFoodExclusion(food, preferences)` domain helper
  answers whether a catalog food touches an active exclusion (its `avoidFor`
  intersects an active avoid-tag, or its catalog key is explicitly excluded)
  and returns a safety-first severity (`allergy` when ANY matching preference
  is an allergy/sensitivity, else `preference`). `FoodLogAddForm` shows a
  **non-blocking** warning banner when the selected food matches — stronger
  allergy/sensitivity wording ("…not emergency medical advice") vs softer
  preference/dislike wording — and the user can STILL log the food (submit
  path unchanged). `FoodLogScreen` loads active preferences (advisory only:
  loading/error → no warning, never blocks the log) and passes them to the
  form. **Persistence is untouched:** no change to the logged meal-item
  snapshot/write, sync payloads, or repository/schema. Focused tests: matcher
  (avoidTag/catalogKey/severity/no-match), form (avoidTag warning, catalogKey
  warning, allergy copy, preference copy, still-loggable, no-warning-without-
  match, unchanged default behavior), screen (loads preferences, surfaces the
  warning). **E2E: VERIFIED GREEN** — the `food-log-exclusion-warning.yml`
  Maestro flow (wired into `mobile-e2e.yml` after `food-log.yml`, same onboard
  session) passed on-device on **2026-07-16** in workflow run
  [29535207942](https://github.com/nelson1602/AppFitness/actions/runs/29535207942)
  (workflow commit `e2646b1`) against EAS `e2e` APK build
  `59c5e892-69ca-4a1b-9c71-4a52ee5ef298` (built from commit `cf035fa`, which
  contains the Slice 4 warning UI). The flow adds a "Nuts" allergy, opens the
  food log, selects a nut food (Almonds), sees the allergy/sensitivity warning
  banner + non-medical disclaimer, and STILL logs the food (non-blocking
  confirmed). **No schema/backend/sync-protocol/catalog-sourcing/ADR-P013
  changes.**

### Acceptance Criteria

- [x] Owner accepts an ADR-P014 option before any implementation begins.
      (Option A accepted 2026-07-16.)
- [x] Allergy vs preference sensitivity split honored per ADR-0011.
      (Slice 2A: `kind` + AES-256-GCM note encryption + conflict redaction.)
- [x] Meal plans remain deterministic when exclusions change.
      (Slice 3: exclusions folded into the seed + pure generator; identical
      exclusions → deep-equal plan, changed exclusions → re-seeded plan.)
- [x] Logging an excluded food warns but never hard-blocks or silently drops.
      (Slice 4: `matchFoodExclusion` + non-blocking `FoodLogAddForm` banner;
      submit/persistence path unchanged. E2E flow pending a new e2e APK build.)
- [ ] Additive migrations only; existing users default to no exclusions.

### Related Documents

- .ai/12_DECISIONS.md — ADR-P014 (this decision gate), ADR-P012, ADR-0011
- mobile/src/features/nutrition/domain/food-catalog.ts / restriction-map.ts / application/meal-generator.ts

---

## [FEATURE-007] Workout Module (Phase 16)

Status: **ADR-P015 ACCEPTED (2026-07-17).** **Slice 1 audit COMPLETE
(2026-07-17, docs-only)** — schema clean, no migration needed; mapping = Option
C (hybrid bundled). **Slice 2 COMPLETE (2026-07-17, foundation only)** —
bundled `exercise-catalog@0.1.0` (built-in exercises + movement-pattern/
equipment/body-area attributes + pure `matchExerciseExclusion` matcher) under
`mobile/src/features/workout/`; no backend/repo/UI. **Slice 3 COMPLETE
(2026-07-17):** backend sync handlers for routines / routine_exercises /
workout_logs / workout_sets (`api/src/modules/workout/`), registered in the
sync pipeline; custom-exercise push deferred to Slice 3B. **Slice 4A COMPLETE
(2026-07-17):** mobile routines + workout_logs repository/service/store
(`mobile/src/features/workout/`), offline-first with sync enqueue + pull
appliers; no UI. **Exercise identity + seed slice COMPLETE (2026-07-17):**
built-in exercises now carry a precomputed stable UUIDv5 id
(`uuidv5(key:EXERCISE_REVISION)` under a shared `WORKOUT_UUID_NAMESPACE`,
ADR-P012-style), and are seeded into `exercises` idempotently on both sides —
mobile `seedBuiltInExercises`/`ensureBuiltInExerciseSeeded` (`INSERT OR IGNORE`,
never overwrites custom) and a backend `prisma/seed/seed-exercise-catalog.ts`
artifact (upsert insert-only) from `prisma/seed/exercise-catalog.json`.
Mobile (pure-JS) and backend (Node-crypto) derive byte-identical ids
(parity-tested). This unblocks the FK. **Slice 4B COMPLETE (2026-07-17):**
mobile routine_exercises + workout_sets repository/service/store
(`mobile/src/features/workout/`), offline-first (local-first writes,
client-UUIDs, soft-delete, version/`sync_status`, sync-queue enqueue for the
Slice 3 handlers, pull appliers), with the built-in exercise seeded in-transaction
before each FK write (`ensureBuiltInExerciseSeeded`) and non-built-in exercises
rejected (custom deferred to Slice 3B). No UI. **Slice 5 COMPLETE (2026-07-17):**
routine builder UI — a session-guarded `/routines` route + dashboard entry point
+ `RoutineBuilder` screen that lists/creates/soft-deletes routines and adds/
removes built-in exercises via the Slice 4A/4B store (UI never touches SQLite),
reading the deterministic iCoach `TrainingPlan` (from the dashboard store, never
recomputed) to surface a blocked/clearance notice and non-blocking
excluded-movement cautions. **Slice 6 COMPLETE (2026-07-17):** workout logging UI
— a session-guarded `/workout-log` route + dashboard entry point +
`WorkoutLogScreen` that starts ad-hoc/from-routine workouts, logs/edits/removes
sets against built-in exercises, and finishes/soft-deletes logs via the Slice
4A/4B store (UI never touches SQLite; local-first with per-row "pending sync"
hints and the same read-only `TrainingPlan` safety surface). **Slice 7 COMPLETE
(2026-07-20):** iCoach `TrainingPlan` integration — a shared, deterministic
read-only `toTrainingGuidance` view model (medical priority
`blocked > clearance > ready`, safe `unknown` fallback), a `useTrainingPlan` hook
over the dashboard store, and shared `TrainingPlanCard` / `ExerciseExclusionNote`
components consumed by both workout screens (guidance + blocked/clearance states +
non-blocking excluded-movement warnings; never recomputed or overridden). **Slice
3B COMPLETE (2026-07-21):** custom user-owned exercise push — Option 1 (owner-scoped
`exercises.name` uniqueness) accepted; one forward-only, data-safe migration
(`20260721120000_workout_custom_exercise_name_scope`: drop global `uq_exercises_name`;
add per-owner `uq_exercises_created_by_name`, partial `uq_exercises_global_name`
where `created_by IS NULL`, and `idx_exercises_created_by_syncseq`). Backend
`ExerciseSyncHandler` (`entityType "exercises"`, owner-scoped by `created_by`,
built-in/cross-user mutation rejected, `instructions` redacted in conflicts);
mobile custom-exercise repository/service/store/applier + enqueue, per-owner
duplicate validation, soft-delete via `deleted_at` only; child `routine_exercises`/
`workout_sets` now accept owned custom ids (built-in seeded or owned custom
verified; unknown id fails safely with `DEPENDENCY_NOT_READY` retry preserved for
not-yet-synced customs). No UI (a custom-exercise builder UI is a separate future
slice); no `deleted_by` added; ADR-P013/nutrition untouched. **E2E remains Slice
8.** **Slice 9 COMPLETE (2026-07-21):** custom-exercise UI — dedicated
session-guarded `/exercises` Exercise library, dashboard entry point, inline
quick-create from routine/workout pickers, grouped Built-in/My exercises lists,
edit/delete of user-owned custom exercises, owner-scoped duplicate-name UX,
pending/conflict hints, non-medical iCoach-neutral caution, and
`"(removed exercise)"` fallback for deleted/missing customs. No schema/backend
sync/dependency/ADR-P013/nutrition change; Maestro/E2E deferred to a future
slice. Each remaining item needs its own explicit authorization.

**Slice 1 findings (2026-07-17).** Read-only audit of the dormant workout
tables on both sides:
- **Postgres:** all five tables (`exercises`/`routines`/`routine_exercises`/
  `workout_logs`/`workout_sets`) are in the init-migration `assign_sync_seq()`
  trigger loop — each already has its `trg_<t>_sync_seq` trigger + version
  CHECK. **No missing trigger; no forward-only migration required.**
- **Mobile SQLite:** all five present in `001-initial.ts` (`exercises` =
  `CATALOG_COLS`; others = `SYNCED_COLS`) with entity + dirty indexes and
  matching row types; `order_index`↔`order` divergence documented.
- **Consistent** with the nutrition/medical/profile pattern (mobile
  `sync_status` ↔ Postgres `sync_seq` trigger). **D1 resolved: dormant tables
  sufficient as-is.**
- **Movement-pattern mapping = Option C (hybrid):** built-in exercises carry a
  versioned in-repo bundled mapping (attributes + contraindication →
  `excludedMovements`); custom exercises neutral/unmapped (no medical
  authority). **No `exercises` columns added; Option A deferred as a future
  additive-only fallback.** No Slice 1B needed.
See ADR-P015 "Slice 1 Audit Resolution (2026-07-17)" in `.ai/12_DECISIONS.md`.

### Summary
Exercise catalog + user routines + workout logging, offline-first, consuming
the deterministic iCoach `TrainingPlan` (no recompute, no medical override).
See **ADR-P015 — Workout Module (Phase 16)** in `.ai/12_DECISIONS.md` for the
full gate (audit findings, decisions D1–D5, slice plan, acceptance criteria).

### Audit findings (planning gate)
- **Dormant tables already exist and are sync-shaped:** `exercises` (global +
  custom), `routines`, `routine_exercises`, `workout_logs`, `workout_sets` —
  all with client-UUIDs, denormalized `userId`, `version`/`deletedAt`/
  `syncSeq`, `[userId, syncSeq]` indexes (nutrition sync pattern).
- **iCoach `TrainingPlan`** already emits `{ blocked, requiresMedicalClearance,
  intensity, rpeCap, daysPerWeek, excludedMovements[] }` deterministically, with
  absolute medical priority — the module consumes it, never recomputes it.
- **Gap:** `exercises` has only `muscleGroup` + `category`; no
  `movementPattern`/`equipment`/`bodyArea`/contraindication field to map onto
  `excludedMovements`. Resolve in Slice 1 (schema columns vs bundled mapping).
- **Sync-seq triggers** on the 5 workout tables must be audited (a dormant
  table was found without its trigger during nutrition Slice 2A).

### Slice plan (each its own authorization)
1. Schema audit + ADR (triggers + movement-pattern mapping decision) — **DONE 2026-07-17** (docs-only; no migration; Option C).
2. Exercise catalog strategy + built-in catalog (+ custom exercises) — **DONE
   2026-07-17 (foundation; no backend/repo/UI)**: bundled `exercise-catalog@0.1.0`
   (`mobile/src/features/workout/`) — 17 authored built-in exercises with
   movement patterns / equipment / body areas, a pure `matchExerciseExclusion`
   matcher (built-in → excluded/allowed by `TrainingPlan.excludedMovements`;
   custom/unmapped → neutral, never auto-excluded), and an integrity test
   cross-checking every movement pattern against the iCoach engine vocabulary.
   No schema/migration/sync/UI change.
3. Backend sync handlers (routines / routine_exercises / workout_logs /
   workout_sets) — **DONE 2026-07-17**: `api/src/modules/workout/` with four
   `EntitySyncHandler`s (ownership-scoped, client-UUID, soft-delete,
   pipeline-enforced version/conflict, FK-ordered `DEPENDENCY_NOT_READY` for
   missing routine/workout_log/exercise parents), one `WorkoutRepositoryPort`
   (Prisma impl), payload validators, mappers (wellness `notes` redacted from
   conflict snapshots), and module registration in `app.module`. Global/
   built-in exercises are reference data (device-read, not user-write synced).
   **Custom user-owned exercise push is deferred to Slice 3B** (schema supports
   `createdBy`, but the global-vs-custom write boundary + `name` uniqueness +
   built-in seed warrant their own slice); routine_exercises/workout_sets treat
   the exercise reference as pre-existing (missing → retryable). No schema/
   migration/UI change.
4. Mobile repository/store foundation (no UI). **Slice 4A DONE 2026-07-17**:
   routines + workout_logs mobile repository/service/store
   (`mobile/src/features/workout/`) — local-first writes, client-UUIDs,
   soft-delete, version/`sync_status`, sync-queue enqueue for the Slice 3
   handlers, pull appliers (`routines`/`workout_logs`), and workout_logs'
   optional `routine_id` validated against a locally-present routine. No UI.
   **routine_exercises + workout_sets deferred** — blocked by the
   `exercise_id → exercises(id)` FK: the Slice 2 built-in catalog is code-only
   with no seeded stable exercise ids. Resolved by the exercise identity + seed
   slice below.
4b. **Built-in-exercise identity + seed — DONE 2026-07-17.** Precomputed stable
   UUIDv5 id per built-in (`uuidv5(key:1)` under a shared
   `WORKOUT_UUID_NAMESPACE`, ADR-P012-style; no runtime derivation), seeded into
   `exercises` on mobile (`seedBuiltInExercises`/`ensureBuiltInExerciseSeeded`,
   `INSERT OR IGNORE`) and backend (`seed-exercise-catalog.ts` upsert insert-only
   from `exercise-catalog.json`). Idempotent, never overwrites custom
   exercises; mobile/backend id parity is test-verified. No schema/migration
   change. Unblocks routine_exercises/workout_sets.
4c. Mobile routine_exercises + workout_sets repository/store foundation (no UI).
   **Slice 4B DONE 2026-07-17**: `workout-exercises.repository.ts` (list/add/
   update/soft-delete for both entities + pull appliers), service use cases, and
   `useWorkoutStore` orchestration (`mobile/src/features/workout/`) — local-first
   writes, client-UUIDs, soft-delete, version/`sync_status`, enqueue in the same
   transaction for the Slice 3 `routine_exercises`/`workout_sets` handlers, and
   parent-dependency validation (routine / workout_log must be locally present →
   otherwise error). The `exercise_id → exercises(id)` FK is honored by seeding
   the built-in exercise in-transaction before the child insert
   (`ensureBuiltInExerciseSeeded`, `INSERT OR IGNORE`); non-built-in exercise ids
   are rejected (custom-exercise support deferred to Slice 3B). No schema/
   migration/UI change.
5. Routine builder UI. **DONE 2026-07-17**: session-guarded `/routines` route
   (`src/app/routines.tsx`) + a dashboard "Workout routines" entry point +
   `RoutineBuilder` screen (`mobile/src/features/workout/presentation/`) that
   lists / creates / soft-deletes routines, views a routine's exercises, and
   adds/removes built-in exercises — all via the Slice 4A/4B store (UI never
   touches SQLite). Exercise selection uses the Slice 2 built-in catalog; the
   deterministic iCoach `TrainingPlan` is READ from the dashboard store (never
   recomputed) to show a blocked/clearance notice and a non-blocking
   excluded-movement caution via `matchExerciseExclusion`. Reorder/edit-name and
   custom exercises are not exposed (deferred). No backend/schema/migration/sync
   change. **Workout logging UI stays Slice 6.**
6. Workout logging UI. **DONE 2026-07-17**: session-guarded `/workout-log` route
   (`src/app/workout-log.tsx`) + a dashboard "Log a workout" entry point +
   `WorkoutLogScreen` (`mobile/src/features/workout/presentation/`) that starts an
   ad-hoc workout (or from an existing routine), views open/recent logs, and
   adds/edits (reps + completion)/removes sets against built-in exercises, and
   finishes/soft-deletes logs — all via the Slice 4A/4B store (UI never touches
   SQLite; rows show a local `syncStatus` "pending sync" hint). Exercise
   selection uses the Slice 2 built-in catalog (unchanged); the deterministic
   iCoach `TrainingPlan` is READ from the dashboard store (never recomputed) to
   show a blocked/clearance notice and non-blocking excluded-movement cautions.
   Custom exercises stay deferred (Slice 3B). No backend/schema/migration/sync/
   dependency/catalog change. **E2E + TrainingPlan polish stay Slices 7–8.**
7. iCoach `TrainingPlan` integration (guidance + blocked/clearance states).
   **DONE 2026-07-20**: shared, read-only consumption of the deterministic
   `TrainingPlan` across the workout UI. New `domain/training-guidance.ts`
   (`toTrainingGuidance` — pure, deterministic view model encoding medical
   priority `blocked > clearance > ready`, with a safe `unknown` fallback when no
   plan is loaded), `application/use-training-plan.ts` (reads the plan the
   dashboard store already assembled; never recomputes), and presentation
   `TrainingPlanCard` (blocked/clearance banners + non-blocking intensity /
   RPE-cap / days-per-week / movements-to-avoid guidance) + `ExerciseExclusionNote`
   (Slice 2 `matchExerciseExclusion` → non-blocking per-exercise caution). The
   Slice 5/6 screens now consume these shared pieces (behavior preserved).
   Medical restrictions are never overridden or reinterpreted; offline-first is
   unchanged. No backend/schema/sync/dependency/catalog change.
8. E2E validation (Maestro, wired into `mobile-e2e.yml`). **AUTHORED 2026-07-20
   (awaiting a fresh e2e APK before it can run):** `mobile/.maestro/
   workout-training-plan.yml` — reuses the persisted `onboard` session and, on
   device, adds a knee restriction (deterministic `BODY_AREA_EXCLUSIONS.knee`),
   opens the routine builder, asserts the read-only `TrainingPlan` guidance card
   + the non-blocking excluded-movement caution on "Back squat" (`deep_squat`),
   builds a routine from the built-in catalog, then starts a workout, logs a set,
   confirms it is saved + pending, and finishes it. Wired into `mobile-e2e.yml`
   after `medical-management.yml`. **Requires a fresh EAS `e2e` APK built from
   the Slice 5–7 workout-UI commits** — the current published e2e APK predates
   the workout module (no `/routines` or `/workout-log`) and would fail; the APK
   build + e2e dispatch are NOT triggered pending explicit authorization. No
   app source / schema / backend / dependency / catalog change (flow YAML +
   workflow wiring only).
9. Custom-exercise UI. **DONE 2026-07-21:** expose Slice 3B's
   user-owned custom exercise sync through a dedicated `/exercises` library and
   inline quick-create from workout pickers. Keep custom exercises neutral for
   iCoach restrictions, preserve local-first writes/pending sync, and defer E2E
   to a separate slice.
10. Custom-exercise E2E validation (Maestro). **CLOUD-VERIFIED GREEN 2026-08-03:**
    `mobile/.maestro/workout-custom-exercise.yml` runs after
    `workout-training-plan.yml` on the persisted onboard session. It exercises
    Dashboard → Exercise library, create/edit of a user-owned custom exercise,
    use from both routine-builder and workout-log pickers, non-medical
    iCoach-neutral copy, soft-delete with active-routine warning, and the
    accepted `"(removed exercise)"` fallback. Wired into `mobile-e2e.yml`. The PR
    also carries two E2E-surfaced product fixes — `AppButton` 44×44 minimum touch
    target and `FormField` opt-in `selectTextOnFocus` (used by
    `CustomExerciseForm`) — plus an SDK 57 package alignment
    (`package.json`/lock) that restored the Expo doctor + bundle-export CI gate.
    No schema / backend / nutrition / catalog / ADR-P013 change.
    **CLOUD verification GREEN (2026-08-03):** GitHub `mobile-e2e` run
    `30821179350` (PR head `52fdaf1`) passed the full chain
    `registration → onboarding-loop → medical-management → workout-training-plan
    → workout-custom-exercise`. It downloaded the latest finished EAS `e2e` APK
    — build `b31e7c6d-1e26-4d82-8253-15f828ed4883`, built from commit `52fdaf1`
    (== PR head) — and ran it on the CI Android emulator against a disposable
    Postgres + live NestJS API. The `workout-custom-exercise.yml` flow completed
    all six sections (library create/edit, routine + workout-log picker use,
    active-routine delete warning `.*Used in 1 routine.*`, and the
    `"(removed exercise)"` fallback), with zero FAILED steps across the suite.
    This supersedes the earlier LOCAL-only run (2026-07-22). **PR #8 remains
    unmerged** pending owner review/merge.

### Privacy stance
Workout data = **wellness** (synced, not encrypted). Injury/restriction/medical
data stays owned by the medical domain (ADR-0011); the module consumes only the
derived, redaction-safe `TrainingPlan`.

### Acceptance criteria
- [x] Owner accepts ADR-P015 (slice plan + D1–D5) before any implementation.
      (Accepted 2026-07-17; implementation authorized but not started — Slice 1 next.)
- [x] Slice 1 audit resolves schema sufficiency (dormant-as-is vs additive migration).
      (2026-07-17: dormant-as-is — both sides clean, Postgres triggers present,
      no migration; movement-pattern mapping = Option C hybrid bundled.)
- [ ] Workout entities sync offline-first; medical restrictions never overridden.
- [x] Deterministic `TrainingPlan` reflected (never recomputed) in the workout UI.
      (Slice 7, 2026-07-20: read-only `toTrainingGuidance` + `useTrainingPlan` +
      `TrainingPlanCard`/`ExerciseExclusionNote` across both workout screens.)

### Related Documents
- .ai/12_DECISIONS.md — ADR-P015 (this gate), iCoach training engine, ADR-0006/0011
- .ai/13_MIGRATION_ROADMAP.md — Phase 16 — Workout Module
- api/prisma/schema.prisma — dormant `exercises`/`routines`/`routine_exercises`/`workout_logs`/`workout_sets`
- mobile/src/features/icoach/domain/training.ts — `planTraining` / `TrainingPlan`

---

## [FEATURE-008] Progress Monitoring (Phase 17)

**Status:** ADR-P016 **ACCEPTED** (2026-08-03, as drafted with D1–D6 = Option A).
Implementation authorized but not started; **next authorized step is Slice 1
(audit) only** — every later slice needs its own scoped authorization. No
code/schema/package change has landed.
**Priority:** commercial v1 (follows Phase 16).

### Description
Body metrics over time, weekly progress snapshots, and trend/dashboard views —
offline-first and deterministic. Reuses the dormant, already-provisioned
`body_weights`/`body_measurements`/`progress_snapshots` tables (both stores,
`SYNCED_COLS`) and mirrors the Phase 16 feature/sync architecture. See ADR-P016
for full context, decisions D1–D6, and architecture references.

### Proposed slices (each separately authorized)
1. Schema/sync audit + resolve D1–D6 (no code). **DONE 2026-08-03 (read-only
   audit):** tables + sync envelope present both stores; backend triggers/indexes
   cover all three. Gaps found: **M1** — mobile `progress_snapshots` lacks a
   `sync_status` dirty index (needed for D2 push); **M2** — `progress_snapshots`
   has no `rule_version` column (D2/D6). `period_type` not needed for weekly v1.
   Local-date columns sufficient but the deterministic derivation rule is pending
   (before Slice 4). D4 workout/nutrition sources are deterministic for v1. No
   code changed. See ADR-P016 "Slice 1 audit resolution" + "M2 micro-decision
   gate" (**M2 ACCEPTED 2026-08-03 = Option A: additive `rule_version`, v1
   uniqueness `user + week_start + rule_version`, `period_type` deferred**).

   **Schema activation (M1 + M2, additive) — IMPLEMENTED 2026-08-04 (schema
   foundation only; pending validation/commit).** Precedes the sync-handler work
   in item 2 below. Backend Prisma migration adds `progress_snapshots.rule_version`
   (NOT NULL) + replaces the unique with `uq_progress_snapshots_user_week_rule
   (user_id, week_start, rule_version)`; mobile forward-only migration
   `004-progress-schema-activation` adds `idx_progress_snapshots_dirty` (M1) and
   rebuilds `progress_snapshots` for `rule_version` + the 3-column unique (M2),
   guarded by a non-empty preflight; `ProgressSnapshotRow` updated; deterministic
   local-date rule documented (device-local date; `week_start` = ISO-Monday in
   user-local tz). No repository/store/handler/UI/engine/E2E; no `period_type`.
   See ADR-P016 "Slice 2 — additive schema activation".
2. Backend sync handlers (`BodyWeight`, `BodyMeasurement`; `ProgressSnapshot` per D2) + `ProgressModule`. **Slice 3a DONE 2026-08-04 (backend only; pending validation/commit): `body_weights` + `body_measurements` handlers + `ProgressModule` + `app.module` wiring; owner-scoped, wellness (no encryption/audit), notes redacted, duplicate-date CREATE → apply failure; no schema/migration change. `ProgressSnapshot` deferred to Slice 4. Mobile = Slice 3b (separate).** See ADR-P016 "Slice 3a".
3. Mobile `progress` feature — repositories, store, pull/push appliers (local-first + pending sync). **Slice 3b DONE 2026-08-04 (mobile only; pending validation/commit): `mobile/src/features/progress/` (domain/repository/store/sync-appliers/index) for `body_weights` + `body_measurements`, wired at `app/_layout.tsx`; local-first write+enqueue in one transaction, payloads match Slice 3a, pull appliers + conflict marking, same-date check-then-edit helpers. No UI/charts/iCoach/E2E; no `progress_snapshots`; no backend/schema/package change (coverage config unchanged per workout precedent).** See ADR-P016 "Slice 3b".
4. Deterministic weekly-rollup engine (iCoach domain) — volume/calorie/weight/deload; rule-version bump; tests at thresholds. **Slice 4a DONE 2026-08-04 (pure engine only; pending validation/commit): `icoach/domain/progress-analysis.ts` `computeWeeklyProgressSnapshots` + `isoWeekStart`; ISO-Monday weeks; avg weight/calories, total volume, workout count, `is_deload_week` (<0.6× mean of prior 3 nonzero weeks, ≥3 history else false); `ENGINE_RULE_VERSION` → `icoach-rules@1.1.0`; pure/deterministic; feed-not-override. No persistence/backend/mobile-repo/UI/E2E. Slice 4b = backend ProgressSnapshot sync; Slice 4c = mobile repo/applier/store + gathering.** **Slice 4b DONE 2026-08-04 (backend only; pending validation/commit): `ProgressSnapshotSyncHandler` + repo/mapper/payload for `progress_snapshots` in the existing `progress` module (registered in `onModuleInit`); validate-not-recompute (D2), client id honored, owner-scoped, duplicate (user, week_start, rule_version) → apply failure, numeric-only (no redaction/audit). No schema/migration/app.module/mobile/package change.** **Slice 4c DONE 2026-08-04 (mobile only; pending validation/commit): `mobile/src/features/progress/` snapshot runtime — `ProgressSnapshot` type/mapper/`toSqlBool`; repo `upsertProgressSnapshot` keyed by `(user_id, week_start, rule_version)` with STABLE id (UPDATE-in-place vs new-UUID CREATE), one-transaction write+enqueue, wire payload matching Slice 4b exactly, `listProgressSnapshots`/`applyServerProgressSnapshot`/`markProgressSnapshotConflict`, third pull applier registered; gathering service reads body weights + workout logs/sets (completed-set volume) + nutrition daily totals via public APIs, device-tz workout date, runs pure 4a engine + upserts; store `loadSnapshots`/`recomputeSnapshots`. Authorized read-only exports: workout `listRecentWorkoutLogs`/`listWorkoutSets`, nutrition `listDailyCalorieTotals`. No backend/schema/migration/UI/E2E/package change; coverage config unchanged.** See ADR-P016 "Slice 4a"/"Slice 4b"/"Slice 4c".
5. UI — progress entry + trend charts (lightweight/native) + dashboard trend card. **Split into 5a/5b. Slice 5a DONE 2026-08-04 (mobile only; pending validation/commit): `/progress` route (session-guarded) + `ProgressScreen` (binds only to `useProgressStore`); `BodyWeightForm` (date/weightKg/notes) + `BodyMeasurementForm` (waist required; hip/chest/body-fat optional) via RHF + Zod + shared `FormField`; explicit "Update weekly insights" recompute button + auto-recompute after a successful body-weight add; dashboard "Progress" nav button; `ProgressScreen` exported. No charts/visualization (deferred 5b), no dashboard progress card, no backend/schema/migration/package/iCoach-engine/E2E change; coverage config unchanged.** **Slice 5b DONE 2026-08-04 (mobile only; pending validation/commit): in-house `TrendBars` (View/Text only, D3 — min-normalized bars + always-on text summary [latest/range/direction+delta] + per-bar a11y labels, max==min/empty guards, text-first single/empty fallback); body-weight + weekly-volume trends wired into `ProgressScreen` (no avg-calories chart — shown numerically); `WeeklySnapshotSummary` (latest snapshot metrics + earlier weeks, deload flag as Yes/No text, nulls as "—"); `ProgressSummaryCard` on the dashboard (reads public store, loads on mount, pressable → /progress). Only `ProgressScreen`/`ProgressSummaryCard` exported. No chart lib/svg, no backend/schema/migration/package/iCoach-engine/E2E change; coverage config unchanged.** See ADR-P016 "Slice 5a"/"Slice 5b". Slice 6 = Maestro E2E.
6. Maestro E2E wired into `mobile-e2e.yml` (manual dispatch, ADR-P007/P008). **Slice 6 DONE 2026-08-04 (E2E + workflow wiring + docs only; pending validation/commit): `mobile/.maestro/progress-monitoring.yml` — onboard session, dashboard `dashboard-progress-card` → record weight 83 (auto-recompute) → assert Latest + `1 reading: 83 kg` → record waist 82 → `progress-recompute` → assert `weekly-snapshot-summary` + Week of/Total volume/Workouts/Deload week (text) → back, card shows 83 kg. Wired into `mobile-e2e.yml` after `workout-custom-exercise.yml`; `on:` stays `workflow_dispatch` only. No app/backend/schema/package change (all testIDs shipped in 5a/5b). Cloud green requires a fresh EAS `e2e` APK ≥ Slice 5b — not built/dispatched here (operator prerequisite).** **Phase 17 complete.** See ADR-P016 "Slice 6".

### Open decisions (owner) — see ADR-P016
- **D1 (KEY):** body-metric source of truth — activate wellness `body_weights`/`body_measurements` vs reuse medical `medical_evaluations` (adapter precedent); wellness-vs-medical privacy classification. **ACCEPTED 2026-08-03 = Option A (activate wellness tables as Progress source of truth; keep `medical_evaluations` medical-only); see ADR-P016 "D1 decision gate". ADR-P016 overall remains Proposed pending D2–D6.**
- **D2:** snapshot computation — on-device deterministic (proposed) vs server-computed rollup. **ACCEPTED 2026-08-03 = Option A (on-device deterministic, synced offline-first; backend validates shape/version but does not recompute in v1; hybrid deferred); see ADR-P016 "D2 decision gate". ADR-P016 overall remains Proposed pending D3–D6.**
- **D3:** charting approach (lightweight/native vs new dependency). **ACCEPTED 2026-08-03 = Option A (lightweight in-house/native primitives with accessible summaries; no new charting dependency in v1; advanced charting needs a separate ADR); see ADR-P016 "D3 decision gate". ADR-P016 overall remains Proposed pending D4–D6.**
- **D4:** v1 trend metric scope. **ACCEPTED 2026-08-03 = Option A (focused set — body-weight/waist trends + weekly snapshot summary primary; body-fat/other measurements + workout/nutrition adherence optional when deterministic local data exists; medical-trend/diagnostic/predictive/ML excluded); see ADR-P016 "D4 decision gate". ADR-P016 overall remains Proposed pending D5–D6.** **D5:** iCoach interaction (feed, never override). **ACCEPTED 2026-08-03 = Option A (feed-not-override deterministic, rule-versioned signals; never recomputes TrainingPlan/nutrition/medical; medical authority preserved; v1 read-only until a plan-affecting rule is separately authorized); see ADR-P016 "D5 decision gate". ADR-P016 overall remains Proposed pending D6.** **D6:** duplicate-date conflict semantics. **ACCEPTED 2026-08-03 = Option A (per-user local-date uniqueness; edit same-day record not silent duplicate; cross-device conflicts become explicit sync_conflicts, never silent overwrite; user-local-date boundaries; deterministic regenerable snapshots keyed by period+rule version; backend validates not recomputes; local-date/offset representation resolved in Slice 1 audit); see ADR-P016 "D6 decision gate".** **All D1–D6 accepted; ADR-P016 overall remains Proposed pending a separate explicit full-acceptance step.**

### Acceptance criteria
- [x] Owner accepts ADR-P016 (slice plan + D1–D6) before any implementation.
      (Accepted 2026-08-03; implementation authorized but not started — Slice 1 audit next.)
- [ ] Users see progress trends from their own data; offline-first; medical restrictions/data never overridden or reclassified without decision.
- [ ] Snapshots are deterministic (identical inputs → identical outputs); tests meet thresholds.

### Related Documents
- .ai/12_DECISIONS.md — ADR-P016 (this gate)
- .ai/13_MIGRATION_ROADMAP.md — Phase 17 — Progress Monitoring
- api/prisma/schema.prisma — dormant `body_weights`/`body_measurements`/`progress_snapshots`; `MedicalEvaluation` overlap
- mobile/src/features/dashboard/application/icoach-adapter.ts — current weight/body-fat read from `medical_evaluations`

---

## [FEATURE-009] Public-v1 Wellness Rebaseline and Bilingual Product Completion

Status: In Progress (Slices 1–3B-1 and 4A–4B implemented; later slices pending authorization)
Priority: P0
Type: Feature
Owner: Product / Architecture
Created: 2026-08-10
Updated: 2026-08-10

### Description

Rebaseline AppFitness for a public fitness, nutrition, progress, and wellness
launch under ADR-P017. Preserve the implemented medical domain as dormant,
protected architecture while removing it from the public-v1 experience and
iCoach composition. Complete Spanish/English localization, the goal-oriented
meal experience, and deterministic workout-routine generation before a new
store-submission re-gate.

### Problem

The current validated build still exposes medical evaluation/doctor-oriented
concepts, generates user-facing copy directly in English, and surfaces only
training guidance rather than a complete iCoach-generated routine. Publishing
that build would contradict the owner's clarified product intent.

### Scope

1. Documentation/ADR product contract.
2. Spanish/English localization foundation and language-neutral domain output.
3. Reversible public-v1 medical decoupling plus a self-entered physical-
   assessment contract. **IMPLEMENTED 2026-08-10 (pending commit/review):**
   dashboard/iCoach now read weight and body-fat only from the wellness Progress
   repositories; weight gaps route to `/progress`; medical routes/actions and
   composition-root sync registration are removed from public v1. Medical
   feature code, schema, migrations, encrypted fields, tests, and retained data
   remain intact. Public E2E onboarding/workout paths use wellness data only.
   **Slice 3B-1 IMPLEMENTED 2026-08-11 (pending commit/review):** optional
   muscle mass now extends the wellness `body_measurements` flow end-to-end
   (additive schemas, offline sync, bilingual entry and trend) without reading
   the dormant medical field or changing iCoach calculations. Structured
   self-declared physical limitations remain separately deferred.
4. Breakfast/lunch/dinner/optional-snack nutrition experience completion.
   **Slice 4A IMPLEMENTED 2026-08-11 (pending commit/review):** the existing
   deterministic 15-day meal-plan surface now presents its route, meals,
   portions, macro/target summaries, preference exclusions, baseline gaps,
   errors, disclaimer, and accessibility text in English or Spanish. Locale
   changes presentation only; the selected plan, rule output, stable catalog
   identifiers, offline behavior, and calculations are unchanged.
   **Slice 4B IMPLEMENTED 2026-08-11 (pending commit/review):** all 300 stable
   catalog IDs have an authored Spanish presentation name with canonical-English
   fallback. Meal plans, food-log search/selection and logged entries, and
   specific-food preference selection use the locale label. Spanish search is
   accent-insensitive and still accepts English names; writes/sync continue to
   carry the same catalog IDs and canonical immutable snapshots.
   **Slice 4C IMPLEMENTED 2026-08-11 (pending commit/review):** nutrition
   targets, dietary exclusions, food-log status/content, add-food controls,
   serving accessibility, warnings, empty/loading/error states, and safe
   wellness disclaimers now resolve through the shared English/Spanish
   localization boundary. Goal explanations are assembled from structured
   iCoach output at presentation time. The outdated message claiming dietary
   preferences were not yet connected to meal planning was removed. No target,
   macro, preference, catalog, persistence, sync, or iCoach behavior changed.
5. Complete deterministic workout-routine generator.
6. Bilingual accessibility, unit/integration/E2E, physical-device, privacy,
   legal, Data Safety, and release revalidation.

### Non-Goals

- Delete medical tables, migrations, encrypted fields, tests, or historical ADRs.
- Migrate or destroy retained medical data in the documentation slice.
- Present fitness guidance as diagnosis, treatment, medical clearance, or
  professional medical/dietary advice.
- Start Google Play submission before the rebaseline passes its own release gate.

### Acceptance Criteria

- [x] Public navigation/onboarding/dashboard do not expose or request excluded
      medical inputs.
- [x] Public-v1 iCoach does not read the dormant medical domain.
- [x] Dormant medical data remains protected and account deletion remains valid.
- [ ] Spanish and English cover all user-facing/accessibility/error content.
- [ ] iCoach supplies goal-oriented meal suggestions and a complete deterministic
      workout routine.
- [ ] Existing offline-first, sync, security, deletion, and monitoring guarantees
      remain green.
- [ ] A fresh production candidate passes bilingual E2E, physical-device
      validation, privacy/legal review, and store-readiness re-gating.

### Related Documents

- `.ai/00_PROJECT.md`
- `.ai/07_ICOACH.md`
- `.ai/08_UI_UX.md`
- `.ai/12_DECISIONS.md` (ADR-P017)
- `.ai/13_MIGRATION_ROADMAP.md` (Phase 21)
- `docs/RELEASE_READINESS.md`

---

## [FEATURE-010] V1 Visual Design Foundation and Design-System Evolution (UX Stream)

Status: In Progress
Priority: P1
Type: Feature
Owner: Product / Design / Architecture
Created: 2026-08-24
Updated: 2026-08-26

> **ADR-P022 ACCEPTED 2026-08-24** — visual direction `Confident Clarity`,
> mobile-first V1, explicit Web non-parity, wellness-not-medical visual posture,
> strict energy-accent rules (with `primary`/`onPrimary` reserved as the canonical
> filled-CTA pair), non-colour redundancy, Inter as target typeface,
> Material Symbols confirmed as the V1 icon vocabulary with its cross-platform
> React Native delivery mechanism unresolved and separately gated (no package,
> asset format, dependency, or per-platform mapping selected), low-shadow
> surfaces with a dark
> surface-tint target, functional-motion-only with reduced-motion equivalence,
> and no photography/exercise-illustration pipeline for V1.
> **UX-1B1 is COMPLETE — merged through PR #90 at merge SHA
> `2692e5896af6b099e2f7cce6c934407d504340ef`. UX-1B2A is COMPLETE — merged through
> PR #91 at merge SHA `6316f7826ea9fe9825ad5b484f5283fa38ddd1a1`. UX-1B2B is
> COMPLETE — merged through PR #92 at merge SHA
> `19cea4b0569e527481aaed9b4755b132072ed66a`. UX-1B2C is COMPLETE — merged
> through PR #93 at merge SHA
> `7f2f53adfd0e58c9342ab872f2884d97b75305aa`. UX-1B2D is COMPLETE — merged
> through PR #94 at merge SHA
> `ed77aef0d2c04fc6af60fb0163c80e6bf0a4372e`. UX-1C-1 is COMPLETE — merged
> through PR #96 at merge SHA
> `24b08e8d5b71ee3e3e1bdcbb654a408f35d0bfcd`. UX-1C-2A is COMPLETE — merged
> through PR #97 at merge SHA
> `84a211518a2c6235203797062da5f7507b015044`. Every later rung remains Proposed
> or blocked and needs its own scoped authorization.**
>
> **ADR-P023 ACCEPTED 2026-08-25 — Platform-Honest Input Accessibility
> Staging.** Pre-implementation verification established that on
> `react-native@0.86.2` / `react-native-web@0.21.2` / `expo@57.0.13` there is
> **no supported, typed mechanism** for programmatic **required** or **invalid**
> state on native iOS and Android; programmatic **disabled** is available on every
> platform and remains required. The objective is **preserved, not retired**: the
> gap is recorded as an open accessibility risk and a **V1 release-review gate**.
> UX-1C-1 may build the safe `AppTextInput` foundation and is an explicitly
> **staged partial implementation** — never contract-complete. No mechanism,
> dependency, copy, token, or stack upgrade is selected, planned, or authorized.
>
> **ADR-P024 ACCEPTED 2026-08-26 — Validation Error Announcement Staging.** The
> announcement evaluation ADR-P023 Decision 7 required is complete, and it
> **relocated the blocker**. `FormField` renders
> `borderColor: error ? error : outline`, while the shipped `AppTextInput` renders
> `outline` unconditionally and publishes **no `invalid`, no `required`, no
> `style`** — so migrating it today would **silently delete the error border**
> across the **7** consumer files (no spec asserts it). Restoring it would need a
> border-only `invalid` prop, the partial API **ADR-P023 Decision 5 forbids**, or
> a complete one whose programmatic half does not exist on native. UX-1C-2 is
> therefore split: **2B-a (announcement only) is AUTHORIZED** — typed
> `aria-live="polite"` on the existing localized error `AppText`, **Android and
> Web only**, iOS unmet — and **2B-b (`FormField` migration) is BLOCKED** pending
> a separate owner decision/ADR or a supported upstream capability.
> **`aria-live` is not an unblocker.** No `AccessibilityInfo` imperative
> announcement, `assertive` policy, new copy, duplicated message,
> `invalid`/`required` prop, field↔message association claim, input migration, or
> error-border change is authorized. A Jest assertion proves prop presence only,
> never a TalkBack or browser-AT announcement.
>
> **ADR-P025 ACCEPTED 2026-08-26 — FormField Primitive Migration Deferred from
> V1.** UX-1C-2B-a is **COMPLETE** (PR #99, merge SHA
> `95c81622f4c932bf6d2ffdb2f4dde791d5effb1a`). **UX-1C-2B-b is DEFERRED FROM V1
> and remains BLOCKED** — both are true and **neither is "complete"**. The
> shipped raw-`TextInput` `FormField` is **kept for V1**, preserving its error
> border, React Hook Form contract, frozen `field-*` hooks and accessible-label
> query paths, and the merged `aria-live="polite"` request. A **visual-only error
> prop on `AppTextInput` is rejected for V1** because it would deliver no
> user-visible launch benefit, close no accessibility gate, and exist only to
> enable an internal refactor. **ADR-P023 and ADR-P024 are preserved unchanged in
> meaning**, Decision 5 included. **All five accessibility release-review gates
> remain open** — programmatic invalid, programmatic required, field↔message
> association, iOS announcement, and manual VoiceOver/TalkBack/browser-AT
> verification. This is **deliberate V1 scope control, not abandonment of
> accessibility**: nothing regresses, and the obstruction is an upstream platform
> gap. Revisit only on a supported typed upstream capability, an approved
> localized accessible-copy strategy, or a relevant stack upgrade — none planned
> or authorized. No code, test, copy, dependency, or token change is authorized.

### Description

Establish the V1 visual foundation and evolve the design system from an unstyled
Material Design 3 skeleton into a specified, testable, bilingual, accessible
design language — then implement it progressively, feature by feature, without a
broad UI rewrite.

Phase-level detail lives in `.ai/08_UI_UX.md` (the specification) and
`.ai/12_DECISIONS.md` (ADR-P022, the decision) and is not duplicated here.

### Problem

ADR-0010 selected Material Design 3 and recorded its own accepted negative — it
"requires customization to avoid generic appearance" — but that customization was
never decided. Verified at `origin/main` `9dbe22588326530ee88ba575a86e1b5f99ad4504`:
the token modules are complete in shape yet largely unexercised (`secondary`,
`tertiary`, and `primaryContainer` have zero consumers); there are zero icons,
zero images, zero animations, zero haptics, and zero font loading anywhere in
`mobile/src`; the three motion duration tokens have zero consumers;
`typography.ts` states in its own header that Inter is not bundled; elevation is
shadow-only and therefore invisible on dark surfaces; and the light-theme palette
fails WCAG 2.2 AA in **five pairs across four semantic roles** — `warning` on
`surface` (4.24:1), `primary` on `surface` (3.53:1), `onPrimary` on `primary`
(3.53:1), `primary` on `surfaceVariant` (3.12:1), and `accent` on `surface`
(2.998:1).

Without a recorded direction and specification, component work would invent its
own contract implicitly, and the accessibility failures would ship unexamined.

### Expected Outcome

A named, owner-approved visual direction with enforceable rules; a design system
specification precise enough to test against; shared components built to that
specification; and every feature surface migrated to it incrementally, with
bilingual and accessibility verification at each step.

### Scope

Included:

- Visual direction decision and design-system specification (documentation)
- State-pattern and component contracts (documentation)
- Shared component implementation against frozen contracts
- Low-fidelity flows and high-fidelity specifications
- An authentication / onboarding / dashboard pilot
- Progressive per-feature migration to the new components

Excluded:

- Web feature parity (ADR-P018 / ADR-P019 remain in force; no parity authorized)
- Any change to the dormant medical domain (ADR-P017)
- Backend, schema, sync, CI, EAS, Railway, or deployment work
- Reopening Progress localization, Progress Web degradation, Slice 2B4, or H-1A
- A new charting dependency (ADR-P016 D3 stands)
- Photography or per-exercise illustration assets

### Implementation ladder (each rung separately authorized)

1. **UX-1B1 — Visual foundation documentation. Status: COMPLETE (merged 2026-08-24
   via PR #90, merge SHA `2692e5896af6b099e2f7cce6c934407d504340ef`).** ADR-P022
   appended to `.ai/12_DECISIONS.md`; `.ai/08_UI_UX.md` evolved to v1.2 with the
   `Confident Clarity` identity, semantic role usage, the energy-accent
   allowed/forbidden matrix, non-colour redundancy, light/dark surface hierarchy,
   a reproducible WCAG 2.2 AA contrast audit of the shipped palette with honest
   pass/fail, typography hierarchy plus the Inter delivery target and tabular
   figures for metrics, Spanish/English length and reflow safety, spacing and
   radius usage with content-measure and density principles, elevation behaviour
   per theme, motion semantics with reduced-motion equivalence, the Material
   Symbols icon visual contract with its delivery mechanism deferred, the imagery
   policy, accessibility verification
   expectations, and explicit SHIPPED / TARGET / PROPOSED labelling. Documentation
   only — no code, dependency, asset, or token value changed.
2. **UX-1B2 — State and component contracts. Split into three documentation
   slices after the UX-1B2 scoping audit showed the full set was too broad for one
   slice.** Documentation only throughout; each sub-slice needs its own scoped
   authorization.

   - **UX-1B2A — Canonical state contracts. Status: COMPLETE (merged 2026-08-24
     via PR #91, merge SHA `6316f7826ea9fe9825ad5b484f5283fa38ddd1a1`).**
     `.ai/08_UI_UX.md` → v1.3: exactly **eight** canonical states (loading, empty,
     data-gap, error, offline, pending sync, conflict, Web unavailable) with cause,
     data trustworthiness, user action, recovery path, semantic tone, confusion
     boundaries, and native/Web applicability; plus exactly **six** component
     contracts — `StateView`, `LoadingState`, `EmptyState`, `ErrorState`,
     `WebUnavailableNotice`, `SyncStatusHint`. `StateView` is a layout primitive
     only: no `kind`, tone mapping, store value, localization key, router
     destination, retry semantics, or business behaviour. Includes reconciliation
     **notes** for the shipped `SyncStatusBanner` (unchanged, remains the
     surface/aggregate component) and the two shipped data-gap components (shared
     semantics recorded; no third component invented, no migration chosen).
     **`WebUnavailableNotice` consolidates layout and structural guarantees only —
     it preserves all 11 feature-specific EN/ES `webUnavailable` title/body pairs
     plus `progress.webUnavailableCard`, carries no default or generic copy, and
     has no retry or action prop at all (ADR-P019 §5).** Success-confirmation and
     permission-denied are named as future flow needs with insufficient current
     evidence; **no placeholder API or anatomy is defined for either**.
   - **UX-1B2B — Form/input contracts. Status: COMPLETE (merged 2026-08-25 via
     PR #92, merge SHA `19cea4b0569e527481aaed9b4755b132072ed66a`).**
     `.ai/08_UI_UX.md`
     → v1.4: exactly **three** contracts — `AppTextInput`, `FormField`,
     `FormSelect` — frozen against a reproducible shipped-evidence snapshot (7
     files / 11 raw `TextInput`; 7 files / 40 `FormField` usages; 5 files / 8
     `FormSelect` usages; 2 style families; 3 radio-role and 4 selected-state-only
     choice surfaces; 6 Zod schema modules + 4 schema specs; 20 EN / 20 ES
     validation keys; 18 EN /
     18 ES placeholder keys; 19 label-query spec files; 10 hook-coupled spec
     files; **9 of 12 Maestro flows** coupled to input ids; 1 password field with
     no visibility affordance).
     `AppTextInput` is the text-control primitive with **discriminated** controlled
     and uncontrolled commit-on-end shapes — it owns no visible label, helper
     text, validation message, schema, RHF controller, store, or navigation.
     `FormField` remains the RHF adapter, keeps `Controller`, composes
     `AppTextInput` rather than being replaced by it, and preserves `Control<T>` /
     `FieldPath<T>` assignability, label ownership, `field-${name}`, the
     accessibility-label query path, and all 11 `selectTextOnFocus` call sites.
     `FormSelect` reconciles the shipped pressable radio-chip pattern and records
     **both shipped selection models — required, and optional beginning with no
     selection** (`ProfileForm.gender`, `EvaluationForm.activityLevel`,
     `RestrictionForm.severity` are each `.optional()`, initialise to `undefined`,
     and map `undefined → null`); no clear/deselect action, synthetic "None"
     option, placeholder UI, or modal picker is inferred. Option-level disabled is
     a TARGET, recorded honestly as **not implemented in the current shared option
     type**. FULL is the canonical style family; **migrating the seven REDUCED-family
     raw inputs is UX-5**, per-feature authorized.
     Also records the minimum implementable **non-colour redundancy** behaviour
     (1 px default border, thicker focus border, invalid = border + adjacent copy
     + programmatic exposure, required = indicator + programmatic exposure,
     disabled = prevented interaction + programmatic exposure + a non-colour-only
     visible treatment, selected chip = programmatic state + geometric
     distinction, with the exact selected border role marked **BLOCKED** rather
     than invented), and the **validation-copy boundary**: `FormField` /
     `FormSelect` render `fieldState.error.message` as shipped, but localization
     is today a **call-site** guarantee — three schema modules accept injected
     messages and one an injected required-message, all retaining English
     fallbacks, while the **two dormant medical schemas hardcode English with no
     injection mechanism** (out of scope under ADR-P017, to be resolved before
     those surfaces are activated). Raw store/repository exceptions are never
     rendered as validation copy. Documentation only — no component, migration,
     token, or localization change.
   - **UX-1B2C — Existing primitive reconciliation. Status: COMPLETE (merged
     2026-08-25 via PR #93, merge SHA
     `7f2f53adfd0e58c9342ab872f2884d97b75305aa`).**
     `.ai/08_UI_UX.md` → v1.5: exactly **five** contracts — `Screen`, `Card`,
     `AppText`, `AppButton`, `Banner` — plus the **ten-state applicability
     matrix** with exactly **50** classified cells (REQUIRED 10 / COMPOSED 8 /
     NOT APPLICABLE 32 / DEFERRED-BLOCKED 0). `Screen` and `Card` are confirmed
     **passive structural primitives**: every product state is **composed as a
     child** and **no state prop is added to either**. The frozen UX-1B2A
     components cover their accepted **loading / empty / error / Web-unavailable**
     semantics; **success remains feature-owned composition today** (commonly the
     shipped `Banner tone="success"`), because **success-confirmation remains
     deferred and undefined** — UX-1B2A records it as a future flow need with
     insufficient evidence and no API or anatomy, and UX-1B2C introduces none. `AppText` and `Banner` keep **semantic tones, not
     behavioural states** — their Error/Success cells are NOT APPLICABLE while
     `error`/`success` remain SHIPPED tones. `AppButton` is the only primitive
     with genuine interaction states and is documented with **exactly four**
     shipped variants (`primary`, `secondary`, `text`, `destructive`), with
     loading and disabled as props; no Error/Success/Selected button variant is
     introduced or implied. Narrow correction notes were added to the legacy
     `# Component States` and `# Buttons` sections, which list aspirational
     primitives, states, and variants (Tertiary, Outlined, Loading, Disabled) that
     the shipped code does not have. Documentation only — no component, token,
     localization, dependency, or asset change.

     **Open gaps recorded by UX-1B2C (not fixed here):**
     - `AppButton` **focus**: no focus treatment exists; a visible, non-colour
       indicator is a TARGET with a platform-validated mechanism.
     - `AppButton` **hover**: no hover handling exists; a hover affordance is a
       TARGET on hover-capable **Web** only, not a native requirement.
     - `AppButton` **loading accessibility**: when the accessible name is derived
       from visible children, replacing the label with the spinner removes that
       default name; an explicitly supplied caller `accessibilityLabel` survives
       through `PressableProps`. The component supplies no default preserved name
       and no programmatic busy outcome (`accessibilityState.busy` has zero
       occurrences).
     - `AppText` **dynamic type**: `allowFontScaling` is **default-on but
       currently overridable**, because the remaining `TextProps` are spread after
       the explicit prop. **Zero consumers disable it.** Preventing silent opt-out
       is a TARGET whose API mechanism belongs to UX-1C.
     - `AppText` **tone completeness**: caller `style` can override the semantic
       tone colour, and that is used deliberately where a needed semantic
       foreground role is missing. No new tone and no hardcoded colour is
       approved.
     - `Card` **grouping semantics**: `accessibilityLabel` pass-through is proven
       by spec, but equivalent screen-reader grouping is not proven on every
       platform; `Card` must not become an accessibility element by default.

   - **UX-1B2D — Input-contract reconciliation with the verified platform
     limitation. Status: In Progress (documentation / decision only).**
     `.ai/08_UI_UX.md` → v1.6, decided by **ADR-P023**. Pre-implementation
     verification of the resolved stack — `react-native@0.86.2`,
     `react-native-web@0.21.2`, `expo@57.0.13` — established the capability
     matrix: programmatic **disabled** is expressible on iOS, Android, and Web
     (`accessibilityState={{ disabled }}` plus `editable={false}`), while
     programmatic **required** and **invalid** have **no supported typed
     mechanism on native**. `react-native-web` forwards `aria-invalid` /
     `aria-required`, which is a Web runtime capability and **not**
     cross-platform. The slice amends only the clauses the limitation makes
     unachievable (§Non-colour redundancy, §1 `AppTextInput`, §2 `FormField`,
     §3 `FormSelect`), adds the capability matrix and a mandatory
     prop-presence-versus-announcement rule to §Verification expectations, and
     records the gap as owner-gated decision 10 and a release-review gate.
     **Fabricated support is rejected outright:** no `any`, unsafe cast,
     suppression comment, module augmentation of an unimplemented API, private
     native API, unsupported ARIA injection, `.web.tsx` input variant,
     `accessibilityValue.text`, or accessible-name suffix. **No mechanism is
     selected**, and no dependency, token, copy, or stack upgrade is planned or
     authorized. Documentation only — no component, token, localization,
     dependency, or asset change, and **no runtime implementation is completed by
     this slice**.

3. **UX-1C — Shared component implementation. Status: Proposed — remains
   Proposed until UX-1B2D is merged.** Build against the frozen UX-1B2A/B/C
   contracts **as amended by UX-1B2D**, starting with the text-input primitive
   that would retire the raw `TextInput` usages currently spread across 7 files
   (11 `<TextInput` occurrences, 10 of them outside the shared `FormField`). Must
   preserve every existing `accessibilityLabel` query path and the `input-*` /
   `field-*` testIDs that route specs and Maestro flows depend on. Sequenced as
   three code slices, each separately authorized:

   1. **UX-1C-1 — `AppTextInput` safe foundation.** Both the **controlled** and
      the **uncontrolled commit-on-end** models (both mandatory per ADR-P023,
      with a type-level guarantee that mixed or partial pairs are inexpressible),
      component tests for each, the barrel export, **`disabled` support**
      (programmatically exposed and interaction-prevented), and migration of
      **only** `mobile/src/app/sign-in.tsx` and
      `mobile/src/app/delete-account.tsx`. It publishes **no `required` or
      `invalid` public API**, because either would be a no-op on native or only
      partially truthful. This is a **staged partial implementation** and must
      never be described as completing the `AppTextInput` contract.
      **Status: COMPLETE** (PR #96, merge SHA
      `24b08e8d5b71ee3e3e1bdcbb654a408f35d0bfcd`).
   2. **UX-1C-2A — `FoodLogAddForm` migration. Status: COMPLETE** (PR #97, merge
      SHA `84a211518a2c6235203797062da5f7507b015044`). One file; the raw
      `TextInput` replaced by `AppTextInput` with localization, `food-search-input`,
      controlled query updates, selection clearing, and every nutrition workflow
      preserved. The form has **no field validation**, so it needed no invalid or
      required state and **narrowed no accessibility gate**.
   3. **UX-1C-2B-a — announcement only. Status: COMPLETE** (PR #99, merge SHA
      `95c81622f4c932bf6d2ffdb2f4dde791d5effb1a`), authorized by **ADR-P024**.
      Added typed `aria-live="polite"` to the **existing**
      localized error `AppText` that `FormField` already renders, reaching it
      through `AppText`'s existing `TextProps` surface. **Android and Web only —
      iOS announcement remains unmet.** `FormField` keeps its raw `TextInput` and
      its error border unchanged. Forbidden: `AccessibilityInfo` imperative
      announcement, `assertive` policy, new EN/ES copy, a duplicated message, any
      `invalid`/`required` prop, any field↔message association claim, any input
      migration, and any error-border change. A Jest assertion proves prop
      presence only.
   4. **UX-1C-2B-b — `FormField` → `AppTextInput` migration. Status: DEFERRED
      FROM V1 (ADR-P025) and still BLOCKED.** Both are true; **neither is
      "complete"**. `FormField` renders
      `borderColor: error ? error : outline`; the shipped `AppTextInput` renders
      `outline` unconditionally and publishes no `invalid`/`required`/`style`, so
      migration would **silently delete the error border** across its **7**
      consumer files — no spec asserts that border. **ADR-P025 keeps the shipped
      raw-`TextInput` `FormField` for V1**, preserving its error border, RHF
      contract, frozen hooks, and the merged `aria-live="polite"` request, and
      **rejects a visual-only error prop for V1** because it would deliver no
      user-visible launch benefit, close no accessibility gate, and serve only an
      internal refactor. Consequence: **two input style families persist through
      V1** and `AppTextInput` stays a staged partial implementation.
      **`aria-live` is not an unblocker.** Revisit only on a supported typed
      upstream capability, an approved localized accessible-copy strategy, or a
      relevant stack upgrade.
   5. **UX-1C-3 — `FormSelect`. Still blocked** by its recorded selected-chip
      contrast decision **and** by the unresolved required / invalid / group
      accessibility outcomes. Neither UX-1B2D nor ADR-P024 unblocks it.
   6. **UX-5 — all seven REDUCED-family inputs**, including migration of the
      existing uncontrolled workout consumer (the per-set reps editor in
      `WorkoutLogScreen.tsx`). Per-feature authorization, behaviour-visible
      because those inputs gain a 48px floor and a type token. **Confirmed
      unaffected by the error-border blocker** — in `DietaryPreferences.tsx`,
      `RoutineBuilder.tsx` and `WorkoutLogScreen.tsx` the `error` references are
      screen-level messages, not input borders — so **`FormField` is the only
      remaining consumer with an error border**.
4. **UX-2 — Low-fidelity product flows. Status: DELIVERED 2026-08-28 —
   `.ai/17_PRODUCT_FLOWS.md` v1.0.** Onboarding, authentication including
   verification and recovery surfaces, navigation and information architecture,
   workout logging inner loop, nutrition logging, progress. Text specification
   in `.ai/`; no design tooling, no runtime change.
   Every flow is tagged **SHIPPED / TARGET / PROPOSED** against `origin/main`
   `4c319e94`. Boundary facts worth carrying forward: **onboarding does not
   exist** (no surface on `main` — first-run is a dashboard of Data-gap states);
   **password recovery is TARGET**, living in PR #102, not on `main`; **email
   verification is PROPOSED** with no implementation anywhere; navigation is
   **hub-and-spoke, not tabs**. The specification reuses the eight ADR-P022
   canonical states rather than defining new ones, and records accessibility as
   **intent only** — ADR-P023/P024 outcomes stay unverified pending the manual
   VoiceOver / TalkBack / browser-AT pass, which remains unscheduled. It also
   records a live defect: `EvaluationHistory` is imported by no route and pushes
   to the non-existent `/evaluation-edit`.
   Two blocking decisions are handed to UX-3: onboarding **advisory vs
   blocking**, and **hub-and-spoke vs tabs**.
5. **UX-3 — High-fidelity specifications. Status: Proposed.** Per-screen
   blueprints, state matrices, EN/ES copy decks, accessibility annotations,
   motion specifications.
   **UX-3A is DECIDED (ADR-P027, Accepted 2026-08-28)** — the two blocking
   decisions UX-2 handed forward are resolved: onboarding is **advisory**
   (a dashboard checklist reusing existing Data-gap routing, **no onboarding
   routes**), and V1 **keeps hub-and-spoke** with a direct `/food-log` shortcut
   approved for UX-4A. **Bottom tabs are deferred, not unavailable** — they need
   no new dependency (`expo-router@57` vendors bottom-tabs), but activating the
   Selected-navigation `accent` role would land V1 on an unresolved **2.998:1**
   AA failure. `.ai/17_PRODUCT_FLOWS.md` v1.1 reconciles Flow 1 and Flow 3.
   ADR-P027 changed **no runtime**; the checklist and the shortcut are approved
   in principle and remain **PROPOSED until implemented**.
   Remaining UX-3 specification slices, in order:
   - **UX-3B — Per-screen state matrices. DELIVERED as a documentation
     candidate** (`.ai/18_SCREEN_STATE_MATRICES.md` v1.1, audited against
     `origin/main` `fb02097593ff9a2735f54620d6350d880cf3a030`). Binds **ten
     state-bearing surfaces — seven feature screens plus three independently
     stateful embedded surfaces** — to their exact subset of the eight ADR-P022
     canonical states, each with trigger, source state, rendered treatment, exit
     condition, platform scope and code/test/localization evidence. The route
     session gate is documented as a **cross-cutting pre-screen phase** and is
     **not** counted, because it enters none of the eight. Food Log's sync banner
     and item chips are treatments inside the Food Log matrix, not a separate
     surface. **Changed no runtime.**
     - **Status taxonomy:** SHIPPED · SHIPPED — non-conformant · PROPOSED
       (applicable but unimplemented, always with a named backlog owner) · n/a
       (genuinely not applicable, always justified). `n/a` is never used for a
       gap. **Seven** PROPOSED treatments and **one** non-conformant treatment
       are recorded, every one with a named owner — BUG-008 ×1, BUG-009 ×1,
       BUG-011 ×5, BUG-007 ×1.
     - **Eight findings, C-1 … C-8.** Four were documentation contradictions and
       are **reconciled** in this change (C-1, C-2, C-6, C-7); four are runtime
       defects and remain open as **BUG-007** … **BUG-010**. None needs a new
       ADR: each violates a rule ADR-P022's state model already fixes.
     - **C-6 resolved by owner direction.** Counting the complete dashboard
       composition consistently — including the embedded treatments already
       counted for its sync states — the dashboard reaches **seven of eight**;
       Empty is the only absent state. A narrow factual correction was applied to
       **ADR-P027** Decision 3 (six → seven, Data-gap added to its enumeration)
       and to `.ai/17_PRODUCT_FLOWS.md` §Flow 3 and §Flow 4. This is an
       **evidence correction to supporting rationale, not a change to ADR-P027's
       navigation decision** — hub-and-spoke is still retained, tabs are still
       deferred, and no revisit trigger is affected.
     - **C-7 reconciled.** `.ai/06_MOBILE.md` v1.1 replaces the obsolete
       "Loading / Empty / Offline / Success / Failure / Permission denied" list
       with the requirement that each screen handle its **applicable subset** of
       the eight canonical states, pointing at `.ai/08_UI_UX.md` and the
       matrices. No new state was created, and no screen must implement all
       eight.
     - **C-1 and C-2 reconciled as documentation, not closed as behaviour.**
       `.ai/17_PRODUCT_FLOWS.md` v1.2 removes the Offline claim from Flow 5 and
       the Offline + Pending-sync claims from Flow 7. The **coverage gaps** they
       exposed are separate and remain open as **BUG-011**. The Offline half is
       *not* a coverage gap: no authoritative connectivity signal is exposed to
       those surfaces at this commit, so there is nothing for them to render —
       recorded as justified `n/a`, describing what they currently receive.
     - **BUG-011** and **BUG-012** were opened by this audit for the two
       state-model gaps that are missing behaviour rather than wrong behaviour.
   - **UX-3C — EN/ES copy decks. DELIVERED as a documentation candidate**
     (`.ai/19_COPY_DECKS.md` v1.0, audited against `origin/main`
     `a24b4b69f477028cbc5022186773486b4f2f1a14`). Ratifies the exact shipped
     state copy across Dashboard, Workout Log, Nutrition and Progress; defines
     **33 PROPOSED keys** split among BUG-007/008/009/010/011 and UX-4A/4B;
     specifies the advisory first-run checklist and direct Food Log shortcut;
     and preserves exact status boundaries. It adds **no runtime or catalogue
     key**, invents no conflict-resolution flow, leaves progress-chart
     equivalence to UX-3D, defers recovery until PR #102 merges, and leaves
     verification copy behind ADR-P026 Vertical 2 authorization.
   - **UX-3D — Progress-chart non-visual equivalent. DELIVERED as a
     documentation candidate** (`.ai/20_PROGRESS_NONVISUAL.md` v1.0, audited
     against `origin/main` `d41efc69df4a48c0b0fb4f4ca2ad8884c6e648b7`). Audits
     what the three trend charts and the weekly snapshot summary communicate
     visually, then specifies the non-visual equivalent: grouping, reading and
     focus order, per-point labels, units, period type, window honesty, dynamic
     updates, maximum Spanish text scale and native/Web expectation. Adds **no
     runtime, catalogue key, test, asset or dependency**, and creates no ADR.
     - A **partial equivalent is already SHIPPED** — `TrendBars` always renders a
       latest / range / direction summary and a per-bar accessibility label. UX-3D
       closes four gaps rather than starting from nothing: ordering, count and
       window, period type, and series identity at point level.
     - **No unsafe nested accessibility.** Per the React Native accessibility
       documentation, an accessible `View` groups its children and stops them
       being separately selectable, and nested accessibility elements are not
       reliably reachable on iOS. The specification therefore marks no
       container accessible when it owns independently traversable descendants.
       Individual bars remain separate leaves; each metric row is one intentional
       accessible leaf combining only its own label/value text. Meaning is also
       carried by document order plus visible text. **R-12** guards this boundary.
     - **`WeeklySnapshotSummary` needs no separate alternative rendering** — it is
       text-first, with the deload flag as text and nulls as an em dash — but it
       is **not semantically complete**: a `null` metric must announce localized
       "not recorded" rather than "dash", the newest-first earlier-weeks order
       must be stated, and the metric rows must be individually accessible.
     - **Window truncation is a sighted-user problem too**, so the shown-count
       descriptor and the truncation notice are **visible** text, not an
       accessibility-only affordance.
     - **Seven PROPOSED keys**, absent from both 696-key catalogues with EN/ES
       parity, worded in `.ai/19_COPY_DECKS.md` v1.1 §Progress — five for the
       trend series, two for the weekly summary. `progress.weekly.weekOf` and
       `progress.weekly.earlierWeeks` are reused rather than duplicated. Three
       keys from an earlier draft were **dropped** once the no-nesting rule
       removed the wrappers they would have named, rather than being kept as dead
       copy.
     - **F-1 → BUG-013.** The per-bar accessible label exposes a raw
       `YYYY-MM-DD` — the only unlocalized date on the Progress surface, and one
       only assistive-technology users reach.
     - **F-2 — the `accent` role is in use.** `theme.colors.accent` has exactly
       one consumer, `TrendBars.tsx:113` (the latest bar). **ADR-P027**'s
       consequence bullet said it "remains unused"; that clause is corrected.
       Its conclusion is unchanged — ADR-P022's accent question stays open — and
       **no new ADR is required**, because that decision gate already exists.
     - **Platform.** The component contract is platform-neutral — no
       `Platform.OS` branch — while the public V1 product path is native-only,
       because Web terminates at Web unavailable (ADR-P019). Browser AT is `n/a`
       for the product path; that is a reachability statement, not a claim that
       the equivalent works on Web.
     - **Equivalent ≠ outcome.** No VoiceOver, TalkBack, browser-AT, visual or
       large-text result is claimed; all remain unverified until **UX-4C**. The
       no-nesting rule reduces a documented risk; it does not prove the safe
       pattern works.
6. **UX-4 — Authentication / onboarding / dashboard pilot. Status: Proposed.**
   First applied surfaces. **Note:** ADR-P027 defers the tab shell, so the
   selected-navigation accent role still has nowhere to live in V1 — that
   sentence in earlier revisions of this list anticipated tabs that are now
   deferred. Slices, in order, none implemented:
   - **UX-4A — `/food-log` dashboard shortcut. SHIPPED** (PR #110, merged
     `5643303a7d173690fba5921e4c97c737288e5f00`). Reduces the daily food-logging
     loop from three pushes to one and returns the product to its own documented
     three-level limit. Touched `DashboardScreen.tsx`, its spec and the EN/ES
     resources — 4 files, +28/−0. Additive: the targets → plan → food-log chain
     is preserved.
   - **UX-4B — First-run checklist card. SHIPPED.** Implements the advisory
     onboarding shape decided by **ADR-P027 Decision 1**, reusing `resolveGapFix`
     and the existing gap sets. **No new route, no persistence, no dismissal
     control** — ADR-P027 leaves dismissal semantics undecided, so none is
     invented.
     - `OnboardingChecklistCard` becomes the **Data-gap treatment on the
       first-run branch** (`status === 'empty'`), where the assessment cannot
       compute yet. The `status === 'ready'` branch keeps `DataGapCard`
       unchanged, so a partially-configured account with an assessment still
       gets the detailed per-gap list.
     - The five gap ids group into the **three copy-level steps** UX-3C
       specified, without changing any routing. `default-sex` stays out: it has
       no entry screen in `resolveGapFix`, so it is not a step a user can
       complete.
     - **Only outstanding steps render a row**; completion is carried by the
       text line "{completed} of {total} complete". This keeps the slice inside
       UX-3C's approved 7 keys and invents no status word, at the cost of the
       list shrinking as it is completed. A per-step "done"/"to do" tag would
       need 2 new keys and is a UX-3C decision, not a UX-4B one.
     - The 7 `dashboard.onboarding.*` keys move **PROPOSED → SHIPPED**;
       catalogues go 698 → **705 / 705**, parity preserved.
   - **UX-4C — Manual AT verification pass.** VoiceOver, TalkBack and browser-AT,
     recorded per surface. **Until this runs, no accessibility outcome anywhere
     in the UX stream may be reported as satisfied** (ADR-P023 / ADR-P024).
7. **UX-5 — Progressive feature migration. Status: Proposed.** One feature per
   slice, behaviour preserved, with bilingual, dark-theme, and accessibility
   verification per slice.

### Acceptance Criteria

- [x] Owner approves a named visual direction before any visual code is written.
      (`Confident Clarity` accepted 2026-08-24 via ADR-P022.)
- [x] The visual foundation is recorded with reproducible contrast evidence and
      honest pass/fail verdicts. (UX-1B1, `.ai/08_UI_UX.md` v1.2.)
- [ ] Component and state contracts are frozen before component code is written.
- [ ] Shared components satisfy their contracts, including contrast in both
      themes and non-colour redundancy for selected/success/warning/error.
- [ ] The five light-theme AA failing pairs across four roles (`primary` on
      `surface` and on `surfaceVariant`, `onPrimary` on `primary`, `warning`,
      `accent`) are resolved by an authorized token-value decision, or recorded as
      accepted exceptions with the exemption cited.
- [ ] Inter delivery, the Material Symbols cross-platform delivery mechanism
      (including reconciling the `.ai/02_TECH_STACK.md` icon entry and an
      ADR/technology update if the choice falls outside the approved stack),
      motion adoption, and the dark surface-tint ramp each land under their own
      authorization.
- [ ] Programmatic **required** and **invalid** exposure on native iOS and
      Android is either resolved by a supported mechanism or consciously accepted
      as an exception at the **V1 accessibility release-review gate** (ADR-P023).
      Programmatic **disabled** exposure is implemented and tested on every
      platform.
- [ ] No accessibility outcome is reported as satisfied on the strength of a unit
      or component test alone; announced states are confirmed by manual VoiceOver,
      TalkBack, and browser-AT verification, recorded per surface.
- [ ] Every migrated surface is verified in Spanish and English, in light and
      dark, at default and large text scale.
- [ ] No feature loses behaviour, offline-first guarantees, or its
      "unavailable on Web" state during migration.

### Technical Notes

`Confident Clarity` extends ADR-0010; it does not supersede it. The energy accent
is carried by the existing `accent` semantic role, so no new colour role is
introduced. The accent is bounded by **meaning** — achievements, positive progress
deltas, the primary action, selected navigation — and is forbidden on neutral
information, ordinary containers, warnings, and errors.

**`primary` versus `accent` (ADR-P022 Decision 5a).** `primary` / `onPrimary` is
the canonical pair for a filled primary CTA; `accent` never replaces it, and must
never become a CTA background or label. Accent on a primary action is subordinate,
non-exclusive emphasis only, and the CTA must remain recognizable without it.
**There is no shipped `onAccent` role and none is introduced here.**

The accent is currently **unusable in the light theme** (`#00A6A6` measures
2.998:1 on `#FFFFFF`, below even the 3:1 non-text threshold), so UX-1C cannot ship
an accent-bearing surface in light mode until the token-value decision in the
acceptance criteria is taken. Accent emphasis on primary actions is blocked in
**both** themes until that value *and* an accessible foreground/background pairing
are approved, so the rule stays identical across themes. Candidate values recorded
in `.ai/08_UI_UX.md` are labelled PROPOSED and are not approved.

**UX-1B2A light-theme blockers — OPEN, not resolved by this slice.** Four of the
five recorded failing pairs land directly on the state surfaces UX-1B2A specifies
(detail in `.ai/08_UI_UX.md` §Impact on the canonical state UI):

- `EmptyState`'s creation action and `ErrorState`'s retry are **blocked from AA
  completion** — a filled primary action fails AA in the light theme, and a
  text-style action fails too, so there is no in-palette escape.
- `WebUnavailableNotice` inherits an **existing** failure: the shipped `Banner`
  info tone renders its title in a role/size combination that fails AA in the
  light theme, on all 12 surfaces that use it today.
- `SyncStatusHint`'s **conflict** variant uses the warning role, also a recorded
  light-theme failure. Its pending variant is unblocked.
- The accent is **not used by any UX-1B2A contract**, so the accent block does not
  gate this work.

Consequence for UX-1C: the **copy-only** state forms may proceed; **no
action-bearing state form may be declared AA-complete in the light theme** until
the owner-gated token-value decision in the acceptance criteria above is taken.
No contract claims otherwise, and no candidate value is approved here.

**UX-1B2B usage-level contrast findings — OPEN, tracked separately from the five.**
The five failing pairs above are the **original owner-gated token set** (five
light-theme pairs across four foreground roles). The UX-1B2B audit found **three
additional failing role/background pairings** that are **usage errors, not
token-value defects** — two light-theme placeholder pairings and one dark-theme
selected-chip pairing. They must not be folded into the count of five. Detail in
`.ai/08_UI_UX.md` §Usage-level contrast findings.

1. **Selected-chip foreground misuse.** Four shipped choice surfaces (the shared
   `FormSelect` plus three feature choice rows) fill with `primary` but render the
   label through the default text tone, resolving to `onSurface`: **4.84:1 in
   light (passes) but 1.42:1 in dark (fails)**. Pairing `primary` with `onPrimary`
   — as the language selector and `AppButton` already do — fixes dark (6.95:1) but
   lands on the already-recorded light failure (3.53:1). **Therefore the selected
   `FormSelect` state cannot be declared AA-complete in both themes until the
   existing owner-gated `primary`/`onPrimary` decision resolves.** No alternative
   fill or new token is chosen.
2. **Placeholder role misuse.** `outline` as placeholder **text** fails in light —
   3.96:1 on `surfaceVariant` and 4.49:1 on `surface` (WCAG ratios are not rounded
   upward). `outline` stays valid for non-text borders at 3:1. `onSurfaceVariant`
   is the canonical placeholder-text role and passes at 8.23:1. Six of eight
   shipped placeholder sites use `outline`.

**No code is fixed by UX-1B2B**; both findings are documentation-only records.

**UX-1B2C additional usage-level contrast findings — OPEN.** The primitive audit
measured every tone/ground pairing the five shipped primitives actually produce
and found **exactly three more** light-theme pairings, all on grounds not
previously measured. Detail in `.ai/08_UI_UX.md` §Usage-level contrast findings
(UX-1B2C).

1. **`primary` on `background` — 3.38:1.** Lands on the `AppButton` `text`
   variant when it sits directly on a `Screen` ground (16 shipped `text` usages).
2. **`warning` on `surfaceVariant` — 3.74:1.** Lands on the `Banner` `warning`
   title (9 usages).
3. **`success` on `surfaceVariant` — 4.04:1.** Lands on the `Banner` `success`
   title (2 usages).

**Corrected running totals:** **five** original owner-gated token pairs, plus
**six** additional usage-level pairings (three from UX-1B2B and three from
UX-1B2C).

**Counting correction:** the `Banner` `info` title (`primary` on `surfaceVariant`,
3.12:1) is an **application of one of the original five owner-gated pairs**, not
an additional usage finding, and must **not** be counted twice.

Also recorded: `success` on `surface` remains a narrow pass at 4.58:1, which does
**not** imply it passes on `surfaceVariant`; all relevant dark-theme text pairings
pass across all five primitives; `AppButton` disabled composites (1.99:1 light /
3.35:1 dark) are **WCAG-exempt for inactive controls but remain a usability
concern**; the weak `Card` boundary is **exempt only while decorative** and needs
reassessment if it becomes semantically necessary or interactive. **No candidate
token, replacement pairing, or runtime remedy is approved, and no code or token
value is changed.**

**UX-1B2D native input-accessibility limitation — OPEN, and a V1
release-review gate.** Separate from every contrast item above; this one is a
**platform capability gap**, not a token or pairing question. Verified read-only
before any runtime code, against the versions `mobile/package-lock.json` resolves:
`react-native@0.86.2`, `react-native-web@0.21.2`, `expo@57.0.13`.

- **Disabled — available.** `accessibilityState={{ disabled }}` plus
  `editable={false}` works on iOS, Android, and Web. Not deferred; remains
  required and tested.
- **Required and invalid — unavailable on native.** React Native's
  `AccessibilityState` declares only `disabled`, `selected`, `checked`, `busy`,
  `expanded`; there is no typed `invalid`/`required` prop and no
  error-message-association prop. `react-native-web` forwards `aria-invalid` and
  `aria-required` to the DOM — a **Web runtime** capability that **does not exist
  on native** and must never be described as cross-platform.
- **Consequence.** `AppTextInput` is **not contract-complete** after UX-1C-1;
  `FormField`'s required/invalid outcomes **cannot be declared complete**; and
  `FormSelect` outcomes (e) and (f) stay unsatisfied. Screen-reader users on iOS
  and Android receive the visible required indicator and the adjacent error
  message, **not** field state — and adjacent visible text does **not** prove
  announcement.
- **Gate.** This is an explicit **accessibility release-review gate before V1
  store submission**, consistent with `.ai/09_TESTING.md` (accessibility is a
  release requirement; error announcement is a per-screen check). It must be
  resolved or consciously accepted at that gate.
- **Re-evaluation trigger:** a supported upstream API, an approved
  accessible-copy strategy with authorized EN/ES keys, or a stack upgrade.
  **None is planned or authorized.** Decided by **ADR-P023**; detail in
  `.ai/08_UI_UX.md` §Verified platform capability matrix (UX-1B2D).

**`FormField` error-border migration blocker — OPEN (ADR-P024).** Distinct from
the limitation above: this one blocks a **refactor**, not an outcome.
`form/FormField.tsx` renders `borderColor: error ? error : outline`, while the
shipped `app-text-input.tsx` renders `outline` unconditionally and publishes no
`invalid`, `required`, or `style`. Migrating `FormField` would therefore delete a
live visual signal across its **7** consumer files, and — because **no spec
asserts that border** — the regression would pass CI silently. Restoring it needs
either a border-only `invalid` prop (the partial API **ADR-P023 Decision 5**
forbids) or a complete one whose programmatic half does not exist on native.
**UX-1C-2B-a (announcement only) is COMPLETE** (PR #99). **UX-1C-2B-b is
DEFERRED FROM V1 by ADR-P025 and remains blocked** — both, and neither is
"complete". ADR-P025 keeps the shipped raw-`TextInput` `FormField` for V1 and
**rejects a visual-only error prop for V1** (no user-visible launch benefit,
closes no gate, serves only an internal refactor). Re-evaluation trigger: a
supported typed upstream capability, an approved localized accessible-copy
strategy, or a relevant stack upgrade — none planned or authorized.
**`aria-live` is not an unblocker** — it announces a message, exposes no invalid
state, and restores no border. Confirmed alongside this: the seven
REDUCED-family inputs have **no** error border, so `FormField` is the only
blocked consumer.

**Accepted V1 consequence (ADR-P025).** Two input style families persist through
V1 — the FULL family in `AppTextInput` (`sign-in`, `delete-account`,
`FoodLogAddForm`) and the raw-`TextInput` `FormField` with its **40 usages across
7 consumer files**. The FULL-family consolidation is therefore incomplete,
`AppTextInput` remains a **staged partial implementation**, and its focused-border
and disabled behaviours do not reach `FormField`'s consumers in V1. This is
**deliberate scope control, not abandonment of accessibility**: nothing
regresses, and all five gates stay open at the same severity.

Coverage note for later rungs: `mobile/package.json` includes neither
`src/features/workout` nor `src/features/progress` in `collectCoverageFrom` or
`coverageThreshold`, and no EN/ES key-parity spec exists. Both are worth closing
before UX-5 touches those surfaces.

### Risks

- Distinctiveness depends on typographic and numeric craft plus one
  data-visualization signature; executed weakly, the result still looks like
  default MD3.
- Accent creep — the accent spreading beyond its four permitted meanings — would
  collapse the direction. Mitigated by the allowed/forbidden matrix and the
  frequency rule.
- Resolving the light-theme contrast failures shifts the app's visual tone
  slightly; the change must be taken deliberately rather than absorbed silently.
- UX-1C touches `sign-in.tsx`, whose spec asserts exact localized error copy for
  five distinct authentication reasons; a careless refactor breaks it.
- **Native required/invalid accessibility gap (ADR-P023).** Screen-reader users on
  iOS and Android cannot perceive these as field state on the installed stack.
  The risk is that a green Jest suite is mistaken for compliance: a property
  assertion proves the property, never the announcement. Mitigated by the
  prop-presence-versus-announcement rule in `.ai/08_UI_UX.md` §Verification
  expectations, by forbidding any fabricated mechanism, by labelling UX-1C-1 a
  staged partial implementation, and by the V1 release-review gate. **Not** closed
  by this documentation slice.
- Maestro flows are `workflow_dispatch`-only and need an operator-built EAS `e2e`
  APK, so UI restructuring must be batched to limit APK builds.
- The font slice and the Material Symbols delivery slice both add bundle size,
  and delivery may add a dependency, bundled assets, or both; each needs a
  measured budget.
- Icon delivery has no obviously correct route: `@expo/vector-icons` is
  documented by Expo as deprecated / not recommended and does not provide
  Material Symbols; the already-installed `expo-symbols` maps to SF Symbols on
  iOS and Material Symbols on Android/Web, so it is not one identical family
  everywhere; `@expo/ui`'s `Icon` (with `@expo/material-symbols`) is documented
  as not rendering on Web. The slice may therefore have to choose between
  identical Material Symbols everywhere and platform-native equivalents behind a
  shared semantic mapping — and may surface an `.ai/02_TECH_STACK.md`
  contradiction requiring an ADR/technology update.

### Dependencies

- ADR-0010 (Accepted) — Material Design 3 base, extended by ADR-P022
- ADR-P017 (Accepted) — public-v1 wellness scope; medical domain stays dormant
- ADR-P018 / ADR-P019 (Accepted) — Web storage and local-data dormancy; no parity
- ADR-P016 D3 (Accepted) — no new charting dependency in v1
- ADR-P022 (Accepted) — this stream's decision
- ADR-P023 (Accepted) — platform-honest input accessibility staging; gates the
  UX-1C-1/2/3 sequence and adds the V1 accessibility release-review gate
- ADR-P024 (Accepted) — validation error announcement staging; authorizes
  UX-1C-2B-a (announcement only) and records UX-1C-2B-b as blocked by the
  `FormField` error border
- ADR-P025 (Accepted) — `FormField` primitive migration deferred from V1; keeps
  the shipped raw-`TextInput` `FormField`, rejects a visual-only error prop for
  V1, and keeps all five accessibility release-review gates open
- Owner authorization for each rung from UX-1B2 onward

### Related Documents

- `.ai/00_PROJECT.md`
- `.ai/02_TECH_STACK.md`
- `.ai/06_MOBILE.md`
- `.ai/08_UI_UX.md` (v1.2 — the visual foundation)
- `.ai/12_DECISIONS.md` (ADR-P022; ADR-0010; ADR-P016 D3; ADR-P017; ADR-P018;
  ADR-P019)
- `mobile/src/shared/theme/` — the shipped token values this stream evolves

---

## [FEATURE-011] V1 Transactional Email, Password Recovery, and Email Verification

Status: Proposed
Priority: P1
Type: Feature
Owner: Product / Security / Architecture
Created: 2026-08-27
Updated: 2026-08-27

> **ADR-P026 ACCEPTED 2026-08-27 — V1 Transactional Email, Password Recovery,
> and Email Verification.** Both capabilities are **V1 launch requirements**.
> **Postmark** is the approved provider, consumed over its **REST API** through a
> provider-agnostic **`MailTransport` port** — **no vendor SDK**. **Resend** is an
> evaluated **fallback only** and needs its own decision before use. The ADR
> authorizes **no provider account, paid plan, DNS record, or secret**, and **no
> code, migration, route, template, or UI**. Delivery is two cohesive verticals,
> each separately authorized, both requiring **Development-first
> provider-sandbox validation before Production**. No email is ever sent from CI.

### Description

Add password recovery and email verification to the shipped auth module, on a
provider-agnostic transactional-email foundation that a later reports or
notifications capability can reuse without transport changes.

Decision detail lives in `.ai/12_DECISIONS.md` (ADR-P026) and is not duplicated
here.

### Problem

Audited at `origin/main` `f1e7214ee25136c7938b32005a4bff5c90a1ee19`:

- **No email capability exists** — no mail dependency in `api/package.json`, and
  no mailer, SMTP client, or email vendor referenced anywhere under `api/`.
- **No recovery path.** A forgotten password permanently orphans the account, and
  `docs/legal/PRIVACY_POLICY.md` still carries a placeholder privacy contact, so
  there is no support channel either.
- **No verification state.** `User` has no `emailVerified`/`emailVerifiedAt`;
  `UserStatus` is `ACTIVE | SUSPENDED | PENDING_DELETION`; no verification or
  reset token model; no verify/resend/forgot/reset endpoint; no mobile route; and
  none of the 20 `auth.*` localization keys covers either flow.
- **No deep-link completion.** `app.json` declares `scheme: appfitness` but no
  `intentFilters` and no `associatedDomains`, and `expo-linking` is unused in
  `mobile/src`.

### Scope — two cohesive verticals

1. **Vertical 1 — Mail foundation + password recovery (end to end).**
   `MailTransport` port, `FakeMailTransport`, EN/ES templates, reset-token
   migration, `forgot-password` / `reset-password` endpoints, mobile routes and
   copy. Reset tokens: 32-byte `randomBytes` base64url, **SHA-256 stored**,
   `@unique`, **single-use**, **30-minute TTL**; a successful reset **revokes
   every refresh token** for that user.
2. **Vertical 2 — Email verification (end to end).** `emailVerifiedAt` column and
   verification-token migration, `resend-verification` / `verify-email`
   endpoints, persistent soft-gate reminder, legacy backfill. Verification
   tokens: same storage design, **single-use**, **24-hour TTL**.

New issuance **invalidates prior active tokens** of that family.
`forgot-password` and `resend-verification` **always return the same `202`** and
are rate limited **per IP and per account**. **Raw tokens and email bodies are
never logged**; the `AuditAction` enum and `sentry-scrub.ts` are extended during
implementation.

### Out of scope

Email-address change flows · marketing email · scheduled or digest reports ·
preference centres · queues and schedulers, **including Redis and BullMQ** (both
remain approved-but-unbuilt) · roadmap Phase 19 notifications, which stays
post-v1.

### Policy

Existing accounts are backfilled `emailVerifiedAt = NULL` as legacy-unverified
and are **never locked out**; **no `PENDING_VERIFICATION` is added to
`UserStatus`**. New and unverified users keep **core access** with a persistent
reminder. Verification becomes **mandatory before any future email report or
account-notification feature**.

### Acceptance Criteria

- [ ] `MailTransport` port with `FakeMailTransport` bound in all unit and e2e
      tests; **no real email sent from CI**, asserted
- [ ] Reset tokens: 32-byte base64url, SHA-256-only storage, `@unique`,
      single-use, 30-minute TTL
- [ ] Verification tokens: same storage design, single-use, 24-hour TTL
- [ ] New issuance invalidates prior active tokens of the same family
- [ ] Successful password reset revokes every `RefreshToken` for the user
- [ ] `forgot-password` and `resend-verification` return an identical `202`
      regardless of account existence, rate limited per IP **and** per account
- [ ] No raw token or email body in any log, audit row, or Sentry event;
      `sentry-scrub.ts` extended and specs green
- [ ] Existing accounts remain able to sign in with `emailVerifiedAt = NULL`
- [ ] Owned sending subdomain with **SPF, DKIM and DMARC** verified before any
      Development-live send
- [ ] Development provider-sandbox validation passes **before** Production
- [ ] Privacy-contact placeholder resolved in `docs/legal/PRIVACY_POLICY.md`
- [ ] EN/ES templates and UX states reviewed in both locales
- [ ] Every frozen `input-*` / `field-*` hook and accessibility-label query path
      still resolves

### Risks

- **External prerequisites outside the repository**: an owned domain, DNS
  records, a Postmark account and a paid plan (~$15/month at entry). None is
  authorized by ADR-P026.
- **Universal / App Links need a native rebuild** — not OTA-eligible.
- **Token cleanup without a job runner** must be an in-process schedule or lazy
  deletion; introducing BullMQ/Redis is a separate decision.
- **Enumeration and mailbombing** are the principal abuse vectors; per-account
  limits are required, not just per-IP.

### Dependencies

- ADR-P026 (Accepted) — this feature's decision
- ADR-P020 (Accepted) — rate-limiting posture the new endpoints adopt
- ADR-P011 (Accepted) — account deletion remains immediate and irreversible
- ADR-P018 / ADR-P019 (Accepted) — Web stays constrained; the Web fallback is a
  link-landing surface only
- TECHDEBT-001 — closed in intent by ADR-P026's explicit strategy decision
- Owner authorization for each vertical

### Related Documents

- `.ai/12_DECISIONS.md` (ADR-P026)
- `.ai/02_TECH_STACK.md` (§Backend — Transactional Email)
- `.ai/05_SECURITY.md`
- `docs/RELEASE_READINESS.md`
- `docs/legal/PRIVACY_POLICY.md`

---

# Bug Backlog

All four bugs below were found during Phase 10 human simulator validation
(Android emulator, 2026-07-06), fixed the same day, and are covered by
regression tests. Kept for traceability.

## [BUG-001] App Crashed on Boot — Unstable useSession getSnapshot

Status: Done
Priority: P0
Type: Bug
Owner: Unassigned
Created: 2026-07-06
Updated: 2026-07-06

### Description

`useSession`'s `useSyncExternalStore` getSnapshot built a fresh object on
every call. React compares snapshots with `Object.is`, so every render
scheduled another render — "Maximum update depth exceeded" on every app
launch.

### Expected Outcome

App boots to the sign-in or dashboard route without a render loop.

### Acceptance Criteria

- [x] Snapshot is referentially stable while the session store is unchanged
- [x] Fixed in `mobile/src/features/authentication/presentation/use-session.ts`
- [x] Regression test: `use-session.spec.ts` (snapshot caching)

### Related Documents

- .ai/13_MIGRATION_ROADMAP.md (Phase 10)

---

## [BUG-002] local_user Row Never Created — All Local-First Writes Failed

Status: Done
Priority: P0
Type: Bug
Owner: Unassigned
Created: 2026-07-06
Updated: 2026-07-06

### Description

Every synced SQLite table's `user_id` FK references `local_user`, but no
code path ever inserted that row. The first local write for any fresh
account (profile save, `__DEV__` sample data — and any future Phase 11
form) failed on the FK constraint.

### Expected Outcome

Establishing a session guarantees the `local_user` mirror row exists.

### Acceptance Criteria

- [x] `ensureLocalUser` upsert added
      (`mobile/src/features/authentication/infrastructure/local-user.repository.ts`)
- [x] Called on sign-in, sign-up, and both restore paths
      (`session-manager.ts`)
- [x] Regression tests: `local-user.repository.spec.ts`,
      `session-manager.spec.ts`

### Related Documents

- .ai/16_SQLITE_SCHEMA_DESIGN.md
- .ai/13_MIGRATION_ROADMAP.md (Phase 10)

---

## [BUG-003] Sync Permanently Stuck After Access-Token Expiry

Status: Done
Priority: P1
Type: Bug
Owner: Unassigned
Created: 2026-07-06
Updated: 2026-07-06

### Description

`syncNow` only refreshed tokens when the in-memory access token was
null. After the 15-minute TTL the token was present but expired, every
sync returned `unauthenticated` ("Sync needs attention"), and only an app
restart recovered. Reproduced and fix verified end-to-end on the emulator
with a 10-second-TTL API.

### Expected Outcome

An `unauthenticated` sync outcome rotates tokens once and retries.

### Acceptance Criteria

- [x] Fixed in `mobile/src/features/dashboard/application/dashboard.store.ts`
- [x] Regression tests: `dashboard.store.spec.ts` (retry, rotation
      failure, offline mapping)

### Related Documents

- .ai/05_SECURITY.md (token lifetimes)
- .ai/13_MIGRATION_ROADMAP.md (Phase 10)

---

## [BUG-004] Require Cycle: authentication/index.ts ↔ use-session.ts

Status: Done
Priority: P2
Type: Bug
Owner: Unassigned
Created: 2026-07-06
Updated: 2026-07-06

### Description

`use-session.ts` imported from the authentication feature barrel, which
re-exports the hook — a require cycle (Metro warning, risk of
uninitialized values, violates the no-circular-dependencies standard).

### Expected Outcome

The hook imports concrete modules only; no Metro require-cycle warning.

### Acceptance Criteria

- [x] Imports changed to `../application/session-manager` and
      `../domain/session.types`
- [x] Regression guard: `use-session.spec.ts` (barrel mock throws if the
      import chain touches it)

### Related Documents

- .ai/03_CODING_STANDARDS.md (no circular dependencies)

---

## [BUG-005] Duplicate Same-Date Body Weight Surfaced a Raw SQLite Error and Broke the Progress Screen

Status: Done
Priority: P1
Type: Bug
Owner: Unassigned
Created: 2026-08-07
Updated: 2026-08-07

### Description

Found during Phase 20 Gate B6 device validation (release-candidate APK
`1e91f274`, versionCode 4). Recording a body weight for a user-local date that
already had one made `createBodyWeight` INSERT a duplicate, violating
`body_weights UNIQUE(user_id, date)`. The raw exception ("Call to function
'NativeStatement.finalizeAsync' has been rejected … UNIQUE constraint failed:
body_weights.user_id, body_weights.date") reached the UI via the store
(`error: err.message`) and the whole ProgressScreen fell into the full-screen
"Progress unavailable" state. `body_measurements` shared the same latent
pattern. Violates the mobile error-handling standard (no raw internals to
users; graceful failure) and the TECHDEBT-003 sanitized-error pattern.

### Expected Outcome

Re-entering a weight/measurement for the same date updates that day's entry
(id-stable upsert; last-write-wins by `version`, ADR-P016 D6) instead of
throwing. Any unexpected persistence failure shows a safe, generic message and
leaves the Progress screen usable; raw SQLite/native text never renders.

### Acceptance Criteria

- [x] `createBodyWeight` / `createBodyMeasurement` upsert by `(user_id, date)`:
      existing active same-date row is UPDATED in place (stable id, version+1,
      enqueue UPDATE), else INSERT + enqueue CREATE — one transaction, mirrors
      `upsertProgressSnapshot`. Owner-scoped check (never another user's row).
      No schema/migration change.
- [x] Progress store maps failures to safe copy (`LOAD_ERROR` / `SAVE_ERROR`),
      logs the raw error via `logError` (no swallow), and a save failure keeps
      `status: 'ready'` (screen usable) rather than wiping it.
- [x] ProgressScreen renders a save failure as an inline banner; the
      full-screen "Progress unavailable" is reserved for load failures.
- [x] Regression tests: repository upsert (insert + same-date update branches,
      id-stable, owner-scoped, no duplicate INSERT, offline UPDATE enqueue) for
      weight and measurement; store (screen-usable + sanitized, raw text not
      surfaced); screen (inline save banner, forms remain).
- [x] Device-verified on-device in the Phase 20 Gate B6 revalidation
      (2026-08-10): the fixed production-validation APK (source `d976c66`) on the
      appfitness emulator reproduced the same-date weight/measurement scenarios
      with one logical server row each (latest values, no raw error / no screen
      wipe) and the offline→reconnect round-trip synced with no duplicates or
      conflicts. See `docs/PHASE20_EXTERNAL_GATES.md` Gate B6.

### Related Documents

- .ai/12_DECISIONS.md (ADR-P016 D6 — conflict/duplicate semantics; ADR-0006)
- .ai/03_CODING_STANDARDS.md (no silent error swallowing) · .ai/06_MOBILE.md (error handling)
- [TECHDEBT-003] (sanitized-error pattern)

---

## [BUG-006] Dormant EvaluationHistory Is Unrouted and Pushes to a Non-Existent `/evaluation-edit`

Status: Open
Priority: P3
Type: Bug
Owner: Unassigned
Created: 2026-08-28
Updated: 2026-08-28

### Description

Found during the **UX-2** product-flow review (`.ai/17_PRODUCT_FLOWS.md` v1.0),
verified against `origin/main` `4c319e94`.

`mobile/src/features/medical/presentation/EvaluationHistory.tsx` exports
`EvaluationHistory()`, but **no route or screen imports it** — the only
repository reference to the symbol is its own declaration. It is therefore
**user-unreachable**: there is no navigation path to it from any of the 14
user-facing routes in `mobile/src/app/`.

The component also calls `router.push('/evaluation-edit')`, and
**`mobile/src/app/evaluation-edit.tsx` does not exist**. Expo Router resolves
routes from that directory, so the push targets a route with no file behind it.

**No user is affected today.** The medical domain is dormant for public-v1 by
**ADR-P017**, and the component is unreachable, so this is a **latent repository
defect**, not a product regression and not shipped behaviour. It is recorded
explicitly because the UX-2 specification needed to state that it is *not* an IA
decision, and because it is a trap for whoever revives the medical domain:
wiring the surface up without first providing the route would send users into a
dead navigation target.

P3 because impact is currently zero and the fix is small; it is tracked rather
than fixed silently so the constraint below is not lost.

### Evidence

- `rg "EvaluationHistory" mobile/src` → matches in **two files only**: the single
  production declaration (`features/medical/presentation/EvaluationHistory.tsx`,
  `export function EvaluationHistory()`) and its own test file
  (`EvaluationHistory.spec.tsx`, which imports and renders it several times).
  The command returns **several** lines, not one — the point is that **no route
  or screen imports it**; the component's only consumer is its spec.
- `ls mobile/src/app/evaluation-edit.tsx` → **no such file**; the 14 route files
  do not include it.
- `EvaluationHistory.tsx` contains `router.push('/evaluation-edit')`.
- `.ai/17_PRODUCT_FLOWS.md` §"Known repository defect" and §Unresolved risks.

### Expected Outcome

The repository contains no navigation target that cannot resolve. Either the
dangling push is removed while the domain stays dormant, or — if and only if the
medical domain is later revived under its own authorization — the route exists
before the surface becomes reachable. In neither case does a user encounter a
push to a missing route.

### Acceptance Criteria

- [ ] No source file pushes to `/evaluation-edit` while
      `mobile/src/app/evaluation-edit.tsx` does not exist.
- [ ] A check proves the invariant generally: every `router.push` /
      `router.replace` string literal in `mobile/src` resolves to a file in
      `mobile/src/app/`. Manual verification is acceptable for V1; a test or lint
      rule is preferred.
- [ ] `EvaluationHistory` is either (a) left dormant with the dangling push
      removed, or (b) deleted, or (c) routed — **(c) only under a separate
      authorization that lifts ADR-P017 dormancy**.
- [ ] Whichever option is taken, **no medical surface becomes user-reachable in
      public-v1** as a side effect.
- [ ] No change to medical data handling, encryption, or the medical schema.
- [ ] `.ai/17_PRODUCT_FLOWS.md` is updated if the resolution changes what the
      flow document asserts.

### Constraints

**ADR-P017 (public-v1 wellness rebaseline) governs this.** Medical surfaces are
**dormant for public-v1**, so the fix is **not** "create `/evaluation-edit`".
Adding that route would make a dormant medical surface reachable and would
contradict an accepted ADR. The default resolution is to remove the dangling
push (or the dead component) and leave the domain dormant.

### Related Documents

- `.ai/17_PRODUCT_FLOWS.md` (UX-2 — where this was found)
- `.ai/12_DECISIONS.md` (ADR-P017 — public-v1 dormancy of medical surfaces)
- `.ai/06_MOBILE.md` (navigation expectations)

---

## [BUG-007] Food Log Renders a Sync Conflict as `error`, and Merges It with an Unrelated Failure

Status: Open
Priority: P2
Type: Bug
Owner: Unassigned
Created: 2026-08-28
Updated: 2026-08-28

### Description

Found during the **UX-3B** state-matrix audit
(`.ai/18_SCREEN_STATE_MATRICES.md`, contradiction **C-3**), verified against
`origin/main` `fb02097593ff9a2735f54620d6350d880cf3a030`.

`.ai/08_UI_UX.md` §Canonical State Patterns, non-negotiable distinction 5:
*"Conflict ≠ Error. A conflict is a both-versions-preserved outcome awaiting a
decision … It is `warning`, not `error`."*

Food Log breaks that rule in two ways.

1. **Wrong tone.** `mobile/src/features/nutrition/infrastructure/food-log.repository.ts:255`
   writes `sync_status = 'conflict'`, and `:369` maps `'conflict'` to the domain
   state `'action_required'`. `FoodLogScreen.tsx:41-51` renders that state as
   `<Banner tone="error">`, and `:79-87` renders the per-item chip with
   `tone="error"`. Both other conflict surfaces in the product are conformant:
   the dashboard sync banner (`sync-status-banner.tsx:32`, `warning`) and
   `ExerciseLibrary` (`ExerciseLibrary.tsx:46`, `warning`). Food Log is the
   outlier.
2. **Two causes collapsed into one state.**
   `mobile/src/features/nutrition/domain/food-log.ts:33-37` documents
   `action_required` as covering *"`CATALOG_REVISION_UNSUPPORTED` **or** a
   version conflict"*. Those need different user actions, and the state model's
   opening rule is that *"collapsing any two destroys information the user
   needs"*.

P2 because it misrepresents a data-integrity outcome: a conflict is a
both-versions-preserved state, and presenting it as a failure invites the user to
assume data was lost.

### Evidence

- `food-log.repository.ts:255` — `UPDATE meal_items SET sync_status = 'conflict'`
- `food-log.repository.ts:369` — `if (status === 'conflict') return 'action_required';`
- `FoodLogScreen.tsx:41-51` — `case 'action_required':` → `<Banner … tone="error">`
- `FoodLogScreen.tsx:79-87` — `ItemSyncChip` → `tone="error"`
- `sync-status-banner.tsx:30-36` and `ExerciseLibrary.tsx:43-52` — the two
  conformant conflict surfaces, both `warning`
- `.ai/08_UI_UX.md` §Canonical State Patterns, distinctions 1 and 5

### Expected Outcome

A sync conflict renders with `warning` tone and copy that invites a decision
without implying damage. A catalog-revision failure is a separate state with its
own copy. Neither is presented as the other.

### Acceptance Criteria

- [ ] Conflict-derived state in Food Log renders `warning`, not `error`.
- [ ] `CATALOG_REVISION_UNSUPPORTED` and version conflict are distinguishable to
      the user.
- [ ] A regression test asserts the tone for each.
- [x] EN/ES copy for both is specified under **UX-3C** before implementation
      (`.ai/19_COPY_DECKS.md`; catalog incompatibility stays on the shipped
      `action*` family and Conflict receives a separate proposed family).

### Related Documents

- `.ai/18_SCREEN_STATE_MATRICES.md` (UX-3B — C-3, and surface 8)
- `.ai/19_COPY_DECKS.md` (UX-3C — Food Log catalog/Conflict copy split)
- `.ai/08_UI_UX.md` (§Canonical State Patterns)
- `.ai/12_DECISIONS.md` (ADR-P022 — the state model)

---

## [BUG-008] Food Log Write Failures Are Silent

Status: Open
Priority: P2
Type: Bug
Owner: Unassigned
Created: 2026-08-28
Updated: 2026-08-28

### Description

Found during the **UX-3B** state-matrix audit
(`.ai/18_SCREEN_STATE_MATRICES.md`, contradiction **C-4**), verified against
`origin/main` `fb02097593ff9a2735f54620d6350d880cf3a030`.

`mobile/src/features/nutrition/application/food-log.store.ts` sets the store's
`error` field when a write fails — `addFood` (`:124-125`), `editServing`
(`:134-136`) and `removeItem` (`:145-147`), each with its own localizable
message.

`FoodLogScreen.tsx` **never reads that field**. Its only error branch is
`status === 'error'` (`:286-289`), and `status` is set to `'error'` only by
`load()` (`food-log.store.ts:114`).

**Effect:** a failed add, serving edit or removal renders nothing at all. The
user's action silently does not take effect, with no explanation and no way to
tell a failure from a no-op. `.ai/06_MOBILE.md` §Error Handling: *"Never leave
users without feedback."*

This is not a house convention. `ProgressScreen` implements the correct
two-branch pattern — a load error (`ProgressScreen.tsx:129-133`) and a
**separate** inline save error that does not wipe the forms (`:136-140`), each
with its own spec. Food Log is missing the second half.

P2 because it affects the daily write path of a daily-use feature and can cause
a user to believe data was recorded when it was not.

### Evidence

- `food-log.store.ts:124-125`, `:134-136`, `:145-147` — `set({ error: … })` on
  each write failure
- `FoodLogScreen.tsx` — no reference to the store's `error` field anywhere
- `FoodLogScreen.tsx:286-289` — the only error branch, gated on `status`
- `food-log.store.ts:114` — the only assignment of `status: 'error'`
- `ProgressScreen.tsx:129-140` and its specs *"surfaces a localized load
  error…"* / *"surfaces a localized save error inline (distinct from load)…"* —
  the reference pattern

### Expected Outcome

A failed food-log write surfaces a localized, non-technical message that is
distinguishable from a load failure and does not discard the user's input.

### Acceptance Criteria

- [ ] Add, serving-edit and remove failures each surface a user-visible state.
- [ ] The message is localized EN/ES and never renders the store's raw string.
- [ ] Write-error copy is distinguishable from load-error copy.
- [ ] Regression specs cover at least one failing write per operation.

### Related Documents

- `.ai/18_SCREEN_STATE_MATRICES.md` (UX-3B — C-4, and surfaces 8 and 10)
- `.ai/19_COPY_DECKS.md` (UX-3C — distinct add/edit/remove failure copy)
- `.ai/06_MOBILE.md` (§Error Handling)

---

## [BUG-009] Progress Summary Card Renders a Failed Read as "Nothing Recorded"

Status: Open
Priority: P3
Type: Bug
Owner: Unassigned
Created: 2026-08-28
Updated: 2026-08-28

### Description

Found during the **UX-3B** state-matrix audit
(`.ai/18_SCREEN_STATE_MATRICES.md`, contradiction **C-5**), verified against
`origin/main` `fb02097593ff9a2735f54620d6350d880cf3a030`.

`mobile/src/features/progress/presentation/ProgressSummaryCard.tsx` branches on
`status === 'web-unavailable'` (`:41-52`) and on `status === 'loading' || 'idle'`
(`:67-68`). It has **no `status === 'error'` branch**, so a failed read falls
through to the same arm as a successful one. With empty arrays in the store the
card then renders `progress.card.noWeight` and `progress.card.prompt` — telling
the user they have recorded nothing, when in fact the read failed.

This is the Loading-versus-Empty confusion the state model forbids, applied to
Error: a failure is presented as a true answer. `.ai/08_UI_UX.md` §Canonical
State Patterns is explicit that Empty means *"the read **succeeded** and the
collection is genuinely empty"*.

The card's Loading branch is additionally **untested** — no spec in
`ProgressSummaryCard.spec.tsx` asserts it.

P3 because the card is a preview surface and the full Progress screen one tap
away does report the error correctly — but it is the dashboard's only progress
signal, and it currently misreports failure as absence.

The matrix records the card's Error state as **PROPOSED** — applicable, because
`ProgressStatus` includes `'error'` and the card runs its own read, but
unimplemented — with this bug as its owner.

### Evidence

- `ProgressSummaryCard.tsx:41-107` — branches for `web-unavailable` and
  `loading`/`idle` only; no `error` branch
- `progress.store.ts:47` — the status union does include `'error'`
- `ProgressSummaryCard.spec.tsx` — eight tests, none for loading or error
- `.ai/08_UI_UX.md` §Canonical State Patterns — Empty requires a **succeeded**
  read

### Expected Outcome

A failed progress read renders a distinct, localized state on the card that a
user cannot mistake for "you have not recorded anything yet".

### Acceptance Criteria

- [ ] The card renders a distinct state when `status === 'error'`.
- [ ] Empty is reachable only after a successful read.
- [ ] Specs cover the card's loading and error branches.
- [x] EN/ES copy is specified under **UX-3C** before implementation
      (`progress.card.errorTitle` / `errorBody` in `.ai/19_COPY_DECKS.md`).

### Related Documents

- `.ai/18_SCREEN_STATE_MATRICES.md` (UX-3B — C-5, and surface 4)
- `.ai/19_COPY_DECKS.md` (UX-3C — Progress summary card)
- `.ai/08_UI_UX.md` (§Canonical State Patterns)

---

## [BUG-010] Shared Loading Skeleton Carries a Hardcoded English Accessibility Label

Status: Open
Priority: P3
Type: Bug
Owner: Unassigned
Created: 2026-08-28
Updated: 2026-08-28

### Description

Found during the **UX-3B** state-matrix audit
(`.ai/18_SCREEN_STATE_MATRICES.md`, contradiction **C-8**), verified against
`origin/main` `fb02097593ff9a2735f54620d6350d880cf3a030`.

`mobile/src/features/dashboard/presentation/components/dashboard-skeleton.tsx:11`
sets `accessibilityLabel="Loading dashboard section"` as a hardcoded English
string literal, repeated on each of the three placeholder cards.

`DashboardSkeleton` is not only the dashboard's loading treatment: it is the
**session-resolution loader for 12 routes**, so on a Spanish-locale device this
English string is **exposed to assistive technology** on essentially every
authenticated entry into the app.

**What is claimed and what is not.** The label is set, and it is exposed — that
is verifiable from the source. Whether, when, or how a given screen reader
*announces* it is **not** claimed here: no manual VoiceOver, TalkBack or
browser-AT pass has been run, and that verification is the **UX-4C** gate.

It is the only unlocalized user-exposed string among the ten state-bearing
surfaces audited and the cross-cutting session-resolution phase. The catalogue is
otherwise at exact EN/ES parity (696 keys each).

`.ai/06_MOBILE.md` §Internationalization and the repository mobile rules both
forbid hardcoded user-facing strings.

P3 because it is invisible to sighted users and does not affect data — but it is
a bilingual-parity and accessibility defect on the most frequently rendered
component in the app.

### Evidence

- `dashboard-skeleton.tsx:11` — `accessibilityLabel="Loading dashboard section"`
- `rg "DashboardSkeleton" mobile/src/app` → **12** route files
- EN/ES catalogues: **696 keys each**, exact parity; no key covers this string
- `.ai/06_MOBILE.md` §Internationalization

### Expected Outcome

The skeleton's accessible label comes from the localization catalogue in both
languages, like every other user-exposed string, so nothing English is exposed to
assistive technology on a Spanish-locale device.

### Acceptance Criteria

- [ ] The label is supplied via `t()` from a new key.
- [ ] EN and ES entries are added together, preserving exact parity.
- [ ] No hardcoded user-facing string remains in the component.
- [x] The key's copy is specified under **UX-3C**
      (`common.loadingContentAccessibility`); no accessibility **outcome**
      may be claimed before the **UX-4C** manual AT pass.

### Related Documents

- `.ai/18_SCREEN_STATE_MATRICES.md` (UX-3B — C-8, §Cross-cutting and surface 1)
- `.ai/19_COPY_DECKS.md` (UX-3C — cross-cutting session resolution)
- `.ai/06_MOBILE.md` (§Internationalization)
- `.ai/12_DECISIONS.md` (ADR-P023 / ADR-P024 — accessibility staging)

---

## [BUG-011] Local-First Row State Is Never Surfaced on Three Screens That Carry It

Status: Open
Priority: P2
Type: Bug
Owner: Unassigned
Created: 2026-08-28
Updated: 2026-08-28

### Description

Opened by the **UX-3B** state-matrix audit
(`.ai/18_SCREEN_STATE_MATRICES.md`, surfaces 5, 9 and 10; findings **C-1** and
**C-2**), verified against `origin/main`
`fb02097593ff9a2735f54620d6350d880cf3a030`.

Three screens list rows the user wrote, those rows expose a `syncStatus`
(`'pending' | 'synced' | 'conflict'`, `database/types.ts:11`), and the sync
appliers set it — yet the screens render **no treatment** for it:

| Screen | Pending sync | Conflict |
|---|---|---|
| Workout Log | SHIPPED — two row-level hints | **missing** |
| Dietary Preferences | **missing** | **missing** |
| Progress | **missing** | **missing** |

The matrices record each missing treatment as **PROPOSED** with this bug as its
owner — applicable, because the source state provably reaches the surface, but
unimplemented.

**Offline is deliberately excluded from this bug.** No authoritative connectivity
or sync signal is exposed to the three surfaces above at this commit, so there is
nothing for them to render — the matrices record that as justified `n/a`,
describing what those surfaces **currently receive** rather than what they could
ever receive. Exposing that signal more widely is a design change with no owning
slice, not a conformance defect, and it is out of scope here.

P2 because it silently withholds data-integrity information: a user whose
weigh-in is queued, or whose exclusion diverged from the server, is shown a row
that looks identical to a fully synced one. Progress is the sharpest case — it is
the most staleness-sensitive surface in the product and the least able to express
it.

### Evidence

- `database/types.ts:11` — `SyncStatus = 'pending' | 'synced' | 'conflict'`
- Workout: `workout.ts:57`, `:111`; `workout/infrastructure/sync-appliers.ts:47`,
  `:59`; `workout/infrastructure/workout.repository.ts:325`. `WorkoutLogScreen.tsx:32-43` and `:210-217`
  read the same field for `'pending'` and ignore `'conflict'`.
- Dietary preferences: `dietary-preference.ts:49`, `:67` (the row exposes
  `syncStatus`); `nutrition/infrastructure/dietary-preference.repository.ts:107` (writes re-mark the row
  `pending`) and `:158` (`sync_status = 'conflict'`);
  `nutrition/infrastructure/sync-appliers.ts:32` registers the applier. No hint
  of any kind in `DietaryPreferences.tsx`.
- Progress: `progress.ts:43`, `:89`, `:129`; `progress/infrastructure/progress.repository.ts:69`, `:94`,
  `:146`, `:180` (writes land `pending`), `:222`, `:493`, `:657`
  (`mark*Conflict`); `progress/infrastructure/sync-appliers.ts:29`, `:35`, `:41`.
  No hint of any kind in `ProgressScreen.tsx`.
- `.ai/08_UI_UX.md` §Canonical State Patterns — Pending sync must reassure;
  Conflict is `warning` and awaits a decision.

### Expected Outcome

Every screen that lists rows carrying a `syncStatus` surfaces the pending and
conflict conditions with the tones the state model requires, consistently with
the two row-level hints Workout Log already ships.

### Acceptance Criteria

- [ ] Workout Log renders a Conflict treatment on workout and set rows.
- [ ] Dietary Preferences renders Pending sync and Conflict on exclusion rows.
- [ ] Progress renders Pending sync and Conflict on body weights, measurements
      and weekly snapshots.
- [ ] Conflict uses `warning`, never `error` (see BUG-007).
- [x] EN/ES copy is specified under **UX-3C** before implementation for Workout
      Log, Dietary Preferences and Progress (`.ai/19_COPY_DECKS.md`).
- [ ] Specs cover each new treatment; no accessibility outcome is claimed before
      the **UX-4C** manual AT pass.

### Related Documents

- `.ai/18_SCREEN_STATE_MATRICES.md` (UX-3B — surfaces 5, 9, 10; C-1, C-2)
- `.ai/19_COPY_DECKS.md` (UX-3C — row-level Pending/Conflict reporting)
- `.ai/08_UI_UX.md` (§Canonical State Patterns)
- `.ai/06_MOBILE.md` (§Offline First, §Synchronization)

---

## [BUG-012] No Conflict Resolution Path Exists in Public V1

Status: Open
Priority: P2
Type: Bug
Owner: Unassigned
Created: 2026-08-28
Updated: 2026-08-28

### Description

Opened by the **UX-3B** state-matrix audit
(`.ai/18_SCREEN_STATE_MATRICES.md` §Residual risks), verified against
`origin/main` `fb02097593ff9a2735f54620d6350d880cf3a030`.

**Scope: public V1 only.** This bug is about the reachable public-v1 product. It
makes **no claim about, and requires no change to, the dormant medical domain**,
which stays dormant under **ADR-P017** and is out of scope here exactly as it is
in the matrices.

`.ai/08_UI_UX.md` §Canonical State Patterns defines Conflict as *"Two versions
diverged; the system **refuses to silently overwrite**"*, with the required user
action **"Review and choose"** and the recovery path *"An explicit user
decision"*.

Three public-v1 surfaces **report** a conflict — the dashboard sync banner
(`sync-status-banner.tsx:30-36`), Food Log's banner and item chip
(`FoodLogScreen.tsx:41-51`, `:79-87`), and `ExerciseLibrary`'s badge
(`ExerciseLibrary.tsx:43-52`). **None of them, and no other public-v1 surface,
lets the user review the two versions or choose one.** There is no resolution
screen, no per-row choose action, and no localization key family for one.

The state's required user action is therefore unimplemented across public V1. A
user told that a record diverged has no path forward from any reachable surface.

P2 because it leaves a data-integrity decision permanently pending: both versions
are preserved by design (`00_PROJECT.md`; ADR-P016 D6), so nothing is lost — but
nothing can be resolved either, and the count can only grow.

This is **missing behaviour, not wrong behaviour**, which is why it is separate
from BUG-007 (wrong tone) and BUG-011 (missing reporting).

**This bug does not authorize a design.** A resolution path changes screen
inventory, navigation and data semantics. Its flow, screens, behaviour and copy
require a **separately authorized product/architecture specification** before any
implementation. In particular, **UX-3C may specify only the existing
conflict-reporting copy** — the banners and badges listed above — and **must not
invent resolution-screen copy or a resolution flow**.

### Evidence

- `.ai/08_UI_UX.md` §Canonical State Patterns — Conflict: user action *"Review
  and choose"*, recovery *"An explicit user decision"*
- Reporting surfaces: `sync-status-banner.tsx:30-36`,
  `FoodLogScreen.tsx:41-51` and `:79-87`, `ExerciseLibrary.tsx:43-52`
- `mark*Conflict` writers exist across the workout, nutrition, progress and
  profile slices (`*/infrastructure/sync-appliers.ts`), so conflicts are
  producible in four public-v1 feature slices
- Localization: **5** keys contain `conflict`, all of them reporting copy; none
  offers a choice
- No route in `mobile/src/app/` addresses conflict resolution

### Expected Outcome

A user who is told a record diverged can review the diverging versions and choose
one, from at least one surface, without either version being silently discarded.

### Acceptance Criteria

- [ ] A separately authorized specification defines the resolution flow, its
      screen inventory, its behaviour and its copy **before** any implementation.
- [ ] A resolution path exists and is reachable from the public-v1 surfaces that
      report a conflict.
- [ ] Both versions remain preserved until the user chooses; nothing is
      auto-resolved.
- [ ] The choice is recorded through the repository layer, never by direct
      SQLite access from the UI.
- [ ] The dormant medical domain stays dormant (**ADR-P017**); nothing here makes
      a medical surface reachable.
- [x] **UX-3C** specifies only conflict-**reporting** copy and adds
      no resolution-screen copy.

### Related Documents

- `.ai/18_SCREEN_STATE_MATRICES.md` (UX-3B — §Residual risks; surfaces 2 and 8)
- `.ai/19_COPY_DECKS.md` (UX-3C — reporting-only boundary)
- `.ai/08_UI_UX.md` (§Canonical State Patterns)
- `.ai/00_PROJECT.md` (§Decision Hierarchy — data integrity)
- `.ai/12_DECISIONS.md` (ADR-P016 D6 — historical records are never silently
  overwritten)

---

## [BUG-013] Trend-Chart Point Labels Expose a Raw `YYYY-MM-DD` to Assistive Technology

Status: Open
Priority: P3
Type: Bug
Owner: Unassigned
Created: 2026-08-28
Updated: 2026-08-28

### Description

Opened by the **UX-3D** audit (`.ai/20_PROGRESS_NONVISUAL.md` §Findings F-1),
verified against `origin/main` `d41efc69df4a48c0b0fb4f4ca2ad8884c6e648b7`.

`ProgressScreen.tsx:104`, `:108` and `:113` pass each stored `YYYY-MM-DD`
string straight through as `TrendPoint.label`, and `TrendBars.tsx:108` renders
it verbatim inside the per-bar `accessibilityLabel`:

```
accessibilityLabel={`${p.label}: ${formatNumber(p.value, language)}${unit}`}
```

Every other date on the Progress surface is localized — the latest-weight line
(`ProgressScreen.tsx:148-152`) and `WeeklySnapshotSummary` (`:44-46`) both call
`formatDate` with the active language. The bar label is the **only** date on
this surface exposed in raw storage format, and it is exposed on a path that
**only assistive-technology users reach**: the bars carry no visible text.

The volume chart compounds it. Its label is a **week start**
(`ProgressScreen.tsx:108`) announced as if it were a point date, with nothing
marking it as a week.

P3 because it is invisible to sighted users and affects no data — but it is a
bilingual-parity and accessibility defect on the surface UX-3D exists to make
perceivable, and it is a precondition of that specification rather than part of
it.

### Evidence

- `TrendBars.tsx:107-109` — the per-bar `accessible` + `accessibilityLabel`
- `ProgressScreen.tsx:103-117` — all three series map raw `date` / `weekStart`
  into `TrendPoint.label`
- `WeeklySnapshotSummary.tsx:41-46` — `parseLocalDate` + `formatDate`, the
  correct pattern already in the same feature
- EN/ES catalogues: **696 keys each**, exact parity; no key is involved — this is
  a formatting defect, not a missing string

### Expected Outcome

Every date a user can perceive on the Progress surface, visually or through
assistive technology, is formatted in the active language; week-period points
are identifiable as weeks.

### Acceptance Criteria

- [ ] Point labels render a localized date via `formatDate` +
      `parseLocalDate` — no UTC day shift (ADR-P016 D6).
- [ ] Week-period points are prefixed with `progress.weekly.weekOf`.
- [ ] Regression specs assert the localized label in **EN and ES** (UX-3D R-1,
      R-2).
- [ ] No accessibility **outcome** is claimed before the **UX-4C** manual pass.

### Related Documents

- `.ai/20_PROGRESS_NONVISUAL.md` (UX-3D — F-1, and the point-label
  specification)
- `.ai/06_MOBILE.md` (§Internationalization)
- `.ai/12_DECISIONS.md` (ADR-P016 D6 — local calendar dates)

---

# Security Backlog

## [SECURITY-001] Local Sensitive Data Protection

Status: Proposed
Priority: P1
Type: Security
Owner: Unassigned
Created: 2026-07-03
Updated: 2026-07-03

### Description

Define and implement secure storage rules for sensitive local data.

### Acceptance Criteria

* [ ] Tokens stored only in SecureStore
* [ ] Medical notes are not stored in plaintext without an approved strategy
* [ ] SQLite encryption strategy documented
* [ ] No sensitive data appears in logs
* [ ] Offline security behavior validated

### Related Documents

* .ai/05_SECURITY.md
* .ai/04_DATABASE.md

---

# Technical Debt Backlog

## [TECHDEBT-001] MVP Email Domain Validation Is Resolution-Only, Not Deliverability-Aware

> **Strategy decided 2026-08-27 by ADR-P026.** The email-verification strategy is
> now an explicit decision rather than inherited MVP behaviour: a
> **confirmation-email flow** (single-use, hash-only, 24-hour token) replaces
> reliance on domain resolution as a proxy for deliverability. Delivery is tracked
> under **FEATURE-011**; this item closes when Vertical 2 ships and the fail-open
> DNS behaviour is deliberately re-decided or removed.

Status: Proposed
Priority: P3
Type: Refactor
Owner: Unassigned
Created: 2026-07-03
Updated: 2026-07-03

### Description

During Phase 0 MVP baseline documentation (`.ai/14_CURRENT_MVP_BASELINE.md`),
inspection of `server/src/services/auth.service.ts` found that
registration's email-domain check (`domainAcceptsEmail`) only confirms
the domain resolves via `dns.lookup` (OS resolver). It does not perform
an MX-specific check, and treats any resolver/network error as "valid"
(fails open).

### Problem

A domain that resolves (e.g. has only an A record, no mail server) is
currently accepted as a valid registration email, and transient
DNS/network failures silently pass validation rather than being retried
or rejected. This does not verify the address can actually receive mail.

### Expected Outcome

When authentication is rebuilt in Migration Phase 6
(`.ai/13_MIGRATION_ROADMAP.md`), the new implementation should use a more
deliberate email verification strategy (e.g. MX-record lookup and/or a
confirmation-email flow) instead of carrying this validation logic
forward as-is.

### Acceptance Criteria

- [ ] Email verification strategy for the new auth module is explicitly
      decided (not inherited by default) during Phase 6
- [ ] Behavior for DNS/network failures during validation is a
      deliberate choice, not an implicit fail-open

### Related Documents

- .ai/14_CURRENT_MVP_BASELINE.md
- .ai/13_MIGRATION_ROADMAP.md (Phase 6)
- .ai/05_SECURITY.md

---

## [TECHDEBT-002] audit_logs Immutability Trigger Blocks GDPR User Hard-Deletion

Status: **Done** (2026-07-08, Phase 12 Step 6 — resolved per ADR-P011
revised/CASCADE approach; see resolution note below)
Priority: P1 (raised from P2 on 2026-07-07: Phase 12 store release
work makes this release-impacting — a Google Play data-safety form
cannot truthfully claim account/data deletion while hard-deletion is
blocked at the database level; resolve before any tester-facing
release that advertises deletion)
Type: Refactor

### Resolution (2026-07-08)

Fixed via ADR-P011 (Accepted, CASCADE revision): migration
`account_deletion_cascade` flips 24 user-owned FKs to `ON DELETE
CASCADE` (catalog FKs stay RESTRICT) and relaxes the audit immutability
trigger to permit ONLY the `user_id -> NULL` anonymizing update. The
authenticated `DELETE /auth/account` endpoint (`AuthService.deleteAccount`)
cascades user-owned data, records an `ACCOUNT_DELETE` event, and
anonymizes the user's audit rows. Mobile `deleteAccount()` wipes the
local session + database after server success. Proven by
`test/account-deletion.e2e-spec.ts` against real Postgres (cascade +
audit anonymization + retained deletion event + preserved immutability).
Remaining: surface a confirmation UI and finalize the retention window
(RELEASE-001 / legal review).
Owner: Unassigned
Created: 2026-07-06
Updated: 2026-07-07

### Description

Discovered during Phase 6 validation: `audit_logs.user_id` has
`ON DELETE SET NULL`, but the `trg_audit_logs_immutable` trigger rejects
ALL updates — including the FK-driven SET NULL. A hard `DELETE FROM
users` for a user who has audit rows will therefore fail at the database
level.

### Problem

The GDPR retention-cleanup flow (physical deletion of
`PENDING_DELETION` accounts after retention expiry) cannot hard-delete
users once they have audit entries — which every user will have from
registration onward.

### Expected Outcome

Before implementing the account-deletion flow, choose and implement one:
(a) trigger allows updates that only null `user_id` (FK cascade shape),
(b) deletion procedure anonymizes audit rows in a controlled,
security-reviewed migration/procedure, or (c) audit rows keep the user
UUID with no FK (UUID of a deleted user is not by itself PII —
requires privacy review).

**Update 2026-07-08 (Phase 12 Step 5):** resolution strategy designed in
**ADR-P011 (Proposed)** — recommends option (a) (null-only audit-trigger
exception) plus a transactional deletion service for the RESTRICT
children and crypto-erasure of encrypted medical fields. Also note the
blocker is broader than audit_logs alone: `user_profiles`, `goals`,
`medical_*`, `health_logs`, and workout tables use `ON DELETE RESTRICT`.
Awaiting ADR-P011 acceptance before implementation. This blocks truthful
Play Data Safety deletion answers (see docs/legal/PLAY_DATA_SAFETY.md).

### Related Documents

- .ai/12_DECISIONS.md (ADR-P011)

- .ai/05_SECURITY.md (Data Retention, Audit Trail)
- .ai/15_DATABASE_SCHEMA_DESIGN.md
- api/prisma/migrations/20260703181824_init/migration.sql

---

## [TECHDEBT-003] Dashboard Store Swallows Underlying Errors Silently

Status: Done
Priority: P2
Type: Refactor
Owner: Unassigned
Created: 2026-07-06
Updated: 2026-07-06 (resolved in Phase 11 Step 1)

### Description

Found during Phase 10 validation: the `catch` blocks in
`mobile/src/features/dashboard/application/dashboard.store.ts`
(`refresh`, `syncNow`, `loadSampleData`) map every failure to a generic
user-facing message and discard the underlying error. Diagnosing BUG-002
required log archaeology because the FK violation was never surfaced.
This conflicts with the "no silent error swallowing" standard.

### Expected Outcome

Failures still show safe, generic UI messages, but the underlying error
is reported through a deliberate channel (dev logging now; the error
reporting strategy from `10_DEPLOYMENT.md` later). No medical data or
tokens may appear in logs (`05_SECURITY.md`).

### Acceptance Criteria

- [x] Store catches route the caught error to a sanctioned logger in dev —
      `mobile/src/shared/infrastructure/logging/logger.ts` (`__DEV__`-gated),
      wired into dashboard store (refresh/syncNow/loadSampleData),
      session-storage corrupted-session path, session-manager best-effort
      logout, and the sync worker's rejected-op warning
- [x] No sensitive data in the logged output — context keys matching
      token/password/secret/key/notes/conditions/medications/payload are
      redacted; covered by `logger.spec.ts`
- [x] User-facing messages unchanged — asserted by existing store specs

### Related Documents

- .ai/03_CODING_STANDARDS.md (no silent error swallowing)
- .ai/05_SECURITY.md

---

## [TECHDEBT-004] Dormant Nutrition Schema Has Three Latent Integrity Risks (blocks Slice 4)

Status: Open (approved for resolution in Slice 4A — ADR-P012 Accepted 2026-07-10)
Priority: P1 (must resolve before food-logging implementation)
Type: Data Integrity / Schema
Created: 2026-07-10

### Description

Discovered during the Phase 15 Slice 4 ADR gate (ADR-P012). The dormant
nutrition tables carry three concrete structural risks that must be resolved
before any food-logging write path is built:

1. **Catalog identity mismatch + missing catalog schema.** `Food.id` /
   `MealItem.foodId` are `@db.Uuid`, but the Slice-2 bundled catalog keys foods
   by slug (`food.chicken_breast`) and **no mapping exists**. The live `Food`
   table also has **no `catalog_key`, no catalog/revision version, and no serving
   metadata**, and documents its macros **"per 100 g"** — so it **cannot receive
   the normalized per-serving catalog seed without a forward schema correction**
   (not purely additive). ADR-P012 proposes that correction plus **revision-
   scoped** deterministic UUIDs (`uuidv5(catalog_key + food_revision)`) with
   **immutable, retained** revisions so older clients stay FK-valid.
2. **No historical macro snapshot.** `MealItem` stores only `food_id` +
   `quantity_grams`. Catalog macros are Atwater estimates and may be corrected;
   without a snapshot, historical daily totals would change retroactively —
   contradicting ADR-0011 (health-data integrity). ADR-P012 proposes new
   per-serving snapshot columns, **derived server-side from the matching
   immutable food revision** (client names/macros untrusted), with totals derived
   from the immutable snapshot.
3. **Serving-unit conflation.** The bundled catalog defines macros **per
   canonical serving**, yet the dormant schema stores `meal_items.quantity_grams`,
   and the catalog itself encodes servings inconsistently — e.g. one 182 g apple
   is authored as `piece(182)` (`{amount: 182, unit: 'piece'}`), mixing a gram
   weight into a "piece" unit. Activating logging against this would produce
   nonsensical quantities. ADR-P012 proposes normalizing each serving to an
   amount + unit with an optional `grams_per_serving`, replacing `quantity_grams`
   with a positive `serving_count`, and permitting gram entry only where a valid
   gram conversion exists (else fractional servings).

All three are captured as decisions in **ADR-P012 (Accepted 2026-07-10)** and are
**approved for resolution in Slice 4A/4B**. As of 2026-07-14, risks 1 (catalog
identity/schema/seed), 2 (server-derived macro snapshot), and risk 3 **part 1**
(29 count-unit `piece` foods normalized) are **resolved**; the item stays
**Open** only for risk 3 **part 2** (data-source gate ADR-P013, Accepted
2026-07-14; **Batch 1 implemented 2026-07-14** - 4 slice foods FDC-sourced;
**Batch 2 implemented 2026-07-14** - 13 tablespoon foods FDC-sourced;
**tsp semantics mini-slice implemented 2026-07-14** - 6 ambiguous `tsp(N)`
foods corrected; **Batch 3A implemented 2026-07-14** - 26 cup-served
grains/legumes/staples FDC-sourced; **Batch 3B implemented 2026-07-14** — 42
cup-served vegetables FDC-sourced (onion/snow_peas/leeks/mixed_greens/broccolini
unmatched); **Batch 3C implemented 2026-07-14** — 14 cup-served fruits
FDC-sourced (pomegranate/dragon_fruit unmatched); **Batch 4 implemented
2026-07-14** — 8 remaining tbsp foods FDC-sourced after re-verification
disproved Batch 2's unmatched verdicts for them (erratum in ADR-P013 Batch 4
note); **Batch 5 implemented 2026-07-14** — 11 ml foods density-derived from
volume-paired portions; **Batch 6 implemented 2026-07-14** — the owner
resolved the zero-macro policy and the 5 policy-class foods (4 beverages +
apple_cider_vinegar) were sourced from their pre-recorded SR candidates;
**Batch 7 implemented 2026-07-14** — the owner-authorized lemon_juice density
mini-batch; **poppy-seeds serving-semantics correction slice implemented
2026-07-14** — the owner-authorized correction of poppy_seeds' teaspoon-scale
authored serving (tbsp(1) → tsp(1) + SR tsp gram weight); **Amendment A1
Batch F1 implemented 2026-07-15** — cup foods matched against the pinned
FNDDS archive, one match (polenta); **Amendment A1 Batch F2 implemented
2026-07-15** — tbsp foods matched, two matches (pesto, tzatziki); **Amendment
A1 Batch F3 implemented 2026-07-15** — ml foods matched, ZERO matches (all 8
need product/composite/third-source decisions; docs/manifest-only slice);
**Amendment A1 Batch F4 implemented 2026-07-15** — sourdough_bread sourced
from FNDDS "Bread, sour dough" (31 g/slice), completing the F1–F4 matching
track; **gate-(a) slices 1–5 implemented 2026-07-15** — onion, snow_peas,
and leeks renamed raw with SR cup weights (160 g / 98 g / 89 g), pomegranate
corrected under owner-approved Option A (net → total carbs, SR 174 g arils
cup), and dragon_fruit corrected under owner-approved Option A (one-fruit
macros → FNDDS 180 g cup scale); **gate-(c) slice implemented 2026-07-16** —
mixed_greens sourced directly from the exact-name FNDDS "Mixed salad greens,
raw" record (2 cup = 70 g), closing gate (c); 22 foods still gated: 9 `cup` +
5 `tbsp` + 8 `ml`). See the status sections below.

### Slice 4A implementation status (2026-07-13) — item still OPEN

Slice 4A landed the **foundation** (schema/identity/seed artifacts + tests); it
deliberately does NOT add the logging write path, sync handlers/appliers, API
routes, or UI. Delivered and code-validated:

- Forward-only Postgres migrations (`20260710120000_add_nutrition_change_audit_action`,
  `20260710120100_nutrition_catalog_serving_model_4a`) and SQLite migration
  `002-nutrition-catalog-4a.ts`, each with an explicit **no-production-data
  preflight guard**; historical migrations untouched.
- `Food` corrected (catalog_key, food_revision, catalog_version, serving
  metadata, per-serving macro rebase) + **partial** unique
  `(catalog_key, food_revision) WHERE catalog_key IS NOT NULL` via reviewed raw
  SQL; `meal_items.quantity_grams` → `serving_count` + immutable per-serving
  snapshot columns.
- Deterministic revision-scoped catalog identity (`uuidv5(catalog_key:food_revision)`,
  fixed namespace), normalized serving helper, server-derived snapshot helper,
  and the canonical seed artifact (mobile `.ts` + api `.json`, byte-identical),
  with mobile/server parity + golden + uniqueness + normalization tests green.

**DB behavioral validation (2026-07-13) — DONE.** Validated against fresh
disposable databases (a throwaway Postgres 16 container on an isolated port and
ephemeral `node:sqlite`; the shared dev DB on 5433 and unrelated containers were
never touched):

- Postgres: `prisma migrate deploy` applied all six migrations; `NUTRITION_CHANGE`
  enum, `foods` serving/catalog columns, `meal_items` `serving_count` + snapshot
  columns present, `quantity_grams` gone, partial unique index exactly
  `(catalog_key, food_revision) WHERE catalog_key IS NOT NULL`. `db:seed` seeded
  **exactly 300 rows**, was **idempotent** on a second run (0 new), a **tampered
  existing revision was not overwritten** (immutability), a duplicate
  `(catalog_key, food_revision)` was **rejected**, and two null-`catalog_key`
  custom foods with the same revision **both inserted** (unconstrained).
- Postgres preflight guard: on a fresh DB seeded to the pre-4A schema with one
  guarded-table row, the 4A migration **aborted with `SLICE_4A_PREFLIGHT_ABORT`
  and rolled back atomically** (foods kept its pre-4A columns).
- SQLite: migrations 001→002 applied via the real migration modules; schema
  shape, all four indexes, the partial-unique predicate + behaviour (duplicate
  rejected, null `catalog_key` free), and `user_version = 2` verified; the 002
  `preflight` hook **threw `SLICE_4A_PREFLIGHT_ABORT`** with data present.

**Status of the three risks:**

1. **Catalog identity — RESOLVED.** Schema correction, revision-scoped UUID
   identity, partial-unique revision constraint, and the seed are now behaviorally
   validated on fresh Postgres and SQLite (above). The identity mismatch and
   missing catalog schema are fixed and proven.
2. **Macro snapshot — RESOLVED (Slice 4B, 2026-07-13).** The `meal_items` sync
   handler now derives the immutable per-serving snapshot **server-side** from
   the matching immutable Food revision at CREATE time; client-supplied
   names/macros/snapshot values are never trusted, only `serving_count` is
   mutable, and an unknown/unsupported revision is rejected with
   `CATALOG_REVISION_UNSUPPORTED`. Covered by unit + pipeline tests (server
   derivation, client-value rejection, immutability on UPDATE). This closes the
   retroactive-macro-change risk. (No logging UI yet — that is a later slice.)
3. **Serving-unit conflation — PARTIALLY RESOLVED (split-risk; 2026-07-14).**
   The normalized structure + `serving_count` replacement were validated in 4A;
   gram sourcing is now split into two parts (see ADR-P012 "Risk-3 Normalization
   Note" and the Slice 4E status section below):
   - **Part 1 — 29 count-unit `piece` foods: RESOLVED.** These were authored
     with the one-piece gram weight in `servingAmount` under a `piece` label (the
     `piece(182)` conflation). Corrected at source to `{amount: 1, unit: 'piece',
     grams: <authored weight>}`, shipped as new immutable revisions (2), with
     `CATALOG_VERSION` bumped to 1.1.0. No weight fabricated — the value was the
     one the catalog already carried.
   - **Part 2 — volumetric + `slice` foods: OPEN, in progress under ADR-P013
     (Accepted 2026-07-14).** **Batch 1 (2026-07-14)** sourced full-serving
     gram weights for 4 of the 5 `slice` foods; **Batch 2 (2026-07-14)** sourced
     13 `tbsp` foods from the same pinned USDA-FDC SR Legacy archive (see
     ADR-P013 Batch 1/2/3A Implementation Notes + the checked-in
     `fdc-portion-manifest.json`); `sourdough_bread` and non-reconciling or
     ambiguous volumetric foods stay null/gated. The tsp semantics mini-slice
     corrected 6 `tsp(N grams)` foods. **Batch 3A (2026-07-14)** sourced 26
     cup-served grains/legumes/staples; **Batch 3B (2026-07-14)** sourced 42
     cup-served vegetables (onion, snow_peas, leeks, mixed_greens, broccolini
     unmatched); **Batch 3C (2026-07-14)** sourced 14 cup-served fruits
     (pomegranate, dragon_fruit unmatched); **Batch 4 (2026-07-14)** sourced 8
     remaining tbsp foods (6 oils, light cream cheese, tomato paste) after
     disproving Batch 2's unmatched verdicts for them — see the ADR-P013
     Batch 4 erratum; **Batch 5 (2026-07-14)** density-derived 11 ml foods
     from volume-paired portions (never assumed 1 g/ml); **Batch 6
     (2026-07-14)** sourced the 5 zero-macro foods after the owner resolved
     the zero-macro policy (gram entry on zero-macro foods scales zeros —
     harmless by design); **Batch 7 (2026-07-14)** density-derived the 1-tbsp
     lemon_juice serving (owner-authorized scoped mini-batch); the
     **poppy-seeds serving-semantics correction slice (2026-07-14)** corrected
     poppy_seeds' teaspoon-scale authored serving to tsp(1) with the SR tsp
     gram weight (owner-authorized); **Amendment A1 Batches F1–F4
     (2026-07-15)** sourced polenta, pesto, tzatziki, and sourdough_bread
     from the pinned FNDDS archive (F3 matched zero ml foods — all 8 need
     product/composite/third-source decisions); **gate-(a) slices 1–5
     (2026-07-15)** corrected and sourced onion, snow_peas, leeks (renamed
     raw, SR 160 g / 98 g / 89 g cups), pomegranate (Option A: net → total
     carbs, SR 174 g arils cup), and dragon_fruit (Option A: one-fruit
     macros → FNDDS 180 g cup scale); the **gate-(c) slice (2026-07-16)**
     sourced mixed_greens directly from the exact-name FNDDS "Mixed salad
     greens, raw" record (2 cup = 70 g). **22 foods remain gated** (9 `cup` +
     5 `tbsp` + 8 `ml`); gram entry stays unavailable for those; the log
     path uses fractional servings meanwhile.

The item stays **Open (partially resolved)** for risk 3 **part 2** only; risks
1, 2, and risk 3 part 1 are resolved. **The SR Legacy + zero-macro-policy
sourcing track is COMPLETE (2026-07-14): 158 of 190 non-gram foods sourced
(incl. the owner-authorized Batch 7 lemon_juice density mini-batch and the
poppy-seeds serving-semantics correction slice, `food-catalog@1.10.1`).**
Under ADR-P013 Amendment A1 (**Accepted 2026-07-14**; FNDDS 2021-2023 pinned
2026-07-14 as `fndds_survey_food_csv_2024-10-31`), **Batch F1 (2026-07-15,
`food-catalog@1.11.0`) matched the cup foods (one match: polenta) and Batch
F2 (2026-07-15, `food-catalog@1.12.0`) matched the tbsp foods (two matches:
pesto, tzatziki); Batch F3 (2026-07-15, docs/manifest-only) matched ZERO ml
foods; Batch F4 (2026-07-15, `food-catalog@1.13.0`) sourced sourdough_bread
(31 g/slice), **completing the A1 matching track: 162 of 190 non-gram foods
sourced. **The A1/FNDDS matching track is CLOSED (exhausted) as of 2026-07-15
— see ADR-P013 "Amendment A1 Matching Track — Closure Note".** Gate-(a)
gate-(a) slices 1–5 (2026-07-15, `food-catalog@1.13.1`–`1.13.5`) then
resolved onion, snow_peas, leeks (authored macros proven raw cup values;
renamed raw with SR cup weights 160 g / 98 g / 89 g), pomegranate (owner
Option A: NET-carbs figure corrected to total carbs 33 + fiber 7, SR 174 g
arils cup, Atwater kcal 162), and dragon_fruit (owner Option A: one-fruit
macros corrected to the FNDDS 180 g cup scale — carbs 29, Atwater kcal 120);
the **gate-(c) slice (2026-07-16, `food-catalog@1.13.6`)** then sourced
mixed_greens directly from the exact-name FNDDS "Mixed salad greens, raw"
record (2 cup = 70 g, macros unchanged) — bringing the total to **168 of 190
non-gram foods sourced; 22 remain intentionally gated** (9 `cup` + 5 `tbsp` +
8 `ml`). The remaining gates each need an explicit owner decision (none
authorized or implied): (a) **EMPTY
— all eight original class-4 foods resolved (2026-07-15): onion, snow_peas,
leeks (raw-label renames); pomegranate, dragon_fruit (owner Option A
authored-macro corrections); coconut_milk_beverage, oat_milk_unsweet,
kombucha_unsweet (owner Option B re-classifications to gate (d) — authored
data correct, only incompatible sweetened/regular variants pinned)**;
(b) **EMPTY — the protein-shake composite policy was RESOLVED by owner
Option B (2026-07-15): protein_shake_water + vegan_protein_shake keep their
authored lean powder-in-water values and were RE-CLASSIFIED to gate (d)
third-source residue (prepared RTD records exist but fail reconciliation as
fattier meal-replacements; powder+water recipe synthesis is A1-forbidden and
was not authorized)**; (c) **EMPTY — the mixed_greens decision was RESOLVED
by owner Option A (2026-07-16): the lettuce-NFS proxy premise was OVERTURNED —
FNDDS has a direct exact-name record 2709792 "Mixed salad greens, raw"
(missed in F1) that reconciles cleanly at the authored 2-cup/70 g serving, so
it was sourced directly as a normal A1 match (macros unchanged, revision 2,
`food-catalog@1.13.6`), decreasing the gated count 23 → 22 and emptying gate
(c)**;
(d) an optional third-source amendment for the 22-food
no-record/varietal/unavailable-variant/composite residue (incl.
coconut_milk_beverage, oat_milk_unsweet, kombucha_unsweet,
protein_shake_water, vegan_protein_shake).
**Per-food gate work is CLOSED (2026-07-16) — gates (a)/(b)/(c) all empty;
see ADR-P013 "Per-Food Gate Work — Closure Note". 168/190 sourced; the 22
remaining foods are not resolvable under the current pinned sources and are
blocked solely on a future third-source amendment decision.**
**ADR-P013 Amendment A2 — third-source gate — was ACCEPTED (A2a Foundation
Foods only) 2026-07-17 by the project owner** (the "split" path: A2a accepted,
**A2b Branded Foods NOT accepted** — deferred to a separate brand-policy
decision; Open Food Facts / non-USDA and manual corrections / proxies remain
disallowed). **A2a Foundation Foods PIN BATCH COMPLETED 2026-07-17** — the
newest Foundation Foods release `foundation_food_csv_2025-12-18` is pinned in
the manifest as a `tertiarySources` entry (archiveUrl, SHA-256
`3850de85…d52b`, 3,559,820 bytes verified against the server Content-Length,
downloadedAt, public-domain license; 365 foundation food items). **NO matching
was performed** — no manifest entry references the Foundation source, no
catalog data / `FOOD_REVISIONS` / `CATALOG_VERSION` / canonical artifact
changed. **A2a-1 matching batch (whole-commodity grains/legumes/seeds)
attempted 2026-07-17 → ZERO clean matches.** The 10 eligible residues
(basmati_rice, jasmine_rice, farro, sorghum, couscous_whole, lentils_red,
lentils_green, cannellini_beans, chia_seeds, flax_seeds) were checked against
the pinned `foundation_food_csv_2025-12-18`: rice/couscous have no Foundation
record; farro/sorghum/lentils exist only as dry-raw or flour (preparation
mismatch, no varietal specificity); cannellini/chia/flax match the food form
but Foundation carries **per-100g analytical data with NO cup/tbsp portion
rows**, so no source-backed grams-per-serving can be derived (assumed volume→
gram conversion forbidden). All 10 stay gated with an updated
Foundation-checked reason in `fdc-portion-manifest.json` (manifest reasons
only; no catalog data, revisions, version, or canonical change). **Matching
for any remaining eligible residue and the ml/composite residues remains a
SEPARATE blocked slice pending explicit authorization.** Gated count unchanged
at 22 (9 `cup` + 5 `tbsp` + 8 `ml` + 0 `slice`); `food-catalog@1.13.6`
unchanged.
This item stays OPEN until the remaining foods are actually resolved or
explicitly carved out.

**Risk 3 part 2 — Sourcing Closure / Status (2026-07-17).** The **sourced
portion is COMPLETE** to the limit of the accepted USDA sources: **168/190
non-gram foods carry sourced gram weights**; all three accepted sourcing
tracks are exhausted — SR Legacy (Batches 1–7, CLOSED), FNDDS/Amendment A1
(F1–F4 + mixed_greens, EXHAUSTED), and Foundation Foods/Amendment A2a (pin +
A2a-1 whole-commodity matching, ZERO clean matches — Foundation carries
per-100g data with no household cup/tbsp portions and no cooked/varietal rows
for these commodities). The **22-food residue is accepted/deferred and stays
gated** (9 `cup` + 5 `tbsp` + 8 `ml` + 0 `slice`; `food-catalog@1.13.6`),
logging via fractional servings. **No further sourcing is authorized without a
future owner decision** — most plausibly **A2b Branded Foods** (NOT accepted;
needs a brand-representativeness/label policy) or another source-policy
amendment. This item therefore **remains OPEN as accepted residual debt** (per
the project's status vocabulary — residue still gated), now blocked SOLELY on
that future source-policy decision; nothing here accepts A2b or authorizes any
further sourcing/matching/catalog change.

### Nutrition/evaluation data-gap UX correction (2026-07-16) — mobile-only

Independent of the gram-sourcing track above. Users could register and enter
some data but found it unclear WHY nutrition was unavailable; `/nutrition` and
`/nutrition-plan` only bounced them back to the dashboard. Mobile-presentation
fix (no schema/backend/sync/catalog/dependency change):

- New shared `NutritionDataGap` component renders the specific missing
  baseline pieces with DIRECT actions — profile / birth date / height →
  `/profile-edit`, weight → `/evaluation-edit` — with a `/dashboard` fallback
  only when no specific gap is known. Used by both `NutritionTargets` and
  `NutritionPlanScreen`.
- `EvaluationHistory` gains a prominent "Record new evaluation" action
  (`/evaluation-edit`); the dashboard gains a direct "Record evaluation"
  action alongside evaluation history / restrictions.
- Copy clarifies: targets need profile + weight; doctor notes/restrictions are
  optional (safety/personalization); the minimum baseline rule is unchanged
  (profile + birth date + height + weight — NOT a full doctor evaluation).
- Focused tests added for the data-gap direct-action routing (targets + plan),
  the evaluation-history record action, and the dashboard record action;
  existing ready-state behavior unchanged.

**Dietary preferences / food allergies / exclusions remain a SEPARATE future
slice — explicitly out of scope here.** The gap copy mentions allergies only
as a non-blocking planned future capability; nothing in this slice implements
or gates on them. That separate slice is now scoped as **FEATURE-006**,
gated on **ADR-P014** (decision gate drafted 2026-07-16, Status: Proposed —
implementation blocked until the owner accepts an option).

### Slice 4B implementation status (2026-07-13) — backend handler landed

The `meal_items` `EntitySyncHandler` is implemented and registered
(`api/src/modules/nutrition/`), with a minimal backward-compatible sync-pipeline
extension (`SyncApplyError`) so handlers can surface typed codes: retryable
`DEPENDENCY_NOT_READY` (missing parent — not persisted, so a later retry
re-processes; never `removeRejected`) and non-retryable
`CATALOG_REVISION_UNSUPPORTED` (recorded terminally, actionable). CREATE derives
the snapshot server-side; UPDATE mutates `serving_count` only; DELETE
soft-deletes; ownership is scoped to the authenticated user and the parent meal;
conflicts are recorded (never overwritten); `redactForConflict` excludes the
food-name snapshot; audit uses `NUTRITION_CHANGE` with operational metadata
only. **No logging UI, no REST write endpoint, no mobile changes** (later
slices). All api validations green (66 tests).

### Slice 4C implementation status (2026-07-13) — mobile write path only (no UI)

The mobile-only food-logging **write path** is implemented
(`mobile/src/features/nutrition/`), consuming the Slice 4B `meal_items` handler.
**No logging UI, no route/screen change, no backend, schema, or REST change** —
the logging UI + E2E are deferred to Slice 4D.

- **Local-first repository** (`food-log.repository.ts`): `logFood` get-or-creates
  the day's `nutrition_logs` + `meals` **locally only** (neither has a server
  handler — enqueuing them would be `ENTITY_NOT_SUPPORTED`), seeds the referenced
  canonical `foods` row (FK target; `sync_status='synced'`, never enqueued), then
  inserts the `meal_items` row with its immutable per-serving snapshot and
  enqueues exactly one `meal_items` op **in the same transaction**. Edit
  (`serving_count` only) and soft-delete follow the same enqueue-in-transaction
  discipline; `version` is never bumped locally (baseVersion carries the last
  server-acked version).
- **Sync wiring:** CREATE/UPDATE/DELETE meal_items ops are enqueued with
  `sensitive: true` (encrypted at rest in the queue); payloads are the minimal
  server contract (CREATE `{meal_id, food_id, serving_count}`, UPDATE
  `{serving_count}`, DELETE `{}`) — no food name/notes/PHI. `serving_count` is the
  editable quantity model.
- **Identity:** the write path works in catalog keys/slugs; persisted/synced
  identity uses the Slice 4A UUIDv5 food id + revision via a canonical lookup
  service. The local snapshot is display-only and non-authoritative after
  reconciliation (the pull applier upserts server state as `synced`).
- **Worker error handling:** `DEPENDENCY_NOT_READY` → retryable (`markFailed`,
  kept queued, `report.deferred`); `CATALOG_REVISION_UNSUPPORTED` → terminal but
  **surfaced** (`markActionRequired` parks it in CONFLICT so it stops
  auto-retrying yet stays visible, flags the entity row, `report.actionRequired`)
  — never silently discarded.
- **Pull applier:** `registerNutritionSyncAppliers` registers the `meal_items`
  applier at the composition root; `nutrition_logs`/`meals`/`foods` have no server
  handler and are not synced.
- **Tests:** focused unit coverage (repository create/edit/soft-delete + sensitive
  enqueue + no-PHI payload + reload survival, domain daily totals, catalog lookup,
  worker retryable/actionable codes). Mobile validations green (`tsc`, `jest`,
  `lint`, `format:check`).

**No UI in this slice.** `FoodLogScreen`, the add-food form, serving stepper,
`/food-log` route, the food-log store, the meal-plan entry point, and the food
-logging E2E are Slice 4D.

**TECHDEBT-004 risk 3 (per-food non-gram gram sourcing) stays OPEN** — Slice 4C
logs via fractional servings only and fabricates no gram conversions; the item
remains Open.

### Slice 4D implementation status (2026-07-13) — logging UI + E2E (E2E validated 2026-07-14)

The food-logging **UI** on top of the merged Slice 4C write path is implemented
(`mobile/src/features/nutrition/`), **UI + tests + E2E only — no backend, schema,
REST, or write-path change**.

- **Screen/components:** `FoodLogScreen` renders loading / empty / logged /
  add-food / edit-serving / soft-delete states plus a sync banner and per-item
  chips; `FoodLogAddForm` (catalog search → pick → meal + serving) and a
  fractional `ServingStepper` (0.25 step, no fabricated grams). Light/dark via
  theme tokens, accessibility labels/roles, screen kept thin.
- **Navigation:** `/food-log` route (session-guarded like the other nutrition
  routes); reachable from the 15-day meal-plan screen (`open-food-log` entry).
- **Store:** `useFoodLogStore` (Zustand orchestration only) delegates all
  persistence to the Slice 4C repository and all macro math to the domain — no
  SQL/business logic in the UI; local-first (writes return immediately, the day
  re-reads from SQLite, sync is best-effort).
- **Sync/error UX:** pending → "Changes pending" banner + per-item "Pending
  sync" chip; a retryable `DEPENDENCY_NOT_READY` stays pending (never presented
  as data loss); a terminal `CATALOG_REVISION_UNSUPPORTED` surfaces an
  actionable "Action needed" banner/chip; offline/error states are distinct.
  The deterministic `NutritionPlan`/`MealPlan` stays read-only (targets shown
  for context, totals derived from logged entries). No PHI in logs.
- **Tests:** RNTL component tests (`FoodLogScreen.spec.tsx`) + store tests
  (`food-log.store.spec.ts`) cover every state incl. action-required and the
  no-recompute guarantee. A Maestro flow (`.maestro/food-log.yml`, wired into
  `mobile-e2e.yml` after `onboarding-loop.yml`) drives log → totals update →
  sync-attempt-keeps-entry → soft-delete.

**E2E validated (2026-07-14):** the `food-log.yml` Maestro flow passed
end-to-end on the manual `mobile-e2e` workflow — GitHub Actions run
`29331177197` (green). App under test: the EAS `e2e` release APK at commit
`47fa5c7` (build `fb815b8a-8305-44e2-b300-924155548e96`); flow definitions at
commit `49ebe63`. The flow drives log → daily-totals update →
sync-attempt-keeps-the-pending-entry (`DEPENDENCY_NOT_READY` is retryable, never
data loss) → soft-delete → empty state, running after the `registration` →
`dashboard-sync` → `onboarding-loop` journeys in the same job. `mobile-e2e.yml`
stays `workflow_dispatch`-only and needs the EAS-built release APK via the
`EXPO_TOKEN` secret, so it must be dispatched manually. The
`CATALOG_REVISION_UNSUPPORTED` action-required surface is covered by the
component test only (driving it in E2E would need a server-side unsupported
revision — a backend hack — which is out of scope).

**TECHDEBT-004 risk 3 remains OPEN** — Slice 4D adds no gram sourcing; the UI
logs via fractional servings only. (Risk 3 **part 1** was subsequently resolved
in Slice 4E — see below.)

### Slice 4E implementation status (2026-07-14) — risk 3 part 1 (count-unit normalization)

Resolved TECHDEBT-004 risk 3 **part 1**: the 29 count-unit `piece` foods whose
authored `servingAmount` was already the one-piece gram weight (the `piece(182)`
conflation) are normalized **at the authored source** (`food-catalog.data.ts`)
to `{amount: 1, unit: 'piece', grams: <authored weight>}` — no fabricated data.
**Catalog/data only — no schema, migration, REST, sync-semantics, backend, or
UI change.**

- **New immutable revisions.** Each of the 29 is bumped to `food_revision` 2 (a
  new UUIDv5) via a `FOOD_REVISIONS` map; revision-1 rows stay FK-valid.
  `CATALOG_VERSION` → `food-catalog@1.1.0`. Canonical artifacts (mobile `.ts` +
  api `.json`) regenerated from the corrected source; content hash + cross-package
  golden ids updated. Seeding stays insert-new-revisions-only + idempotent
  (fresh DB = 300 rows: 271 rev-1 + 29 rev-2).
- **`normalizeServing`** now emits `gramsPerServing` from an authored non-gram
  `grams` weight (previously only `'g'` servings); the volumetric foods without
  an authored weight still resolve to `null`.
- **Meal generator** portion labels for these foods are corrected as a
  side-effect (e.g. `100 piece` egg → `2 piece`); **macros are unchanged** (the
  generator never used `servingAmount` for macro math) — verified by its
  deterministic/tolerance tests, which assert no golden `serving.amount` literals.
- **Validation.** Mobile nutrition suite (16 suites / 127 tests), API
  catalog/nutrition (25 tests), both typechecks, lint, canonical parity + hash,
  and a deterministic seed preflight/idempotency/immutability check all green;
  `git diff --check` clean.

**Risk 3 part 2 stays OPEN, in progress** — the USDA-FDC `foodPortion`
data-source strategy is **ADR-P013 (Accepted 2026-07-14)**. **Batch 1
(2026-07-14, `food-catalog@1.2.0`)** sourced 4 slice foods; **Batch 2
(2026-07-14, `food-catalog@1.3.0`)** sourced 13 tablespoon foods; the **tsp
semantics mini-slice (2026-07-14, `food-catalog@1.3.1`)** corrected 6 ambiguous
`tsp(N grams)` foods; **Batch 3A (2026-07-14, `food-catalog@1.4.0`)** sourced
26 cup grains/legumes/staples; **Batch 3B (2026-07-14, `food-catalog@1.5.0`)**
sourced 42 cup vegetables; **Batch 3C (2026-07-14, `food-catalog@1.6.0`)**
sourced 14 cup fruits; **Batch 4 (2026-07-14, `food-catalog@1.7.0`)** sourced
8 remaining tbsp foods (Batch 2 erratum); **Batch 5 (2026-07-14,
`food-catalog@1.8.0`)** density-derived 11 ml foods; **Batch 6 (2026-07-14,
`food-catalog@1.9.0`)** sourced the 5 zero-macro foods after the owner
resolved that policy; **Batch 7 (2026-07-14, `food-catalog@1.10.0`)**
density-derived lemon_juice (owner-authorized); the **poppy-seeds
serving-semantics correction slice (2026-07-14, `food-catalog@1.10.1`)**
corrected poppy_seeds' teaspoon-scale authored serving to tsp(1) with the SR
tsp gram weight (owner-authorized); **Amendment A1 Batch F1 (2026-07-15,
`food-catalog@1.11.0`)** matched the cup foods against the pinned FNDDS
2021-2023 archive — one match (polenta = FNDDS "Cornmeal mush", 240 g/cup);
**Batch F2 (2026-07-15, `food-catalog@1.12.0`)** matched the tbsp foods —
two matches (pesto 16 g/tbsp, tzatziki 30 g/2 tbsp, both FNDDS composite
survey foods); **Batch F3 (2026-07-15)** matched ZERO ml foods (3 no-record,
2 composite-policy shakes, 3 carbs-gate failures incl. coconut_milk_beverage
— class 4 confirmed under both pins); **Batch F4 (2026-07-15,
`food-catalog@1.13.0`)** sourced sourdough_bread from FNDDS "Bread, sour
dough" (31 g medium/regular slice) — the A1 matching track is COMPLETE.
**28 foods remain gated** (15 `cup` + 5 `tbsp` + 8 `ml`) with FNDDS-verified
reasons; the class-4/product-variant ledger covers onion, snow_peas, leeks,
pomegranate, dragon_fruit, coconut_milk_beverage, oat_milk_unsweet,
kombucha_unsweet (see the A1 ledgers). Nothing fabricated.

### Related Documents

- .ai/12_DECISIONS.md (ADR-P012 incl. Risk-3 Normalization Note, ADR-0011)
- .ai/15_DATABASE_SCHEMA_DESIGN.md, .ai/16_SQLITE_SCHEMA_DESIGN.md
- api/prisma/schema.prisma (Food, MealItem)

---

# Performance Backlog

## [PERF-001] Mobile Startup Performance Baseline

Status: Proposed
Priority: P2
Type: Performance
Owner: Unassigned
Created: 2026-07-03
Updated: 2026-07-03

### Description

Establish baseline startup performance targets for the mobile application.

### Acceptance Criteria

* [ ] Cold start measured
* [ ] Dashboard render time measured
* [ ] SQLite initialization time measured
* [ ] Performance bottlenecks documented
* [ ] No optimization performed without measurements

### Related Documents

* .ai/06_MOBILE.md
* .ai/09_TESTING.md

---

# Testing Backlog

## [TEST-001] iCoach Rule Test Suite

Status: Proposed
Priority: P1
Type: Testing
Owner: Unassigned
Created: 2026-07-03
Updated: 2026-07-03

### Description

Create a deterministic test suite for iCoach calculations and rules.

### Acceptance Criteria

* [ ] Nutrition calculations tested
* [ ] Workout rules tested
* [ ] Medical restriction overrides tested
* [ ] Boundary cases tested
* [ ] Invalid inputs tested
* [ ] Identical inputs always generate identical outputs

### Related Documents

* .ai/07_ICOACH.md
* .ai/09_TESTING.md

---

## [TEST-002] Phase 10 — Pending Human Validation (iOS + Remaining Manual Checks)

Status: Blocked
Priority: P2
Type: Testing
Owner: Unassigned
Created: 2026-07-06
Updated: 2026-07-06

### Description

Phase 10 was validated end-to-end on an Android emulator (Pixel 7 AVD,
Android 15, Expo Go) on 2026-07-06 and is **functionally closed for
Android**. The items below could not be exercised in that environment and
remain Pending Human Validation.

### Blocked By

macOS hardware (iOS Simulator) and/or a physical device with a human
tester.

### Acceptance Criteria

- [ ] iOS runtime validation: boot, session restore, dashboard states,
      sync round-trip on an iOS Simulator or device
- [ ] Performance profiling against `06_MOBILE.md` targets (cold start
      <2s, 60fps, <300ms transitions) — not measured with profiling tools
- [ ] Full VoiceOver (iOS) / TalkBack (Android) walkthrough — Android
      accessibility labels were verified via UI-tree dump only
- [ ] Conflict banner exercised with a real server-side conflict — logic
      code-reviewed; live trigger requires conflicting edits from a second
      writer (natural once Phase 11 edit forms exist)

### Deferred Coverage Gaps (Phase 11 Step 1, 2026-07-06)

Excluded from mobile Jest coverage collection deliberately — each needs a
capability the current toolchain lacks; close in the Phase 11 component/E2E
waves:

- `authentication/infrastructure/auth-api.ts` — fetch client; unit-testable
  with a fetch mock, deferred to keep Step 1 scoped (sync-transport covers
  the same pattern)
- `use-session.ts` hook body (~50% covered) — needs a React renderer
  (React Native Testing Library wave); the snapshot-caching core IS tested;
  low-water threshold set so coverage cannot silently regress
- `profile|medical/infrastructure/sync-appliers.ts` — registration glue
  exercised at app boot; cover via component/E2E waves
- UI components (`shared/presentation/`, dashboard components, routes) —
  the 70% UI threshold from `09_TESTING.md` awaits the RNTL wave

### Related Documents

- .ai/13_MIGRATION_ROADMAP.md (Phase 10)
- .ai/06_MOBILE.md
- .ai/08_UI_UX.md

---

## [TEST-003] Decide Mobile E2E Strategy for Expo Managed App

Status: Completed
Priority: P1
Type: Testing
Owner: Unassigned
Created: 2026-07-06
Updated: 2026-07-06

### Description

Decide whether Phase 11 Step 4 should implement mobile E2E automation
with Detox, as currently stated in `.ai/09_TESTING.md`, or with
Maestro/EAS Workflows, which better matches the current Expo managed app
state.

### Acceptance Criteria

* [x] ADR-P007 reviewed
* [x] E2E tool decision accepted
* [x] Required dependency/workflow changes deferred to Phase 11 Step 4B
* [x] Deferred E2E coverage gaps documented in ADR-P007

### Related Documents

* .ai/12_DECISIONS.md (ADR-P007)
* .ai/09_TESTING.md
* .ai/10_DEPLOYMENT.md
* .ai/13_MIGRATION_ROADMAP.md (Phase 11)

---

## [TEST-004] Phase 11 Carry-Forwards — Deferred E2E Flows, Cloud Maestro, Phased Coverage

Status: In Progress
Priority: P2
Type: Testing
Owner: Unassigned
Created: 2026-07-07
Updated: 2026-07-09

### Description

Phase 11 closed (2026-07-07) with the seeded-backend Maestro E2E proven
locally and in CI. Phase 13 Slice 3 (2026-07-09) added the device-side
profile-and-goal onboarding loop on the same foundation. The remaining
items are structurally blocked on future-phase work and carry forward.
Extend the existing foundation (`mobile/.maestro/`, `mobile/e2e/seed.mjs`,
`mobile-e2e.yml`) — do not build a parallel harness.

### Blocked By

Remaining UI surfaces (medical evaluation entry, dedicated iCoach plan
surface), EAS paid billing (cloud Maestro), and the component-test
renderHook wave.

### Acceptance Criteria

- [x] Existing-account login E2E flow — DONE (2026-07-09, Slice 3): the
      `onboarding-loop.yml` flow signs out and signs back in as the same
      account, asserting the populated dashboard restores with local data
      intact. Verified in mobile-e2e run 29029948096 (commit 1f072a9,
      EAS e2e build d87bac75).
- [x] Device-side profile + goal onboarding E2E — DONE (2026-07-09,
      Slice 3): `onboarding-loop.yml` completes profile and active goal
      through the dashboard gap actions, verifies the gaps close and the
      iCoach assessment recalculates, and syncs until pending clears.
      Verified green in mobile-e2e run 29029948096.
- [x] Evaluation-entry E2E — DONE (2026-07-09, Phase 14 Slice 1): the
      `/evaluation-edit` screen ships, and `onboarding-loop.yml` now
      records the weight on the device (the `E2E_SEED_SCOPE=evaluation`
      server-seed stopgap was removed). The dashboard reaches `ready` from
      purely local data. Verified green in mobile-e2e run 29042870217.
- [ ] Plan-generation E2E beyond dashboard display — pending dedicated
      iCoach UI surface
- [x] Offline data entry E2E — DONE (2026-07-09, Phase 14.5): offline is
      simulated by dropping the `adb reverse` loopback (airplane mode does
      not sever it). `offline-entry.yml` saves a profile locally with no
      network (banner: "Local changes pending"); `reconnect-sync.yml`
      restores the loopback and the queued change syncs to "Local data
      ready". Wired into mobile-e2e as Journey C; verified green in run
      29090314372.
- [x] Logout E2E — DONE (2026-07-08): sign-out surface added in Phase 12
      Step 4; the dashboard-sync Maestro flow now ends with Sign out →
      auth surface, proven locally and in CI (mobile-e2e run #3,
      commit b62cae7)
- [ ] EAS cloud Maestro workflow (`.eas/workflows/e2e-android.yml`)
      executed for real — pending paid EAS billing plus the Phase 12
      hosted test API (ADR-P008 stage 2)
- [~] Coverage ratchets raised: `authentication/presentation` DONE
      (2026-07-09, Phase 14.5) — a `renderHook` spec for `useSession`
      (subscription + restore-on-unknown effect + re-render) took the file
      to 100%, threshold raised 45/50/25/65 → 95/95/90/85. A `src/app/`
      directory threshold once route coverage exists remains open.

### Related Documents

- .ai/12_DECISIONS.md (ADR-P007, ADR-P008)
- .ai/13_MIGRATION_ROADMAP.md (Phase 11)
- mobile/e2e/README.md

---

# Release Backlog

## [RELEASE-001] Phase 12 Store-Release Preparation Work Items

Status: Approved
Priority: P1
Type: Feature
Owner: Unassigned
Created: 2026-07-07
Updated: 2026-07-07

### Description

Tracks the Phase 12 (Android internal-testing preparation, gated
submission) work items agreed at the 2026-07-07 planning gate. The
actual Google Play internal-track submission is a SEPARATE approval
gate and is not covered by this item.

### Acceptance Criteria

- [ ] ADR-P009 accepted → hosted Development environment live
      (api Dockerfile, managed Postgres, secrets in host store,
      `prisma migrate deploy` release step, backup/rollback verified);
      doubles as the ADR-P008 stage-2 hosted test API
- [x] ADR-P010 accepted → Sentry wired on both tiers with scrubbing
      tests; OTA remains deferred (Step 3, 2026-07-07)
- [x] `eas.json` development/preview/production profiles + submit
      profile (production = AAB; HTTPS API URLs only outside e2e)
      (Step 4, 2026-07-08)
- [x] Dev sign-in surface replaced: hardcoded demo credentials removed
      from source; sign-out surface added (also closes a TEST-004 flow)
      (Step 4, 2026-07-08)
- [x] Compliance artifacts drafted for owner/legal review: privacy
      policy, terms of use, health-data disclaimer, Play data-safety
      matrix derived from actual data flows (Step 5, 2026-07-08 —
      docs/legal/, still Draft / require legal review)
- [x] TECHDEBT-002 resolved (Step 6, 2026-07-08) + account-deletion
      surfaced in-app with typed confirmation and immediate-deletion
      retention decision (Step 6B). Remaining for a Data Safety "yes":
      legal review of deletion wording / retention obligations.
- [ ] Sentry live verification (needs owner-created org + DSNs)
- [ ] Release checklist from `10_DEPLOYMENT.md` passes end-to-end for a
      production build; rollback plan documented and tested; release
      notes template in place

### Dependencies

- ADR-P009, ADR-P010 (Proposed — owner acceptance required)
- Owner-created accounts: Google Play developer, hosting provider,
  Sentry org; Play service-account key as an EAS secret

### Related Documents

- .ai/10_DEPLOYMENT.md
- .ai/12_DECISIONS.md (ADR-P008, ADR-P009, ADR-P010)
- .ai/13_MIGRATION_ROADMAP.md (Phase 12)

---

# Documentation Backlog

## [DOCS-001] Architecture Decision Records

Status: Proposed
Priority: P1
Type: Documentation
Owner: Unassigned
Created: 2026-07-03
Updated: 2026-07-03

### Description

Convert technical decisions into formal Architecture Decision Records inside `.ai/12_DECISIONS.md`.

### Acceptance Criteria

* [ ] ADR format defined
* [ ] Backend decision documented
* [ ] Mobile architecture decision documented
* [ ] Offline-first decision documented
* [ ] iCoach deterministic/AI hybrid strategy documented

### Related Documents

* .ai/12_DECISIONS.md

---

# Research Backlog

## [RESEARCH-001] SQLite Encryption Strategy

Status: Proposed
Priority: P1
Type: Research
Owner: Unassigned
Created: 2026-07-03
Updated: 2026-07-03

### Description

Evaluate the safest and most practical local encryption strategy for Expo SQLite.

### Acceptance Criteria

* [ ] Expo SQLite limitations reviewed
* [ ] SQLCipher feasibility reviewed
* [ ] Field-level encryption reviewed
* [ ] Key management strategy documented
* [ ] Recommendation recorded in ADR

### Related Documents

* .ai/04_DATABASE.md
* .ai/05_SECURITY.md
* .ai/12_DECISIONS.md

---

# Backlog Maintenance Rules

Every backlog item must:

* Have a unique ID
* Have a clear priority
* Have a defined type
* Have acceptance criteria
* Reference related documents when applicable
* Be updated when status changes

Completed items should remain documented for traceability.

---

# AI Instructions

Every AI agent working on AppFitness must use this backlog to understand priorities and avoid inventing unrelated tasks.

Before implementing work, verify whether the task exists here.

If a new issue is discovered, propose a backlog item instead of implementing unrelated changes immediately.

Do not remove completed work.

Do not silently change priorities.

When creating new tasks, follow the task template exactly.
