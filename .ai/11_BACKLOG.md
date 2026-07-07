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

Status: Proposed
Priority: P2
Type: Refactor
Owner: Unassigned
Created: 2026-07-06
Updated: 2026-07-06

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

### Related Documents

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

Status: Blocked
Priority: P2
Type: Testing
Owner: Unassigned
Created: 2026-07-07
Updated: 2026-07-07

### Description

Phase 11 closed (2026-07-07) with the seeded-backend Maestro E2E proven
locally and in CI. These remaining items are structurally blocked on
future-phase work and carry forward. Extend the existing foundation
(`mobile/.maestro/`, `mobile/e2e/seed.mjs`, `mobile-e2e.yml`) — do not
build a parallel harness.

### Blocked By

Future UI surfaces (forms/auth screens), EAS paid billing, and the
component-test renderHook wave.

### Acceptance Criteria

- [ ] Existing-account login E2E flow — needs nothing new technically;
      add alongside the next auth UI touch
- [ ] Evaluation-entry E2E — pending medical evaluation entry UI
- [ ] Plan-generation E2E beyond dashboard display — pending dedicated
      iCoach UI surface
- [ ] Offline data entry E2E — pending local entry forms (then airplane
      -mode toggling via adb, per `09_TESTING.md` offline testing)
- [ ] Logout E2E — pending sign-out UI surface
- [ ] EAS cloud Maestro workflow (`.eas/workflows/e2e-android.yml`)
      executed for real — pending paid EAS billing plus the Phase 12
      hosted test API (ADR-P008 stage 2)
- [ ] Coverage ratchets raised: `authentication/presentation` low-water
      (45/50/25/65) to ≥70 after the renderHook wave; a `src/app/`
      directory threshold once route coverage exists

### Related Documents

- .ai/12_DECISIONS.md (ADR-P007, ADR-P008)
- .ai/13_MIGRATION_ROADMAP.md (Phase 11)
- mobile/e2e/README.md

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
