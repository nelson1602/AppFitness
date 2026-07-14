# AppFitness Migration Roadmap

Version: 1.0
Status: Active
Last Updated: 2026-07-03

---

# Purpose

This document defines the phase-by-phase execution plan for migrating
AppFitness from the current Web MVP (Vite + React + Express + SQLite) to
the target Mobile Offline-First Architecture defined across `.ai/*`.

This roadmap implements the strategy decided in ADR-0013
(`.ai/12_DECISIONS.md`). It does not restate the rationale — see ADR-0013
for context, options considered, and rollback strategy.

Every phase must be completed and pass its Exit Criteria before the next
phase begins, unless explicitly parallelized by a future ADR update. The
existing MVP (`client/`, `server/`) is never modified by this roadmap —
new work happens in new, isolated directories until an explicit,
separately-approved cutover decision is made.

---

# How to Read Each Phase

Every phase defines:

* **Objective** — what the phase achieves and why it matters.
* **Required Documents** — `.ai/*` files to read before starting.
* **Files/Modules Affected** — where new work happens (never inside
  `client/` or `server/`).
* **Dependencies** — which prior phases (or external decisions) must be
  complete first.
* **Risks** — what can go wrong and why it matters.
* **Validation Commands** — how to prove the phase works.
* **Exit Criteria** — the checklist that must be true before moving on.

---

# Phase 0 — Stabilize and Document Current MVP

### Objective

Freeze the current MVP as a known-good, documented reference baseline
before any new work begins, so later phases have an accurate behavioral
specification to build against instead of guesswork.

### Required Documents

* CLAUDE.md
* .ai/00_PROJECT.md
* .ai/03_CODING_STANDARDS.md
* .ai/09_TESTING.md
* .ai/12_DECISIONS.md (ADR-0013)

### Files/Modules Affected

* No source code changes.
* Documentation only: a behavioral/feature inventory of `client/src/features/*`
  and `server/src/{routes,controllers,services,engines}/*`.
* Tag or branch the current MVP commit (e.g. `legacy-mvp-baseline`).

### Dependencies

* ADR-0013 approved.

### Risks

* Zero existing test coverage means "stabilize" risks becoming an
  open-ended refactor if not scoped tightly — this phase documents and
  smoke-tests, it does not refactor or add new tests to the MVP itself.
* Undocumented behavior (e.g. socket.io usage, engine calculation
  details) may be discovered here and must be captured, not silently
  dropped.

### Validation Commands

* `npm run build` (client and server)
* `npm run type-check` (client and server)
* `npm run lint` (client)
* Manual smoke test of each feature area against a written checklist.

### Exit Criteria

* [x] MVP builds cleanly on a clean checkout. (Verified 2026-07-03:
      client/server `build` + `type-check` pass, client `lint` passes;
      server has no lint script — gap noted for Phase 2.)
* [x] A feature/behavior inventory document exists covering every
      `features/*` module and backend engine.
      (`.ai/14_CURRENT_MVP_BASELINE.md`)
* [ ] A manual smoke-test checklist exists and has been run once with
      results recorded. — **Pending Human Validation** (explicitly
      waived for Phase 0 closure on 2026-07-03 by project owner; the
      baseline document serves as the checklist; a human UI pass
      remains outstanding and should be completed opportunistically —
      it does not block Phase 1.)
* [x] `legacy-mvp-baseline` tag/branch created. (Local tag on `8c37898`,
      2026-07-03.)
* [x] ADR-0013 is Accepted and merged into `.ai/12_DECISIONS.md`.

**Phase 0 status: CLOSED (2026-07-03)** — complete per owner decision,
with the manual smoke test carried as Pending Human Validation.

---

# Phase 1 — Create Mobile App Foundation

### Objective

Stand up an empty, strict-TypeScript Expo/React Native application in a
new top-level `mobile/` directory, with Feature-First folder structure,
navigation, and theming scaffolding — no business logic yet.

### Required Documents

* .ai/01_ARCHITECTURE.md
* .ai/02_TECH_STACK.md
* .ai/06_MOBILE.md
* .ai/08_UI_UX.md
* .ai/12_DECISIONS.md (ADR-0002, ADR-0008, ADR-0009, ADR-0010)

### Files/Modules Affected

* New: `mobile/` (Expo project root).
* `mobile/app/` (Expo Router routes).
* `mobile/src/features/{authentication,dashboard,medical,nutrition,workout,
  progress,icoach,profile,settings,notifications,shared}/` (empty
  presentation/application/domain/infrastructure stubs per feature).
* `mobile/src/shared/theme/` (Material Design 3 tokens per `08_UI_UX.md`).

### Dependencies

* Phase 0 complete.

### Risks

* Folder structure drift from `06_MOBILE.md` if not reviewed against the
  spec before other phases build on top of it.
* Picking an Expo SDK version without an ADR could later require an
  ADR-driven correction mid-migration.

### Validation Commands

* `npx expo-doctor`
* `tsc --noEmit`
* `eslint .`
* `npx expo start` (manual smoke: app boots to placeholder screen)

### Exit Criteria

* [ ] App boots on iOS/Android simulator to a placeholder screen. —
      **Pending Human Validation** (headless `expo export` compiled
      iOS + Android bundles successfully on 2026-07-03, but an actual
      simulator/device boot requires a human running `npm start`).
* [x] TypeScript strict mode passes with zero errors. (Verified
      2026-07-03; `strict: true` in `mobile/tsconfig.json`.)
* [x] Folder structure matches `06_MOBILE.md` Feature-First layout.
      (10 features × presentation/application/domain/infrastructure/
      tests under `mobile/src/features/`.)
* [x] Light/dark theme tokens wired up (no hardcoded colors).
      (`mobile/src/shared/theme/` — MD3 semantic colors, 8pt spacing,
      type scale, radius, elevation, motion; consumed via `useTheme()`
      in the placeholder screen and root layout.)
* [x] No import references into `client/` or `server/`. (Verified
      2026-07-03.)

**Phase 1 status: COMPLETE pending human simulator validation
(2026-07-03).** Baseline: Expo SDK 57, React Native 0.86, React 19.2,
TypeScript 6 strict, Expo Router with typed routes, ESLint 9 flat
config. See `mobile/README.md`.

---

# Phase 2 — Create Backend Foundation with NestJS

### Objective

Scaffold a new NestJS backend in a new top-level directory (e.g. `api/`),
with module boundaries mirroring the target domain areas, without porting
business logic yet.

### Required Documents

* .ai/01_ARCHITECTURE.md
* .ai/02_TECH_STACK.md
* .ai/03_CODING_STANDARDS.md
* .ai/12_DECISIONS.md (ADR-0003)

### Files/Modules Affected

* New: `api/` (NestJS project root).
* `api/src/modules/{auth,users,medical,nutrition,workout,progress,icoach,
  notifications}/` (empty module scaffolds).
* `api/src/main.ts`, Swagger setup, `/health` endpoint.

### Dependencies

* Phase 0 complete. Independent of Phase 1 (can run in parallel).

### Risks

* Running two live backends (Express `server/` and new `api/`) during
  transition can create confusion about which one the mobile app talks
  to — must be explicit in developer docs which is authoritative at each
  point in the migration.

### Validation Commands

* `npm run build` (Nest)
* `npm run test` (scaffold-level tests)
* `curl localhost:PORT/health`

### Exit Criteria

* [x] NestJS app builds and starts. (Verified live 2026-07-03 —
      compiled `dist/main.js` boots, all modules initialize.)
* [x] `/health` endpoint responds. (Returns only status/timestamp/
      uptime — no internals leaked.)
* [x] Swagger/OpenAPI docs generated and reachable. (`/docs` → 200.)
* [x] Module boundaries match `01_ARCHITECTURE.md` layer rules
      (no business logic in controllers). (health/auth/users/sync
      modules, each with presentation/application/domain/infrastructure
      layers; auth/users/sync are placeholders for Phases 6/7/5.)
* [x] No shared code/imports with `server/`. (Verified 2026-07-03.)

**Phase 2 status: COMPLETE (2026-07-03).** Baseline: NestJS 11,
TypeScript strict, class-validator global ValidationPipe,
@nestjs/config, Swagger at `/docs`, Jest unit + Supertest e2e passing,
default port 3001. See `api/README.md`.

---

# Phase 3 — Design PostgreSQL Schema

### Objective

Design and document the target PostgreSQL schema via Prisma, using the
current `server/prisma/schema.prisma` as the entity-coverage reference,
adding sync metadata, versioning, and audit fields required by
`04_DATABASE.md`.

### Required Documents

* .ai/04_DATABASE.md
* .ai/05_SECURITY.md
* .ai/12_DECISIONS.md (ADR-0004)

### Files/Modules Affected

* New: `api/prisma/schema.prisma` (PostgreSQL datasource).
* New: `api/prisma/migrations/`.
* New: schema/ERD documentation (e.g. `.ai/reference/schema.md`, optional).

### Dependencies

* Phase 2 (Prisma wired into NestJS).
* Reference input: `server/prisma/schema.prisma` (read-only).

### Risks

* Omitting sync/versioning/audit columns now is far more expensive to
  retrofit once mobile sync (Phase 5) depends on the schema shape.
* Losing entity/field coverage from the current SQLite schema if the
  design isn't cross-checked line-by-line against it.

### Validation Commands

* `npx prisma validate`
* `npx prisma migrate dev` against a local/staging Postgres instance
* Manual review against `04_DATABASE.md` Database Quality Checklist

### Exit Criteria

* [x] Every entity from `server/prisma/schema.prisma` has a corresponding
      (possibly renamed/restructured) entity in the new schema, or its
      omission is explicitly documented and justified. (30 models;
      deltas documented in `.ai/15_DATABASE_SCHEMA_DESIGN.md` —
      supplements confirmed to need no tables.)
* [x] Every synchronized entity has: primary UUID, owner, created_at,
      updated_at, version, sync_status per `04_DATABASE.md`.
      (Universal column set incl. soft deletes + `sync_seq` cursor;
      `sync_seq` trigger ships as raw SQL in the initial migration.)
* [x] Migration applies cleanly to an empty PostgreSQL database. —
      **CLOSED (2026-07-03, Phase 5 pre-step):** applied to a disposable
      Docker Postgres 16 (`api/docker-compose.yml`, host port 5433).
      Initial migration hand-extended with the deferred raw SQL
      (sync_seq sequence + triggers on 23 tables, CHECK constraints
      mirroring mobile, partial live-row indexes, audit_logs
      immutability trigger). Live-verified: sync_seq assigns on insert
      and increments on update; CHECK rejects invalid data; audit UPDATE
      rejected. `prisma migrate status`: up to date.
* [x] Schema passes the Database Quality Checklist review (normalized,
      indexed, versioned, auditable, synchronizable, secure, backward
      compatible) — with CHECK constraints/partial indexes documented as
      deferred raw SQL in `.ai/15_DATABASE_SCHEMA_DESIGN.md`.

**Phase 3 status: COMPLETE (2026-07-03; live validation closed in the
Phase 5 pre-step).** Prisma 7.8, schema in `api/prisma/schema.prisma`,
committed-ready migration in `api/prisma/migrations/20260703181824_init/`,
design record in `.ai/15_DATABASE_SCHEMA_DESIGN.md`, ADR-P006 drafted
(Proposed).

---

# Phase 4 — Design Local Expo SQLite Schema

### Objective

Design the on-device SQLite schema for offline-first operation, mirroring
the PostgreSQL entities relevant to mobile, with local sync metadata.

### Required Documents

* .ai/04_DATABASE.md
* .ai/06_MOBILE.md
* .ai/12_DECISIONS.md (ADR-0005, ADR-0006, ADR-P001)

### Files/Modules Affected

* New: `mobile/src/shared/infrastructure/database/schema.ts` and
  migration files.

### Dependencies

* Phase 3 (PostgreSQL schema as canonical reference).
* Phase 1 (mobile foundation).
* **Blocking sub-decision:** ADR-P001 (SQLite Encryption Strategy) must be
  resolved — at least for the fields needed by this phase — before
  sensitive fields (medical notes, personal identifiers) are added to
  this schema.

### Risks

* Field-level mismatches between local SQLite and PostgreSQL schemas are
  a major source of sync bugs — must be cross-validated, not assumed.
* Proceeding without resolving ADR-P001 risks storing sensitive data
  unencrypted locally, violating `05_SECURITY.md`.

### Validation Commands

* Local migration script run against a test app instance/emulator.
* Manual review against `04_DATABASE.md` checklist.

### Exit Criteria

* [x] ADR-P001 is Accepted (or an interim encryption approach is
      explicitly documented and approved for this phase). — Interim
      approach approved by owner 2026-07-03: encryption-ready columns
      (`*_enc BLOB` + `enc_key_id`) shipped; ADR-P001 drafted
      (Proposed); **no real sensitive data stored until Accepted**
      (Phase 8 gate).
* [x] Local schema fields map 1:1 (or with a documented, justified
      transformation) to the PostgreSQL schema from Phase 3. (Mapping
      + deltas in `.ai/16_SQLITE_SCHEMA_DESIGN.md`; only systematic
      type conversions and `order` → `order_index`.)
* [x] Sync metadata (version, sync_status, updated_at) present on every
      synchronized table. (Plus soft deletes, `sync_queue`/`sync_state`/
      `sync_conflicts` infra tables, dirty-row partial indexes.)
* [x] Sensitive fields (medical notes, personal identifiers) use the
      approved encryption strategy. (Encryption-ready per the approved
      interim approach; implementation blocked on ADR-P001 acceptance.)

**Phase 4 status: COMPLETE (2026-07-03), with on-device migration
execution pending first runtime caller (Phase 5/6) and human simulator
validation.** expo-sqlite ~57.0.0; DDL in `mobile/src/shared/
infrastructure/database/migrations/001-initial.ts`; design record in
`.ai/16_SQLITE_SCHEMA_DESIGN.md`.

---

# Phase 5 — Implement Sync Queue

### Objective

Implement the offline-first synchronization pipeline end-to-end: local
write → SQLite → sync queue → background worker → NestJS API → Postgres,
per ADR-0006.

### Required Documents

* .ai/01_ARCHITECTURE.md
* .ai/04_DATABASE.md
* .ai/06_MOBILE.md
* .ai/09_TESTING.md (Synchronization Testing)
* .ai/12_DECISIONS.md (ADR-0006)

### Files/Modules Affected

* `mobile/src/shared/infrastructure/sync/` (queue, background worker).
* `api/src/modules/sync/` (sync endpoint(s), conflict handling).

### Dependencies

* Phase 2, 3, 4 complete.

### Risks

* Conflict resolution for critical medical data is safety-critical per
  the Decision Hierarchy (data integrity ranks above almost everything);
  a naive last-writer-wins implementation on the wrong fields could
  silently corrupt health history — `04_DATABASE.md` explicitly forbids
  this for critical fields.
* Retry/idempotency bugs can cause duplicate or lost writes.

### Validation Commands

* Unit tests for queue enqueue/dequeue/retry logic.
* Integration tests simulating offline → online transitions.
* Conflict-scenario tests (concurrent edits to the same critical field).

### Exit Criteria

* [x] Sync queue is retryable, idempotent, observable, and conflict-aware
      per `04_DATABASE.md`. (Foundation verified 2026-07-03: server push
      is idempotent by client-minted op UUID — tested; client queue has
      FIFO ordering, exponential backoff retry metadata, status counts,
      and conflict states.)
* [ ] Non-critical fields use last-writer-wins; critical medical fields
      require explicit conflict resolution (no automatic overwrite). —
      **Foundation only:** the pipeline records ALL version conflicts for
      manual resolution (safe default — nothing auto-overwrites). Per-
      field LWW policy arrives with each entity's sync handler
      (Phases 6–8); medical handlers must keep manual-only resolution.
* [ ] Automated tests cover: normal sync, network failure + retry,
      conflict detection, duplicate-prevention. — **Partial:** server
      pipeline unit-tested (8 tests: apply, idempotent replay, unknown
      entity, version conflict, CREATE-exists conflict, NOT_FOUND,
      apply-failure, pull cursor echo). Network-failure/retry tests need
      the sync worker + mobile test runner (Phases 6+/11).
* [ ] UI never blocks on network availability during sync. — Deferred:
      no UI consumes sync yet; verified when features connect (Phase 7+).

**Phase 5 status: FOUNDATION COMPLETE (2026-07-03).** Server: entity-
agnostic pipeline in `api/src/modules/sync/` (push/pull endpoints,
EntitySyncHandler registry — starts empty by design, handlers register
per feature in Phases 6+), PrismaService with pg driver adapter.
Mobile: queue/state/conflict stores in `mobile/src/shared/
infrastructure/sync/`. ⚠ `x-user-id` header is a TEMPORARY dev-only
identity source — **Phase 6 MUST replace it with the JWT guard.**
Remaining criteria ride with Phases 6–8 feature handlers + the sync
worker.

---

# Phase 6 — Port/Rebuild Authentication

### Objective

Reimplement authentication (registration, login, JWT + refresh rotation,
RBAC, Argon2 hashing) in the NestJS backend and mobile app, replacing the
MVP's Express/bcryptjs implementation.

### Required Documents

* .ai/05_SECURITY.md
* .ai/02_TECH_STACK.md
* .ai/12_DECISIONS.md

### Files/Modules Affected

* `api/src/modules/auth/*`.
* `mobile/src/features/authentication/*`.
* SecureStore integration on mobile.
* Reference (read-only): `server/src/controllers/auth.controller.ts`,
  `server/src/middlewares/auth.middleware.ts`.

### Dependencies

* Phase 2 (backend), Phase 3 (User schema), Phase 1 (mobile foundation).

### Risks

* Existing bcrypt password hashes cannot be bulk-converted to Argon2
  without plaintext passwords — requires an explicit rehash-on-next-login
  strategy, planned here, not deferred or dropped silently.
* Token/refresh rotation bugs can lock out users or leave sessions valid
  after logout.

### Validation Commands

* Unit + integration tests for register/login/refresh/logout flows.
* Security checklist from `05_SECURITY.md`/`09_TESTING.md` (rate
  limiting, token expiry, RBAC enforcement).

### Exit Criteria

* [x] Register/login/refresh/logout work end-to-end on mobile against
      the NestJS backend. — Server side live-verified 2026-07-06 (curl:
      register → me → authenticated /sync/pull → 401 without token →
      rotation → reuse rejected 401). Mobile client + session manager
      implemented; **on-device run is Pending Human Validation** (needs
      a simulator + running api).
* [x] New passwords hashed with Argon2 (argon2id; live-verified). Legacy
      bcrypt hashes: PHC-format column + PasswordService tested to
      reject bcrypt hashes today; the actual rehash-on-login dispatch is
      deliberately deferred to the (separately approved) MVP user data
      migration — documented in `password.service.ts`.
* [x] Tokens stored only in SecureStore on-device. (Implemented in
      `session-storage.ts`; no token touches SQLite/AsyncStorage.
      On-device behavior rides the same pending human validation.)
* [x] RBAC enforced on protected endpoints. (Baseline: global
      fail-closed JwtAuthGuard + RolesGuard with @Roles() metadata;
      role travels in the JWT. No role-restricted endpoint exists yet —
      first real use will come with admin features.)
* [x] Auth events (login, logout, failed attempts) generate audit log
      entries per `05_SECURITY.md`. (Live-verified: ACCOUNT_REGISTER and
      AUTH_FAILURE/refresh_token_reuse rows in audit_logs.)

**Phase 6 status: COMPLETE (2026-07-06), pending human on-device
validation of the mobile session flow.** The Phase 5 `x-user-id`
placeholder is DELETED — sync endpoints accept only the JWT-derived
user. New in this phase: `api` auth module (Argon2id, hashed single-use
rotating refresh tokens with family revocation on reuse), global
fail-closed guards, audit module; `mobile` authentication feature
(SecureStore session storage, auth API client, offline-tolerant session
manager).

---

# Phase 7 — Port/Rebuild User Profile

### Objective

Migrate profile management to mobile + NestJS, using the current MVP's
profile feature as the behavioral reference.

### Required Documents

* .ai/01_ARCHITECTURE.md
* .ai/04_DATABASE.md
* .ai/06_MOBILE.md
* .ai/08_UI_UX.md

### Files/Modules Affected

* `mobile/src/features/profile/*`.
* `api/src/modules/users/*` (profile-related endpoints).
* Reference (read-only): `client/src/features/profile/*`,
  `server/src/controllers/profile.controller.ts`.

### Dependencies

* Phase 6 (authentication).

### Risks

* Feature-parity gaps if Phase 0's behavior inventory didn't fully
  capture current profile functionality.

### Validation Commands

* Component tests (React Native Testing Library).
* Integration tests for profile CRUD.
* Manual side-by-side comparison against MVP behavior.

### Exit Criteria

* [x] Profile CRUD works offline-first with sync. — Local-first writes
      land in SQLite and enqueue their sync op in the same transaction;
      the server side was live-verified end-to-end on 2026-07-06
      (push CREATE → APPLIED; opId replay → duplicate:true; pull returns
      the row with its sync_seq cursor; stale UPDATE → CONFLICT with
      conflictId and no overwrite; invalid payload → REJECTED). The
      device↔server round-trip awaits the sync WORKER (queue drainer),
      which is the next unit of work — queue/handler contracts on both
      ends are proven compatible by the live test.
* [x] Functional parity with MVP profile feature confirmed against the
      Phase 0 inventory. — Closed in Phase 7.5 (2026-07-06): profile
      fields + the `goals` entity (goal history model: previous active
      goal is closed, never overwritten) both sync. Blood pressure/
      injuries deliberately live in the medical domain (Phase 8) per the
      Phase 3 schema design — documented, not a gap.
* [ ] Accessibility checklist (`08_UI_UX.md`) passed. — N/A yet: no
      profile UI exists (per owner scope); rides with the first profile
      screens (Phase 10 era).

**Phase 7 status: COMPLETE incl. Phase 7.5 sync loop (2026-07-06);
accessibility criterion transfers to the UI phase.**
Phase 7.5 additions — Backend: `goals` EntitySyncHandler (live-verified:
CREATE applied, stale UPDATE → CONFLICT, filtered pull, missing
goal_type rejected); push CONFLICT results now include serverVersion +
serverSnapshot so devices record complete conflicts locally; profile
pullChanges N+1 removed (syncSeq on the record). Mobile: generic sync
worker (`runSync`: FIFO push batches → outcome processing → per-entity
cursor pulls with a pending-op guard that never clobbers unshipped local
edits), EntityApplier registry, goals local repository, composition-root
registration in app/_layout. On-device round-trip execution remains
Pending Human Validation (simulator).

---

# Phase 8 — Port/Rebuild Medical and Physical Evaluation Module

### Objective

Implement the medical/physical evaluation module — the most sensitive
data in the system — with encryption, versioning, and audit trail,
superseding the MVP's `health`/`measurements`/`reevaluation` features.

### Required Documents

* .ai/04_DATABASE.md
* .ai/05_SECURITY.md
* .ai/07_ICOACH.md
* .ai/12_DECISIONS.md (ADR-0011)

### Files/Modules Affected

* `mobile/src/features/medical/*`.
* `api/src/modules/medical/*`.
* Reference (read-only): `client/src/features/{health,measurements,
  reevaluation}/*`, `server/src/controllers/{health,measurement,
  reevaluation}.controller.ts`.

### Dependencies

* Phase 4 (local schema + resolved encryption strategy).
* Phase 5 (sync with manual conflict resolution for critical fields).
* Phase 6 (auth/authorization).

### Risks

* Highest-sensitivity phase in the roadmap — any encryption, sync, or
  audit mistake here has direct compliance and user-safety consequences.
* Must not proceed if ADR-P001 is still unresolved at this point.

### Validation Commands

* Security test suite (`05_SECURITY.md` checklist).
* Data integrity tests (no silent overwrite of historical medical data).
* Verification that encrypted fields are actually encrypted at rest.

### Exit Criteria

* [x] Medical/physical data encrypted at rest per the resolved strategy.
      — ADR-P001 + ADR-P006 **Accepted** (2026-07-06): field-level
      AES-256-GCM both sides (server: Node crypto + env key with
      enc_key_id versioning; device: @noble/ciphers + SecureStore key).
      Live-proven: bytea search for plaintext in PostgreSQL found only
      ciphertext (63 bytes for a 35-char note = IV+CT+tag); pull/REST
      decrypt correctly. Defense-in-depth extras: sensitive sync-queue
      payloads stored encrypted on-device; conflict snapshots REDACTED
      server-side and encrypted client-side.
* [x] Historical evaluation records are immutable and versioned. —
      Append-only enforced: no update path exists in repository, REST,
      or sync (UPDATE ops are rejected — live-verified); corrections =
      new evaluation + audited soft delete.
* [x] Every evaluation change produces an audit log entry.
      (MEDICAL_EVALUATION_CREATE / _DELETE — new enum value + migration;
      MEDICAL_RESTRICTION_CHANGE; via both REST and sync paths.)
* [x] Data is available for the iCoach engine to consume (contract
      defined). — Domain records expose plaintext-in-memory evaluations
      and STRUCTURED restrictions (type/body_area/severity/effective
      dates — the model `07_ICOACH.md` needs for deterministic
      restriction enforcement); consumption lands in Phase 9.

**Phase 8 status: COMPLETE (2026-07-06), on-device execution pending
the accumulated human simulator validation.** Backend: medical module
(FieldCipherService, append-only evaluations + mutable restrictions,
sync handlers with conflict-snapshot redaction via the new optional
`redactForConflict` pipeline hook, REST endpoints). Mobile: medical
feature (device field cipher, encrypted local rows, sensitive
queue-payload encryption, appliers that re-encrypt pulled plaintext
before storage). No real medical data stored; validation used synthetic
strings only.

---

# Phase 9 — Implement Deterministic iCoach Engine

### Objective

Build the deterministic rule engine per `07_ICOACH.md`'s module chain:
Medical Evaluation → Body Composition → Metabolic → Goal Analysis →
Nutrition → Workout → Recovery → Decision → Recommendation → Dashboard.

### Required Documents

* .ai/07_ICOACH.md
* .ai/09_TESTING.md
* .ai/12_DECISIONS.md (ADR-0007)

### Files/Modules Affected

* `mobile/src/features/icoach/domain/*` (framework-independent business
  logic, per `01_ARCHITECTURE.md`'s Domain Layer rules).
* Reference (read-only): `server/src/engines/*` — used as the functional
  specification for existing calculation logic, not copied wholesale.

### Dependencies

* Phase 8 (medical/evaluation data available).
* Phase 7 (profile/goal data available).

### Risks

* Any hidden mutable state or non-determinism (e.g. `Date.now()`,
  `Math.random()` inside rule logic) violates the core engine requirement
  and is expensive to detect without dedicated determinism tests.
* Rule versioning omitted at this stage is very costly to retrofit later,
  since `07_ICOACH.md` requires historical recommendations to remain
  immutable once versioning exists.
* Meeting the 95%+ coverage bar from `09_TESTING.md` is a substantial,
  easy-to-underestimate engineering effort.

### Validation Commands

* Unit tests per rule: normal case, edge case, invalid input, boundary
  values (per `09_TESTING.md`).
* Determinism tests: run identical input twice, assert identical output.
* Coverage report (target ≥95% for iCoach domain code).

### Exit Criteria

* [x] Engine runs fully offline. (Pure functions — zero I/O, network,
      clocks, or randomness anywhere in
      `mobile/src/features/icoach/domain/`; determinism proven by a
      26-run byte-identical-output test.)
* [x] Every recommendation is traceable to its rule version, inputs,
      and formula (explainability requirement). (Deterministic rule ids,
      `ENGINE_RULE_VERSION`, consumed inputs, explanation, and
      scientific basis on every recommendation — asserted in tests.)
* [x] Medical restrictions verified (via tests) to override goal
      optimization in conflicting scenarios. (ADVANCED+STRENGTH beaten
      to LOW by severe doctor restriction; BP ≥180/110 blocks training
      entirely with a CRITICAL recommendation; tightest-cap-wins tested.)
* [x] No AI/LLM calls anywhere in the deterministic decision path.
      (No network capability exists in the domain layer at all.)
* [x] ≥95% test coverage on iCoach domain logic. (54 tests, 6 suites:
      100% statements/functions/lines, 97.5% branches — thresholds
      enforced in jest coverageThreshold.)

**Phase 9 status: CORE COMPLETE (2026-07-06).** Deterministic engine
v1 (`icoach-rules@1.0.0`): body composition (BMI/LBM/body-fat bands),
metabolics (Mifflin-St Jeor + Katch-McArdle, activity multipliers),
nutrition (goal adjustments with BMR/clinical safety floors, macro
targets), restriction analysis (BP thresholds, severity caps, body-area
movement exclusions), training plans (level/goal/recovery-adjusted,
medically capped), explainable recommendations. Mobile Jest runner
established (jest-expo). Scope note: this is engine v1 per the Phase 9
owner scope — `07_ICOACH.md`'s full module list (progression/deload/
plateau/recovery-scoring engines, Recommendation persistence into the
`recommendations` table) extends in later iterations under new rule
versions.

---

# Phase 10 — Implement Mobile Dashboard

### Objective

Build the mobile dashboard surfacing iCoach outputs, progress, recovery,
and quick actions, per `08_UI_UX.md`'s dashboard priority order.

### Required Documents

* .ai/08_UI_UX.md
* .ai/06_MOBILE.md
* .ai/07_ICOACH.md

### Files/Modules Affected

* `mobile/src/features/dashboard/*`.
* Reference (read-only): `client/src/features/dashboard/*`.

### Dependencies

* Phase 9 (iCoach outputs to display).
* Phase 5 (sync, for data freshness).
* Phase 7, 8 (underlying data sources).

### Risks

* Performance targets (cold start <2s, 60fps, <300ms transitions) can be
  missed if dashboard aggregation isn't memoized/optimized.
* Risk of scope creep pulling in features beyond dashboard display.

### Validation Commands

* Performance profiling against `06_MOBILE.md` targets.
* Component tests (React Native Testing Library).
* Accessibility audit (WCAG 2.2 AA per `08_UI_UX.md`).

### Exit Criteria

* [x] Dashboard renders entirely from local SQLite (no network
      dependency for viewing). — Implemented in `mobile/src/features/dashboard/`:
      the dashboard service reads profile, active goal, latest evaluation,
      active restrictions, sync queue counts, and local conflicts through
      existing feature/public sync APIs. iCoach runs locally through a pure
      adapter; network is used only when the user taps "Sync now".
* [~] Meets performance targets from `06_MOBILE.md`. — Static validation
      passes (`tsc`, Jest, lint, expo-doctor, export) and the app runs
      responsively on the Android emulator (2026-07-06 validation), but
      cold-start, transition, and frame-rate targets have not been measured
      with profiling tools — tracked as **Pending Human Validation**
      (TEST-002 in `11_BACKLOG.md`).
* [~] Passes accessibility checklist. — Token-based primitives provide
      screen-reader labels/roles, dynamic text, 44px+ touch targets, and
      light/dark token support; labels verified on Android via UI-tree dump
      (2026-07-06). Full VoiceOver/TalkBack walkthrough remains **Pending
      Human Validation** (TEST-002).
* [~] Updates automatically on relevant local events (no manual refresh)
      per the Event-Driven Updates model in `01_ARCHITECTURE.md`. — Zustand
      dashboard store orchestrates refresh and sync status; automatic
      repository event subscriptions/background scheduling are intentionally
      deferred. The dashboard exposes manual "Sync now" and refresh-on-mount
      as Phase 10 scope.

**Phase 10 status: FUNCTIONALLY CLOSED FOR ANDROID (2026-07-06).** Core
implementation (see history below) was validated end-to-end on an Android
emulator (Pixel 7 AVD, Android 15, Expo Go, local NestJS + Docker
Postgres): boot, session restore, route protection, empty/populated/
error/offline dashboard states, `__DEV__` sample data, sync round-trip
(rows verified in Postgres), pending-changes display, light/dark mode,
accessibility labels, and no sensitive data in local SQLite. The
validation surfaced four bugs — boot render loop, missing `local_user`
FK row, sync stuck after token expiry, auth require cycle — all fixed
same-day with regression tests (BUG-001…BUG-004 in `11_BACKLOG.md`).
Final validation: TypeScript clean, Jest 71/71 (iCoach coverage gate
retained), lint clean, expo-doctor 20/20, iOS/Android export successful.
iOS runtime, performance profiling, screen-reader walkthrough, and a live
conflict-banner trigger remain open as TEST-002 (Pending Human
Validation).

History (core implementation, 2026-07-06): first real mobile dashboard
route, minimal auth/register route for simulator access, shared
token-based primitives (Screen/Card/AppText/AppButton/Banner), dashboard
Zustand store, local iCoach adapter with tests, sync status banner,
empty/data-gap state, error/loading states, and `__DEV__`-only synthetic
sample data writer through real repositories.

---

# Phase 11 — Add Tests and CI/CD

### Objective

Finalize automated test coverage to meet `09_TESTING.md` thresholds and
stand up GitHub Actions CI/CD per `10_DEPLOYMENT.md` for both the mobile
app and NestJS backend.

Note: testing is not deferred until this phase in practice — each prior
phase's Exit Criteria already requires its own tests. This phase is about
closing remaining coverage gaps, wiring up CI enforcement, and adding
cross-cutting E2E coverage that spans multiple features.

### Required Documents

* .ai/09_TESTING.md
* .ai/10_DEPLOYMENT.md
* .ai/12_DECISIONS.md (ADR-0012)

### Files/Modules Affected

* `.github/workflows/*` (new).
* Test configs across `mobile/` (Jest, Maestro/EAS Workflows) and `api/`
  (Jest, Supertest).

### Dependencies

* Phases 1–10 substantially complete.

### Risks

* Treating this as "where testing starts" contradicts `09_TESTING.md`'s
  Definition of Done — if earlier phases skipped tests waiting for this
  phase, coverage debt compounds and becomes harder to close here.
* Mobile E2E now follows ADR-P007: Maestro with EAS Workflows while the
  app remains Expo managed. Detox remains a future option if native
  projects or development-build requirements justify the added
  complexity.

### Validation Commands

* CI pipeline run on a PR (type-check, lint, format, unit, integration,
  build).
* Coverage report against thresholds: Domain 90%+, iCoach 95%+, Sync
  90%+, Security-critical 95%+, UI 70%+.
* Maestro/EAS E2E run for critical flows.

### Exit Criteria

* [x] CI blocks merges on failing type-check/lint/tests. — Branch
      protection enabled on `main` (2026-07-07) requiring all four CI
      checks: mobile quality ("Type-check, lint, format, tests"), mobile
      export ("Expo doctor + bundle export"), api quality ("Prisma,
      type-check, lint, format, unit tests, build"), and api e2e
      ("Migrations + e2e against disposable Postgres"). Force pushes and
      branch deletion blocked. Deliberate choices for the current
      solo-owner repo: no required PR review (self-approval is
      impossible, it would deadlock merges) and `enforce_admins` off (the
      owner's direct-push workflow continues; tighten both when a
      PR-based team flow is adopted). Known caveat: the workflows are
      path-filtered, so a non-admin PR touching neither `mobile/**` nor
      `api/**` would wait on "Expected" checks — revisit with always-run
      no-op jobs if non-admin contributors join. The billing-blocked EAS
      Maestro workflow is intentionally NOT a required check.
* [~] Coverage thresholds from `09_TESTING.md` met across all categories.
      — Met and CI-enforced for every category that has code: iCoach 95+,
      sync 95/80, crypto/security 95, repositories 90, dashboard + shared
      UI components 85 (above the 70% UI target). Two intentionally
      phased gaps, enforced at low-water ratchets so they cannot regress:
      `authentication/presentation` (use-session hook body needs the
      renderHook wave) and `src/app` route files (collected, visible in
      reports, no directory threshold yet). Documented deferrals
      (auth-api client, sync-applier glue) listed in `11_BACKLOG.md`.
* [~] Maestro/EAS E2E covers: registration, login, evaluation entry,
      plan generation, offline data entry, sync-on-reconnect, logout.
      — Covered and proven locally + in CI (run 28889967386):
      registration, sync-on-reconnect (seeded server data pulled through
      the real sync path), and dashboard/iCoach-output rendering.
      Deferred pending UI surfaces that do not exist yet (TEST-004):
      explicit existing-account login flow, evaluation entry, plan
      generation beyond dashboard display, offline data entry, logout.
      EAS *cloud* Maestro execution remains billing-blocked (ADR-P007/
      P008) — intentionally NOT marked complete.
* [x] No skipped tests without documented justification. — Verified
      2026-07-07: zero `.skip`/`xit`/`xdescribe`/`it.todo` across
      `mobile/src` and `api/src`; 213 mobile + 30 api unit tests plus
      3 api e2e tests all execute.

**Phase 11 status update (2026-07-06):** PR/mobile/API CI is green on
`main`; mobile RNTL component coverage is in place; Expo web/native
bundle exports pass. ADR-P007 is Accepted: proceed with Maestro/EAS
Workflows for the first mobile E2E automation layer.

**Step 4B status (2026-07-07): E2E FOUNDATION IN PLACE — CLOUD RUN
BLOCKED ON EAS ACCOUNT.** Added `mobile/.maestro/smoke-auth-surface.yml`
(launch → session-restore redirect → sign-in surface → register-mode
round-trip; asserts the `__DEV__`-only sample-data action is absent),
`mobile/eas.json` (`e2e` profile: internal APK, `EXPO_PUBLIC_API_URL`
pinned to 127.0.0.1 so an E2E build can never reach a real backend), and
`mobile/.eas/workflows/e2e-android.yml` (manual-trigger EAS workflow:
Android e2e build → Maestro job). `android.package` set to
`com.appfitness.mobile` — owner should confirm before first store
submission (changeable until then). Executing the workflow requires the
project owner to authenticate once (`npx eas-cli login` +
`npx eas-cli init` in `mobile/` to link an EAS projectId), then
`npx eas-cli workflow:run e2e-android.yml`. Dashboard/registration E2E
flows need a test backend strategy and stay tracked under the Phase 11
exit criteria.

**Test-backend strategy (2026-07-07, ADR-P008 Accepted): FOUNDATION IN
PLACE — IN-APP E2E BLOCKED ON CLEARTEXT BUILD CONFIG.** Implemented the
seeded-local-API strategy: registration + dashboard-sync Maestro flows,
`mobile/e2e/seed.mjs` (public contracts only: profile/evaluation via
REST, goal via `/sync/push` — validated live, all APPLIED, and
`/sync/pull` returns all three seeded entities), local runbook
(`mobile/e2e/README.md`), and a manual-dispatch GitHub Actions workflow
(`mobile-e2e.yml`: Postgres service + api + Android emulator + Maestro;
requires an `EXPO_TOKEN` repo secret). Isolation model: fresh disposable
DB per run; flows submit the prefilled dev identity (typing into
prefilled RN inputs proved cursor-flaky). **Cleartext blocker RESOLVED (2026-07-07):** Android release builds
block cleartext HTTP by default; fixed with a local Expo config plugin
(`mobile/plugins/with-e2e-cleartext.js`, uses `expo/config-plugins`
which ships with expo — no new dependency) loaded by a dynamic
`app.config.js` ONLY when `APP_VARIANT=e2e` (env set in the eas.json
e2e profile). Verified: default-variant config resolves with no plugin
and no cleartext; e2e APK manifest carries
`android:usesCleartextTraffic=true` (aapt-confirmed). Note: a raw
`android.usesCleartextTraffic` config value is silently ignored — it is
not an Expo schema field; the plugin is required. **Seeded-backend E2E
now fully green locally** (EAS build 5890feb2): smoke 12/12,
registration 8/8 (register → empty dashboard against the local API),
dashboard-sync 7/7 (server-side seed → real Sync now pull → populated
dashboard with iCoach output). Remaining: EXPO_TOKEN repo secret for
the CI dispatch; cloud EAS Maestro still billing-blocked.

**Phase 11 status: CLOSED (2026-07-07), with explicit carry-forwards.**
Everything automatable with today's app surface is done and enforced:
PR CI (mobile + api) with branch protection, coverage thresholds across
all existing code categories, 246 automated tests with zero skips, and
the seeded-backend Maestro E2E proven locally and on a clean CI runner.
Carried forward in `11_BACKLOG.md`: TEST-004 (five E2E flows pending
future UI surfaces + EAS cloud Maestro pending billing + the two phased
coverage ratchets) and TEST-002 (Phase 10 pending human validation,
unchanged). These are structurally blocked on future-phase work, not on
outstanding Phase 11 effort.

**mobile-e2e CI proof COMPLETE (2026-07-07):** with the EXPO_TOKEN repo
secret in place, the manual `mobile-e2e` workflow ran green end-to-end
on GitHub Actions (run 28889967386): disposable Postgres service → real
NestJS api → EAS e2e APK download → KVM Android emulator → all three
Maestro flows (smoke, registration, seeded dashboard-sync). One CI-only
defect was found and fixed on the first dispatch: eas-cli evaluates the
dynamic app.config.js, which resolves config plugins from node_modules,
so the workflow now runs `npm ci` in mobile/ first. E2E flows still
deferred (no UI yet): evaluation entry, plan generation, logout. EAS
cloud Maestro remains billing-blocked (ADR-P007/P008 unchanged).

**Step 4B hybrid validation (2026-07-07): E2E SMOKE PASSED.** EAS account
authenticated and project linked (`@nelson1602/appfitness`). The EAS
Workflow itself is **blocked on billing** — Maestro jobs require a paid
Expo plan (workflow file was accepted by EAS; only the run is gated).
Free-hybrid path executed instead: EAS cloud build of the `e2e` profile
(build 86f5e9a1, FINISHED) → release APK installed on the local Android
emulator → Maestro 2.6.1 ran `.maestro/smoke-auth-surface.yml` — **all
12 steps passed**, including the assertion that the `__DEV__`-only
"Load sample data" action is absent from release builds. Cloud workflow
E2E remains open until billing is enabled; the Maestro flow itself is
proven.

---

# Phase 12 — Prepare Store Release

### Objective

Prepare EAS build/submit pipeline, store metadata, compliance artifacts,
and production readiness per `10_DEPLOYMENT.md`.

### Required Documents

* .ai/10_DEPLOYMENT.md
* .ai/05_SECURITY.md

### Files/Modules Affected

* `mobile/eas.json`, app store metadata, privacy policy/ToS documents,
  production environment configuration.

### Dependencies

* Phase 11 (CI/CD green, tests passing).

### Risks

* Store rejection due to missing health-data disclaimers or unjustified
  permissions.
* Production secrets mismanagement if environment configuration isn't
  centralized per `02_TECH_STACK.md`/`10_DEPLOYMENT.md`.

### Validation Commands

* Full Release Checklist from `10_DEPLOYMENT.md`.
* Staging smoke tests.
* EAS production build validation.

### Exit Criteria

* [ ] Production build passes every item in the `10_DEPLOYMENT.md`
      Release Checklist.
* [ ] Rollback plan documented and tested.
* [ ] Monitoring/error tracking (Sentry) wired up and verified.
* [ ] Release notes prepared.
* [ ] **Explicit, separate approval obtained before decommissioning
      `client/`/`server/`** — this is not automatic upon reaching this
      phase (see ADR-0013 Rollback Strategy).

**Phase 12 Step 8A (2026-07-08): multer high-severity advisory
remediated.** Bumped `@nestjs/platform-express` 11.1.27 → 11.1.28 (patch,
same 11.x — not a breaking change; package.json floor now `^11.1.28`),
which pulls the patched `multer@2.2.0` (advisories GHSA-72gw-mp4g-v24j /
GHSA-3p4h-7m6x-2hcm, fixed ≥2.2.0). api now has **zero high/critical
production advisories**; only Prisma dev-tooling moderates remain
(documented, major-downgrade-only). Validation: prisma validate/generate,
typecheck, lint, format, 39 unit, e2e 4/4, build — all green; critical
audit gate passes. Only `api/package.json` + `api/package-lock.json`
changed (no unrelated upgrades, no app code). DEPENDENCY_AUDIT register
+ readiness matrix updated.

**Phase 12 Step 7 (2026-07-08): in-repo release-engineering blockers
closed.** Added a critical-gated `audit` job to both CI workflows +
`docs/DEPENDENCY_AUDIT.md` (deterministic policy; high/moderate tracked
as documented exceptions — api `multer` high not reachable via current
routes, Prisma dev-transitive moderates, mobile `uuid` moderate; no
unapproved upgrades). Added `docs/RELEASE_NOTES_TEMPLATE.md`, an
`eas.json` `submit` profile (Android internal/draft, service-account key
path gitignored), and `docs/MOBILE_ROLLBACK.md`. Readiness matrix items
6/8/release-notes now PASS; item 12 remains blocked only on store-listing
assets. Validation: both workflow YAMLs parse, eas.json valid +
expo-doctor 20/20, critical audit gate passes locally (both packages),
credentials path gitignore-verified. Internal-testing verdict updated:
remaining blockers are now ALL external (Sentry org/DSNs, legal review,
Play console/listing, production env). No app code changed.

**Phase 12 release-checklist walkthrough (2026-07-08):** full audit of
every `10_DEPLOYMENT.md` Release Checklist item + Phase 12 exit criteria
against repo evidence recorded in `docs/RELEASE_READINESS.md` (evidence
commit `deeff55`; mobile-ci + api-ci green). Verdicts: **internal-testing
NOT YET**, **production/store NO**. Engineering blockers still closable
in-repo: dependency audit in CI, release-notes template, `eas.json`
submit profile, mobile store-rollback runbook. External gates
(unchanged): Sentry org/DSNs for live monitoring verification; legal
review of `docs/legal/*`; Play console + store-listing metadata;
Production environment. TECHDEBT-002 (closed Step 6) and TEST-004 logout
(closed Step 4B) confirmed still accurate — the account-deletion UI gate
(Step 6B) needs no further status change.

**Phase 12 Step 6B status (2026-07-08): DELETE-ACCOUNT UI + RETENTION
DECISION.** Retention decision (ADR-P011 resolution): **v1 = immediate,
irreversible hard deletion, no recovery window**; the only retained
artifact is the anonymized audit trail; a grace/`PENDING_DELETION` purge
window is a deferred, legal-gated option. Mobile: new guarded
`/delete-account` route with a **typed-confirmation gate** (must type
`DELETE`; destructive button disabled until it matches), reached from a
"Delete account" button on the dashboard; on success it calls the
existing `deleteAccount()` use case (server delete → wipe session +
local DB) and routes to sign-in; on failure a safe non-sensitive error.
Tests: +5 delete-account route (confirmation gating, success+route,
safe failure, cancel, unauth redirect), +1 dashboard nav; 236 mobile
tests pass, thresholds met, doctor 20/20, export OK. Data Safety draft
deletion is now **in-app surfaced** (server capability from Step 6 +
this UI); the remaining gate on a "yes" deletion answer is the
legal-reviewed retention wording, not engineering. Confirmation is
typed-phrase (not password step-up) — hardening noted in ADR-P011.

**Phase 12 Step 6 status (2026-07-08): ACCOUNT DELETION IMPLEMENTED
(TECHDEBT-002 CLOSED).** ADR-P011 Accepted with the CASCADE revision.
Migration `account_deletion_cascade`: 24 user-owned FKs → `ON DELETE
CASCADE` (4 catalog FKs stay RESTRICT), `ACCOUNT_DELETE` enum value, and
the audit trigger relaxed to permit ONLY `user_id -> NULL`. Backend:
authenticated `DELETE /auth/account` → `AuthService.deleteAccount`
(records ACCOUNT_DELETE, anonymizes the user's audit rows, cascades all
user-owned data; catalog untouched). Mobile: `deleteAccount()` use case
(server-first, then wipe local session + database incl. encrypted cache)
+ `auth-api.deleteAccount` + `wipeDatabase()`. Tests: +2 api unit, +3
mobile unit, and a real-Postgres e2e (`account-deletion.e2e-spec.ts`)
proving cascade + audit anonymization + retained deletion event +
preserved immutability for other mutations. Validation green: api
prisma/build/39 unit/lint/format + e2e 4/4; mobile tsc/230 tests+
thresholds/lint/format/doctor 20/20/android export. Inspection
corrections vs the original ADR: shared `MEDICAL_ENC_KEY` makes per-user
crypto-erasure impossible server-side (physical deletion is the
erasure), and the blocker spanned 24 FKs incl. child-of-child, which is
why CASCADE replaced hand-enumeration. NOT touched: Railway/production
DB. Remaining before a deletion *claim* in the Data Safety form: a
confirmation UI surface + retention-window/legal decisions (RELEASE-001).

**Phase 12 Step 5 status (2026-07-08): COMPLIANCE BASELINE DRAFTED +
TECHDEBT-002 DESIGNED (docs only).** Created `docs/legal/`:
DATA_INVENTORY.md (grounding: data categories, storage locations,
encryption, sharing=none, deletion blocker), plus DRAFT
PRIVACY_POLICY.md, TERMS_OF_USE.md, HEALTH_DISCLAIMER.md, and
PLAY_DATA_SAFETY.md — every artifact labeled Draft / Not legal advice /
requires human+legal review, with `[PLACEHOLDER]`s for business/legal
inputs and no invented data collection. Data Safety matrix marks all
deletion cells "Blocked" and lists submission blockers. TECHDEBT-002
resolution designed as **ADR-P011 (Proposed)**: transactional deletion
service + null-only audit-trigger exception + crypto-erasure; found the
blocker spans RESTRICT FKs (medical/profile/goals/health/workout), not
just the audit trigger. NO code/schema/store changes. Still gating store
readiness: ADR-P011 acceptance → implementation, legal review of the
drafts, Sentry live verification, and the release-checklist walkthrough.

**Phase 12 Step 4B status (2026-07-08): E2E REVALIDATION PASSED — LOGOUT
FLOW PROVEN.** EAS e2e rebuild against the credential-less UI: first
build ERRORED (the Sentry gradle integration fails release builds
without SENTRY_AUTH_TOKEN); fixed with `SENTRY_DISABLE_AUTO_UPLOAD=true`
in every eas.json profile (remove per-profile when a Sentry auth token
is provisioned for source maps), second build FINISHED (4459d1c7,
aapt-verified: e2e cleartext intact, no side effects). Local Maestro on
the new APK: smoke 13/13 (incl. no-prefilled-credentials assert),
registration with typed identity via testIDs (one flow fix: a
hideKeyboard step — the soft keyboard covered the password field),
dashboard-sync + sign-out ending — all green. CI: mobile-e2e run #3
passed on commit b62cae7 (5m51s,
https://github.com/nelson1602/AppFitness/actions/runs/28961553321).
TEST-004 logout flow is now live-proven locally AND in CI — closed.
Non-blocking observation: a GitHub Actions Node 20 deprecation warning
in the workflow toolchain (revisit when bumping action versions).

**Phase 12 Step 4 status (2026-07-08): RELEASE PROFILES + PRODUCT GATE
DONE — E2E FLOWS AWAIT NEXT E2E BUILD.** eas.json now has development
(internal APK, local API), preview (internal APK, hosted HTTPS API),
production (AAB, autoIncrement build numbers, hosted HTTPS API), and the
proven e2e profile untouched; config-proofs: cleartext plugin loads ONLY
for e2e, production/preview URLs are HTTPS, production Android is
app-bundle. Product gate: hardcoded demo credentials REMOVED from the
sign-in surface (fields start empty; dev copy replaced; guarded by
sign-in.spec.tsx product-gate tests and a Maestro assertNotVisible),
inputs got stable testIDs, and a minimal Sign out surface was added to
the dashboard (clears the session; the route guard redirects — covered
by a DashboardScreen test plus a logout step appended to the
dashboard-sync Maestro flow, closing a TEST-004 flow pending live
revalidation). Maestro registration flow now types the disposable
identity via testIDs with REQUIRED -e params (flow env defaults shadow
-e — known trap). NOTE: the updated flows match the NEW UI and cannot
run against the existing e2e APK — the next EAS e2e build must be
followed by a local/CI E2E revalidation pass. Both hosted-URL profiles
point at the Development environment (the only one that exists);
re-point when Staging/Production exist.

**Phase 12 Step 3 status (2026-07-07): PRIVACY-SAFE SENTRY FOUNDATION
IN PLACE.** ADR-P010 Accepted. api: `@sentry/nestjs` initialized only
when `SENTRY_DSN` is set (src/instrument.ts), SentryModule +
SentryGlobalFilter capture unhandled exceptions while preserving normal
HTTP error responses. mobile: `@sentry/react-native` (~7.11.0, the Expo
SDK 57-pinned version) initialized only when `EXPO_PUBLIC_SENTRY_DSN`
is set; native wiring via the `@sentry/react-native/expo` config plugin
with NO source-map-upload credentials (deferred until approved). Both
tiers: `sendDefaultPii` off, tracesSampleRate 0 (errors only), and
tested scrubbers (17 new tests; monitoring dirs threshold-gated ≥95%)
that redact the TECHDEBT-003 key-list plus telemetry PII keys, strip
request payloads/cookies/headers/query strings, reduce breadcrumbs to
method/status/query-less URL, and reduce user context to an opaque
string/number id. Sentry is inert in dev/CI/tests/e2e builds (no DSN
anywhere yet). OTA/expo-updates remains deferred. Remaining to
activate: owner-created Sentry org + DSNs in Railway/EAS secret stores.
Exit criterion "Monitoring/error tracking wired up and verified" — the
wiring and scrubbing are verified by tests; live-event verification
happens when a DSN exists.

**Phase 12 Step 2B status (2026-07-07): HOSTED DEVELOPMENT API LIVE AND
VERIFIED.** Railway project deployed from `api/Dockerfile` with managed
Postgres and fresh secrets; public HTTPS URL recorded in
`api/DEPLOYMENT.md` (Railway's default environment name "production"
appears in the hostname — the tier is Development-only, disposable
data). Smoke suite passed end-to-end with fake disposable data only:
`/health` 200, plain-HTTP 301→HTTPS, register 201, login 200, profile
write 200, `/sync/pull` round-trip returns the written entity. First
deploy failed with DB-route 500s — root cause: the service's
`DATABASE_URL` was not the `${{Postgres.DATABASE_URL}}` reference;
fixed in Railway settings, documented in DEPLOYMENT.md troubleshooting.
This URL is now available as the ADR-P008 stage-2 hosted test API and
the future internal-testing `EXPO_PUBLIC_API_URL`. RELEASE-001
criterion 1: hosted Development environment — met except the one-time
backup-restore verification, which remains on the setup checklist.

**Phase 12 Step 2 status (2026-07-07): BACKEND DEPLOYABILITY FOUNDATION
COMPLETE — DEPLOYMENT AWAITS OWNER RAILWAY ACCOUNT.** ADR-P009 Accepted
(Railway primary, US locality, Development-only). Added
`api/Dockerfile` (multi-stage node:24-slim, production deps only,
non-root, no secrets baked in), `api/.dockerignore`, `db:deploy`
script, and `api/DEPLOYMENT.md` (env vars, Railway setup, pre-deploy
`npx prisma@7 migrate deploy`, `/health` check, expand-first rollback
policy). Validated locally end-to-end: image builds; container serves
`/health` 200 in NODE_ENV=production against disposable Postgres; the
pre-deploy migrate command runs inside the runtime image (3 migrations
found, exit 0). Static suite green (build, 30 tests, lint, format,
prisma validate/generate). Next: owner creates the Railway project per
DEPLOYMENT.md, then first hosted deploy + smoke. ADR-P010 remains
Proposed — no Sentry, no expo-updates.

**Phase 12 Step 1 status (2026-07-07): DECISION BASELINE DRAFTED.**
Approved path: Android internal-testing preparation with a gated
submission checkpoint (no Play submission, no iOS work yet). ADR-P009
(API hosting: Railway-class managed PaaS, Development environment
first, doubling as the ADR-P008 stage-2 hosted test API) and ADR-P010
(Sentry both tiers with PHI-scrubbing-by-policy; expo-updates/OTA
deferred) are drafted as **Proposed** — implementation of hosting,
Dockerfile, eas.json profiles, and monitoring is blocked on their
acceptance. Release-blocking product item: the dev sign-in surface
with hardcoded demo credentials must be replaced before any tester
build (tracked in RELEASE-001 with the compliance artifacts and
TECHDEBT-002, now P1).

---

# Post-Migration Continuation (Phases 13+)

Phases 0–12 delivered the migration *foundation* — architecture, backend,
sync, auth, the deterministic iCoach engine, a read-only dashboard, CI/CD,
and store-release engineering. A 2026-07-09 re-audit established that
several `00_PROJECT.md` §Product Scope capabilities are foundation/
domain-only or unbuilt, and — critically — that **no production UI exists
to enter profile, goal, or evaluation data**, so the app is not yet
meaningfully testable by real users. These phases close that gap.

**Boundaries (do not conflate):**
- **Minimum internal-testing path = Phases 13 + 14.** Only when a real
  user can enter a profile *and* a weight evaluation does the dashboard
  reach its `ready` state (the iCoach adapter requires profile birth-date
  + height AND a weight measurement; goal is optional/defaults to
  maintenance). Phase 13 alone resolves the profile/height/birth-date
  gaps but a "record a weight" gap remains until Phase 14.
- **Commercial v1 = Phases 13–17** (see per-phase rationale). Nutrition,
  workouts, and progress are core to the product promise and belong in
  v1; habits and notifications are engagement features that can ship
  post-v1 without blocking a credible first release.
- **Post-v1 = Phases 18–19** (habits, notifications), then the
  store-submission re-gate (Phase 20). AI-assisted coaching remains a
  scoped-but-deferred non-goal (`00_PROJECT.md`).
- Deferred means **scheduled later, not removed** — the official product
  scope is preserved in full.

## Phase 13 — Profile & Goal Entry UI  [internal-test path]

Status: Slices 1–3 delivered and verified (2026-07-08 → 2026-07-09).
Slice 1 profile entry (commit 8fb861d) and Slice 2 goal entry (commit
8fa4e3a) are merged, mobile-ci green. Slice 3 device-side onboarding E2E
(`onboarding-loop.yml`, flow fixes through commit 1f072a9) runs on the
existing Maestro/EAS harness against a newly built EAS `e2e` APK
(d87bac75) and passed green in the `mobile-e2e` workflow (run
29029948096): register → profile via gap action → weight pull →
assessment recalculates → goal via note action → sync clears pending →
sign out → sign back in with data intact.

### Objective
Surface the existing profile/goal application+repository layers with
create/edit forms and a first-run onboarding path from the empty
dashboard, so real users can supply the identity/goal data the iCoach
engine needs. No backend or schema changes.

### Dependencies
Phases 7 (profile), 9 (iCoach), 10 (dashboard), 5 (sync) — all complete.

### Risks
- Form complexity (~12 profile fields, validation) — mitigated by a form
  library decision (RHF+Zod proposed, owner-gated) or the existing
  raw-`useState` pattern.
- Offline write/sync-status surfacing must reuse the proven sync queue,
  not a parallel path.

### Validation
tsc, unit (domain/application), RNTL form tests, repository/queue
integration tests, Maestro (profile+goal entry, offline save, reconnect
sync, dashboard refresh, existing-account login), expo-doctor, Android
export, + human Android simulator pass. iOS runtime pending macOS.

### Exit Criteria
- [x] A newly-registered user can create/edit a profile and set/replace an
      active goal entirely through production UI (no `__DEV__` seeder).
      (Slices 1–2; `onboarding-loop.yml` exercises both via gap actions.)
- [x] Writes are local-first and enqueue sync ops; sync status/pending is
      visible; reconciles on Sync. (Stores delegate to the proven sync
      queue; onboarding E2E confirms pending → "Local data ready".
      Airplane-mode offline-toggle E2E remains open in TEST-004.)
- [x] Empty-dashboard "Finish your baseline" gaps deep-link into the
      relevant entry screens. (`gap-fix-<id>` → `/profile-edit` `/goal-edit`.)
- [x] Dashboard refreshes to reflect entered data (reaches `ready` once a
      weight exists — seeded server-side in E2E pending the Phase 14 UI).
- [x] Accessibility (labels/roles, keyboard) and light/dark verified.
      (Reused shared form primitives; RNTL asserts labels/roles.)
- [x] No synthetic/dev data paths reachable in release builds.
      (`assertNotVisible: 'Load sample data'` in the E2E flows.)

## Phase 14 — Medical / Physical Evaluation Entry UI  [internal-test path]

Status: Slice 1 (physical evaluation entry) delivered 2026-07-09 — the
`/evaluation-edit` route, `EvaluationForm`, `evaluation.store`, and Zod
schema/adapters ship on the Phase 13 RHF+Zod+Zustand pattern; the shared
`FormField`/`FormSelect` primitives were promoted to `shared/presentation`.
The dashboard `weight` gap deep-links to it and the assessment reaches
`ready` from purely local data. Verified green in mobile-e2e run
29042870217 (commit afa6572, EAS e2e build 070988d4).

Slice 2 (restrictions/injuries + evaluation history) delivered 2026-07-09 —
`/evaluation-history` (list + non-sensitive vitals summary + local sync
status + two-step soft-delete via `removeEvaluation`) and `/restrictions`
(add via `recordRestriction` with encrypted `notes`, active list, end via
`endRestriction`) ship on the same pattern (new `restriction.store`,
`restriction-form.schema`, `RestrictionForm`; `evaluation.store` extended
with history + `remove`). The dashboard links to both surfaces. User-created
active restrictions already flow into the iCoach engine through the existing
adapter (proven by a new adapter test). A focused `medical-management.yml`
Maestro flow exercises both surfaces — verified green in mobile-e2e run
29050409506 (commit a9850d7, EAS e2e build 97264fb5). Offline (airplane-
mode) entry E2E remains pending with a documented harness blocker (see
below / e2e README).

### Objective
Entry UI for medical/physical evaluations (weight, body metrics, vitals)
and restrictions (with encrypted free-text), on the existing medical
module. Completes the minimum data-entry loop so the dashboard reaches
`ready` for real users.

### Dependencies
Phase 13 (shared form patterns), Phase 8 (medical module), ADR-P001/P006
(encryption — already implemented).

### Risks
Health-data sensitivity: encrypted free-text must never leave the
established cipher path; no PHI in logs/telemetry (TECHDEBT-003 /
ADR-P010 already enforce this).

### Validation
As Phase 13 + encryption-at-rest assertions; closes `TEST-004`
evaluation-entry and offline-data-entry E2E flows.

### Exit Criteria
- [x] Users can record + list + soft-delete evaluations and add + deactivate
      restrictions through production UI (Slice 1 record; Slice 2 history +
      restrictions).
- [x] Free-text is encrypted at rest via the existing repository cipher
      path (form → service → repository `encryptText`, sync op marked
      `sensitive`; stores never log values — unit-verified for evaluation
      and restriction notes).
- [x] Dashboard reaches `ready` with a real user-entered dataset (profile
      + device-entered weight, no server seed); user restrictions flow into
      the engine input (adapter test).
- [x] Evaluation-entry Maestro flow passes — onboarding-loop enters weight
      on-device (mobile-e2e run 29042870217); `medical-management.yml`
      covers restrictions + evaluation history (mobile-e2e run 29050409506).
- [x] Offline-data-entry E2E — DONE (Phase 14.5): simulated by dropping the
      `adb reverse` loopback (airplane mode does not sever it).
      `offline-entry.yml` saves a profile locally offline + sync goes
      "Offline"; `reconnect-sync.yml` restores connectivity + syncs to
      "Local data ready" (mobile-e2e Journey C).

## Phase 14.5 — Consolidation  [internal-test path]  ✅

Short carry-forward slice before Phase 15, verified green in mobile-e2e run
29090314372 (commit 15af0db). Closed two TEST-004 items: (1) offline
data-entry E2E via the adb-reverse loopback-drop approach
(`offline-entry.yml` + `reconnect-sync.yml`, mobile-e2e Journey C); (2)
`authentication/presentation` coverage — a `renderHook` spec for `useSession`
took the file to 100%, threshold raised 45/50/25/65 → 95/95/90/85. No
product/schema/contract changes. Remaining TEST-004: plan-generation E2E
(needs a dedicated iCoach surface) and a `src/app/` directory coverage
threshold.

## Phase 15 — Nutrition Module  [commercial v1]

### Objective
Nutrition experience consuming the existing deterministic iCoach nutrition
output, delivered incrementally (planning gate 2026-07-10). AI/LLM never
replaces the deterministic engine.

### Slice structure (approved)
- **Slice 1 — Nutrition Targets UI** *(delivered 2026-07-10)*: `/nutrition`
  route + dashboard entry; read-only projection of the engine's
  `NutritionPlan` (calories, macros + macro kcal, goal-adjustment
  explanation, safety-floor explanation, non-medical disclaimer, data-gap
  state). Reuses the dashboard/iCoach assessment as the single source of
  truth — no recompute. Mobile-only; no schema/backend/deps.
- **Slice 2 — Healthy food catalog**: static, bundled, versioned local
  catalog of 300 foods (id/name/category/serving/macros/tags/source) + pure
  query service. No DB/sync/backend.
- **Slice 3 — Deterministic 15-day meal routine**: pure generator over the
  engine targets + catalog; goal-aware, restriction-aware (within the
  current model), anti-repetition, explainable, identical-inputs→identical
  -outputs. No AI/LLM.
- **Slice 4 — Food logging** *(ADR-gated — APPROVED TO PROCEED; not started)*:
  activates the dormant `nutrition_logs`/`meals`/`meal_items` tables. **ADR-P012**
  (Offline-First Food Logging, Nutrition Catalog Identity, and Conflict
  Semantics) was **Accepted 2026-07-10 by the project owner** and is
  **Status: Accepted** in `12_DECISIONS.md`. The prior "blocked pending owner
  acceptance" gate is **cleared**; Slice 4 is now **approved to proceed
  incrementally** but is **not started and not completed** — it advances only
  through the sub-slices below, under ADR-P012's binding implementation
  constraints.
  - **Next authorized slice — Slice 4A (foundation only; planning/implementation
    authorized, not yet started):** correct the `Food` schema (add
    `catalog_key`/`food_revision`/`catalog_version` +
    `serving_amount`/`serving_unit`/`grams_per_serving`, re-base macros to
    per-serving, partial-unique `(catalog_key, food_revision)`) in both Prisma
    and SQLite; normalize catalog serving semantics (removing the `piece(182)`
    gram/piece conflation); establish **revision-scoped** deterministic catalog
    UUIDs (`uuidv5(catalog_key + food_revision)` under a fixed namespace,
    precomputed at build time) with **immutable, retained** revisions for
    old-client safety; define the canonical seed artifacts (bundle current
    revisions + server insert-new-revisions-only, identical ids); and prepare
    the forward schema/migration plan (`quantity_grams → serving_count`,
    server-derived per-serving snapshot columns, single `NUTRITION_CHANGE` audit
    action, `DEPENDENCY_NOT_READY` + `CATALOG_REVISION_UNSUPPORTED` error codes).
    These migrations are **forward-only, pre-activation, and data-safe but not
    purely additive**. **Slice 4A includes no food-logging write path and no UI.**
    The write path, sync handlers, and logging UI follow in later slices once 4A
    lands.
  - **Slice 4A implementation guards (from ADR-P012 Acceptance Resolution):**
    (a) verify the dormant nutrition/catalog tables hold **no production data**
    before replacing/re-basing columns; (b) implement the conditional
    `(catalog_key, food_revision)` uniqueness via **reviewed forward-migration
    SQL** (partial index `WHERE catalog_key IS NOT NULL`) since **Prisma cannot
    express the predicate**; (c) surface **`CATALOG_REVISION_UNSUPPORTED`** as an
    actionable sync failure and **never silently discard** the local op;
    (d) **preserve old immutable catalog revisions**; (e) **never edit historical
    migrations**; (f) keep the deterministic **`NutritionPlan`/`MealPlan`
    unchanged**.
  - **Slice 4A status (2026-07-13) — foundation IMPLEMENTED and BEHAVIORALLY
    VALIDATED; COMPLETE.** Delivered: forward-only Postgres migrations
    (`20260710120000_add_nutrition_change_audit_action`,
    `20260710120100_nutrition_catalog_serving_model_4a`) + SQLite migration
    `002-nutrition-catalog-4a.ts`, each with a no-production-data preflight
    guard; `Food` schema correction + partial unique `(catalog_key,
    food_revision)` via reviewed raw SQL; `meal_items` `serving_count` + immutable
    per-serving snapshot columns; deterministic revision-scoped catalog UUIDs
    (fixed namespace `uuidv5(catalog_key:food_revision)`); normalized-serving +
    server-derived snapshot helpers; byte-identical canonical seed artifacts
    (mobile `.ts`, api `.json`) + human-run `db:seed`; error/audit definitions
    (`DEPENDENCY_NOT_READY`, `CATALOG_REVISION_UNSUPPORTED`, `NUTRITION_CHANGE`).
    **No write path, sync handler/applier, API route, or UI** (guards (c)/others
    are definitions/intent only until the write slice). Code-level validations
    GREEN both packages (mobile `tsc`/`jest` 480 tests/`lint`/`format:check`; api
    `db:validate`/`db:generate`/`typecheck`/`lint:check`/`jest` 49 tests/`build`).
    **DB behavioral validation DONE (2026-07-13)** against fresh disposable
    databases (isolated throwaway Postgres 16 container + ephemeral
    `node:sqlite`; shared/dev DBs untouched): `migrate deploy` + `db:seed` (300
    rows, idempotent, immutable, partial-unique enforced, null-`catalog_key`
    free); Postgres preflight guard aborts atomically with
    `SLICE_4A_PREFLIGHT_ABORT`; SQLite 001→002 schema/indexes/partial-unique/
    `user_version` + preflight abort verified. **Still deferred (NOT part of
    4A):** the logging write path / sync handler / UI (Slice 4B) and per-food
    gram-per-serving sourcing for the 192 non-gram foods (TECHDEBT-004, risk 3).
    No new runtime dependency (mobile derivation is test-only, pure-JS SHA-1;
    `FoodItem.id`/meal-plan output unchanged — the plan still uses the
    slug/catalog key, NOT the persisted UUID `Food.id`).
  - **Slice 4B status (2026-07-13) — meal_items sync handler foundation
    IMPLEMENTED (backend only; no UI).** Added the `meal_items`
    `EntitySyncHandler` + nutrition module (`api/src/modules/nutrition/`) and a
    minimal backward-compatible sync-pipeline extension (`SyncApplyError`) so
    handlers surface typed codes. CREATE derives the per-serving snapshot
    server-side from the immutable Food revision (client values untrusted);
    UPDATE mutates `serving_count` only; DELETE soft-deletes; ownership scoped
    to the authenticated user + parent meal; version conflicts recorded (never
    overwritten); `redactForConflict` excludes the food-name snapshot;
    `NUTRITION_CHANGE` audit with operational metadata only. Retryable
    `DEPENDENCY_NOT_READY` (missing parent — not persisted, so retries
    re-process) and non-retryable `CATALOG_REVISION_UNSUPPORTED` (terminal,
    actionable). **No logging UI, no REST write endpoint, no mobile changes.**
    API validations GREEN (`db:validate`/`db:generate`/`typecheck`/`lint:check`/
    `jest` 66 tests/`build`). Resolves TECHDEBT-004 risk 2; risk 3 (non-gram
    sourcing) stays open. Remaining for Slice 4: mobile write flow + logging UI.
- Dietary preferences/allergies deferred for v1 (no profile-field/schema
  change).

### Dependencies
Phases 13–14.5; the iCoach nutrition engine (already deterministic).

### Risks
Catalog authorship + provenance (Slice 2); portion-fit tolerance (Slice 3);
keep the engine authoritative; non-medical disclaimer wording (legal track).

### Validation
Mobile unit/RNTL, deterministic generator snapshots (Slice 3), coverage
thresholds extended per slice, Maestro nutrition assertion in onboarding-loop.

### Exit Criteria
- [x] Slice 1: engine nutrition targets shown on a guarded `/nutrition`
      surface with a dashboard entry; tests meet thresholds; onboarding-loop
      E2E asserts the targets render — verified green in mobile-e2e run
      29094958093 (commit d32985c, EAS e2e build b0d2ec3a).
- [x] Slice 2 *(delivered 2026-07-10)*: exactly-300-food bundled catalog
      (`food-catalog.data.ts`, `CATALOG_VERSION='food-catalog@1.0.0'`) +
      pure query service (getById/listAll/filterByCategory/filterByTags/
      search) + integrity tests (count, unique ids/names, closed
      category/tag/avoid vocabularies, provenance, serving data, macro↔
      calorie sanity). Static/bundled; no SQLite/sync/backend/deps; not yet
      consumed by UI (feeds Slice 3).
- [~] Slice 3: deterministic 15-day meal routine.
      - [x] Slice 3A *(delivered 2026-07-10)*: pure generator
        (`generateMealPlan`, `MEAL_RULE_VERSION='meal-rules@1.0.0'`) over the
        engine `NutritionPlan` + goal + 300-food catalog. Deterministic
        (seed hash, no RNG/Date), 3-group linear portion solve
        (calories+protein+carbs → fat follows), snack/dense-food top-up so
        no day falls below the safety-floored target, goal-preference food
        bias, anti-repetition rotation, explainable rationale, best-effort
        `avoidFor` exclusion (current restriction model maps to none —
        documented; explicit `excludeAvoidTags` mechanism tested). No UI,
        no schema/backend/deps/AI.
      - [x] Slice 3B *(delivered 2026-07-10)*: `/nutrition-plan` route +
        `NutritionPlanScreen` (day selector 1–15, each day's 4 meals with
        foods/portions/calories/macros, day totals vs targets, rationale,
        non-medical disclaimer, data-gap/loading/error states) + a
        "15-day meal plan" entry from `/nutrition`. A pure `selectMealPlan`
        thin layer reads the dashboard/iCoach assessment (source of truth)
        and a STABLE seed (userId+goal+weight+catalog+rule versions), no
        recompute. Verified green in mobile-e2e run 29108560964 (commit
        497f8c3, EAS e2e build 2800dd33): onboarding-loop opens the plan
        from /nutrition and asserts Day 1 + a meal render.
- [ ] Slice 4: food logging — **ADR-P012 Accepted 2026-07-10; proceeding
      incrementally**. Slice **4A foundation COMPLETE — implemented and
      behaviorally validated 2026-07-13** (schema correction, revision-scoped
      immutable catalog UUIDs, normalized serving + server-derived snapshot
      helpers, byte-identical canonical seeds, forward migrations with preflight
      guards, error/audit definitions; no write path, no UI). Code-level
      validations green both packages; **DB behavioral validation DONE** on fresh
      disposable Postgres + ephemeral SQLite (`migrate deploy` + `db:seed`
      idempotent/immutable/partial-unique, atomic preflight abort — see Slice 4A
      status above). Slice **4B (2026-07-13): meal_items sync handler foundation
      IMPLEMENTED** (backend only — server-derived snapshots, ownership scoping,
      `DEPENDENCY_NOT_READY`/`CATALOG_REVISION_UNSUPPORTED` semantics, conflict
      redaction, `NUTRITION_CHANGE` audit; api validations green, 66 tests;
      resolves TECHDEBT-004 risk 2). Slice **4C (2026-07-13): mobile food-logging
      WRITE PATH ONLY IMPLEMENTED** (mobile only — **no logging UI/route**, no
      backend/schema/REST change). Local-first `food-log.repository`
      get-or-creates `nutrition_logs`/`meals` **locally only** (no server handler
      for them) and seeds the referenced canonical `foods` FK row, then inserts
      `meal_items` with its immutable per-serving snapshot and enqueues **one**
      `meal_items` op per write in the same transaction; ops are `sensitive: true`
      with minimal no-PHI payloads (`serving_count` is the editable quantity).
      Persisted identity uses the Slice 4A UUIDv5 food id via a canonical lookup;
      local snapshot is display-only. Sync worker now treats `DEPENDENCY_NOT_READY`
      as retryable (kept queued) and surfaces `CATALOG_REVISION_UNSUPPORTED` as an
      actionable, parked (non-retrying, non-discarded) failure; the `meal_items`
      pull applier is registered at the composition root. Mobile validations green
      (`tsc`, `jest`, `lint`, `format:check`). Slice **4D (2026-07-13): logging
      UI + E2E IMPLEMENTED** (mobile UI only — no backend/schema/REST/write-path
      change). `FoodLogScreen` + `FoodLogAddForm` + fractional `ServingStepper`
      render loading/empty/logged/add/edit/soft-delete + sync banner/chips;
      `/food-log` route (session-guarded) is reachable from the 15-day meal-plan
      screen; `useFoodLogStore` is Zustand orchestration only over the Slice 4C
      repository/domain (no SQL/business logic in the UI; local-first). Pending
      and retryable `DEPENDENCY_NOT_READY` show as "pending" (not data loss),
      terminal `CATALOG_REVISION_UNSUPPORTED` shows an actionable "Action needed"
      surface; the deterministic plan stays read-only; no PHI in logs. RNTL
      component + store tests cover every state; a Maestro flow
      (`.maestro/food-log.yml`, wired into `mobile-e2e.yml` after
      `onboarding-loop.yml`) drives log → totals update → sync-attempt-keeps-
      entry → soft-delete. Mobile unit validations green (`tsc`, `jest`, `lint`,
      `format:check`); **E2E verified 2026-07-14** on the manual, `EXPO_TOKEN`-
      gated `mobile-e2e` workflow (GitHub Actions run 29331177197, EAS APK at
      commit 47fa5c7). Slice **4E (2026-07-14): TECHDEBT-004 risk 3 split-risk
      part 1** — the 29 count-unit `piece` foods whose authored `servingAmount`
      was already a one-piece gram weight (the `piece(182)` conflation ADR-P012
      scoped to 4A but left in the data) are normalized at source to `{amount: 1,
      unit: 'piece', grams: <authored weight>}` as new immutable revisions (2),
      `CATALOG_VERSION` → 1.1.0; canonical artifacts/hash/golden ids regenerated;
      no schema/migration/UI/sync change; macros unchanged. **Risk 3 part 2**
      stays OPEN, in progress — strategy is **ADR-P013 (Accepted 2026-07-14)**;
      **Batch 1 (2026-07-14, `food-catalog@1.2.0`)** sourced 4 `slice` foods
      and **Batch 2 (2026-07-14, `food-catalog@1.3.0`)** sourced 13 `tbsp`
      foods; the **tsp semantics mini-slice (2026-07-14, `food-catalog@1.3.1`)**
      corrected 6 ambiguous `tsp(N grams)` foods; **Batch 3A (2026-07-14,
      `food-catalog@1.4.0`)** sourced 26 cup-served grains/legumes/staples;
      **Batch 3B (2026-07-14, `food-catalog@1.5.0`)** sourced 42 cup-served
      vegetables (onion/snow_peas/leeks/mixed_greens/broccolini unmatched);
      **Batch 3C (2026-07-14, `food-catalog@1.6.0`)** sourced 14 cup-served
      fruits (pomegranate/dragon_fruit unmatched); **Batch 4 (2026-07-14,
      `food-catalog@1.7.0`)** sourced 8 remaining tbsp foods after disproving
      Batch 2's unmatched verdicts for them (ADR-P013 Batch 4 erratum);
      **Batch 5 (2026-07-14, `food-catalog@1.8.0`)** density-derived 11 ml
      foods from volume-paired portions (density = gramWeight/sourceVolumeMl,
      never assumed 1 g/ml); **Batch 6 (2026-07-14, `food-catalog@1.9.0`)**
      sourced the 5 zero-macro foods after the owner resolved that policy. All
      use the pinned USDA-FDC SR Legacy archive where a portion row exists
      (checked-in `fdc-portion-manifest.json` + gate spec incl. density
      checks; new immutable revisions 2). **The SR Legacy + zero-macro-policy
      sourcing track is COMPLETE (2026-07-14, `food-catalog@1.10.1` after the
      owner-authorized Batch 7 lemon_juice density mini-batch and the
      poppy-seeds serving-semantics correction slice): 158/190 non-gram foods
      sourced; the 32 remaining foods (16 `cup` + 7 `tbsp` + 8 `ml` +
      sourdough) are intentionally gated** — TECHDEBT-004 risk 3 part 2 stays
      Open (partially resolved), blocked solely on one separate owner
      decision: the FNDDS/second-source ADR amendment (expected to cover
      sourdough). Nothing fabricated; logging uses fractional servings
      meanwhile. See ADR-P013 "SR Legacy Sourcing Track — Closure Note" +
      Batch 7 and poppy-correction notes.

## Phase 16 — Workout Module  [commercial v1]

### Objective
Routines + workout logging (api module + mobile feature), consuming the
iCoach training recommendations.

### Dependencies
Phases 13–14; dormant `routines`/`routine_exercises`/`workout_logs`/
`workout_sets` + `exercises` catalog tables exist.

### Risks
Exercise-catalog sourcing; inter-entity FKs; sync ordering.

### Exit Criteria
- [ ] Users build routines and log workouts; syncs offline-first; the
      engine's training plan is reflected; tests meet thresholds.

## Phase 17 — Progress Monitoring  [commercial v1]

### Objective
Body metrics over time, progress snapshots, and trend views — the
"progress monitoring" and dashboard-analytics scope.

### Dependencies
Phases 13–14 (body/evaluation data); dormant `body_weights`/
`body_measurements`/`progress_snapshots` tables.

### Risks
Charting without adding a heavy UI framework (prefer lightweight/native);
historical-data volume/perf.

### Exit Criteria
- [ ] Users see progress trends from their own data; offline-first; tests
      meet thresholds.

## Phase 18 — Habit Tracking  [post-v1]

### Objective
Habit definition + adherence tracking (scope item; no schema/module yet).

### Exit Criteria
- [ ] Users define and track habits; syncs; tested. (Deferred past first
      commercial release — engagement feature, not core to v1 value.)

## Phase 19 — Notifications  [post-v1]

### Objective
Implement notifications per ADR-P004 (strategy accepted; no code yet).

### Exit Criteria
- [ ] Notification delivery + preferences per ADR-P004; permission
      handling; tested. (Post-v1.)

## Phase 20 — Store-Submission Re-Gate  [commercial v1 close-out]

### Objective
Re-run the `10_DEPLOYMENT.md` Release Checklist against a feature-complete-
enough app; complete the external gates (Sentry verification, legal
sign-off, Play console/listing, Production environment, tested rollback).

### Dependencies
Phases 13–17 + the external gates from `docs/RELEASE_READINESS.md`.

### Exit Criteria
- [ ] `docs/RELEASE_READINESS.md` matrix all PASS or explicitly waived;
      internal → closed → production track progression validated.

---

# AI Instructions

Every AI agent executing any phase of this roadmap must:

* Read the phase's Required Documents before starting work.
* Treat `client/` and `server/` as read-only reference material — never
  modify them as part of migration work.
* Confirm the prior phase's Exit Criteria are met before beginning a new
  phase; if unmet, stop and report rather than proceeding.
* Never mark a phase complete without its Validation Commands having
  been run.
* Escalate to the user (rather than assume) when a required upstream
  decision (e.g. ADR-P001) is still unresolved.
