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
Updated: 2026-07-09

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
FNDDS archive, one match (polenta); 31 foods still gated: 15 `cup` +
7 `tbsp` + 8 `ml` + `sourdough_bread`). See the status sections below.

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
     gram weight (owner-authorized); **Amendment A1 Batch F1 (2026-07-15)**
     sourced polenta from the pinned FNDDS archive (first FNDDS match).
     **31 foods remain gated** (15 `cup` + 7 `tbsp` + 8 `ml` +
     `sourdough_bread`); gram entry stays unavailable for those; the log path
     uses fractional servings meanwhile.

The item stays **Open (partially resolved)** for risk 3 **part 2** only; risks
1, 2, and risk 3 part 1 are resolved. **The SR Legacy + zero-macro-policy
sourcing track is COMPLETE (2026-07-14): 158 of 190 non-gram foods sourced
(incl. the owner-authorized Batch 7 lemon_juice density mini-batch and the
poppy-seeds serving-semantics correction slice, `food-catalog@1.10.1`).**
Under ADR-P013 Amendment A1 (**Accepted 2026-07-14**; FNDDS 2021-2023 pinned
2026-07-14 as `fndds_survey_food_csv_2024-10-31`), **Batch F1 (2026-07-15,
`food-catalog@1.11.0`) matched the 16 gated cup foods — one match (polenta),
bringing the total to 159 of 190 non-gram foods sourced; the 31 remaining
foods are intentionally gated** with FNDDS-verified reasons (see the A1
Batch F1 note + class-4 ledger). Batches F2 (tbsp), F3 (ml), F4 (sourdough)
each still need their own scoped owner authorization; the confirmed class-4
foods need per-food authored-data correction decisions.
This item stays OPEN until the remaining foods are actually resolved or
explicitly carved out.

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
2021-2023 archive — one match (polenta = FNDDS "Cornmeal mush", 240 g/cup).
**31 foods remain gated** (15 `cup` + 7 `tbsp` + 8 `ml` + `sourdough_bread`)
with FNDDS-verified reasons; Batches F2–F4 await scoped authorization, and
five cup foods are now confirmed class-4 authored-data disagreements (onion,
snow_peas, leeks, pomegranate, dragon_fruit — see the A1 class-4 ledger).
Nothing fabricated.

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
