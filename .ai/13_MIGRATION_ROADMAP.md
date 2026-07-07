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
