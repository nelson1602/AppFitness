# AppFitness Architecture Decision Records

Version: 1.0
Status: Active
Last Updated: 2026-07-03

---

# Purpose

This document records the official Architecture Decision Records (ADRs) for AppFitness.

Every major technical decision must be documented here to preserve architectural memory, avoid repeated debates, reduce AI hallucinations, and keep the project consistent over time.

This file is the official historical record of why key decisions were made.

---

# ADR Rules

Every architectural decision must include:

* ID
* Title
* Status
* Date
* Context
* Decision
* Options Considered
* Rationale
* Consequences
* Related Documents

---

# ADR Status Values

## Proposed

The decision is under consideration.

## Accepted

The decision is approved and active.

## Deprecated

The decision is no longer recommended but may still exist in the codebase.

## Superseded

The decision was replaced by a newer ADR.

## Rejected

The option was evaluated and intentionally not selected.

---

# ADR Template

```md
## ADR-0000 — Decision Title

Status: Proposed  
Date: YYYY-MM-DD  
Owner: Architecture  

### Context

Explain the problem, background, constraints, and why a decision is needed.

### Decision

State the decision clearly.

### Options Considered

1. Option A
2. Option B
3. Option C

### Rationale

Explain why the selected option is the best fit.

### Consequences

Positive:

- Benefit 1
- Benefit 2

Negative:

- Trade-off 1
- Trade-off 2

### Related Documents

- .ai/00_PROJECT.md
- .ai/01_ARCHITECTURE.md
```

---

# Accepted Architecture Decisions

---

## ADR-0001 — Use Clean Architecture, DDD, and Feature-First Organization

Status: Accepted
Date: 2026-07-03
Owner: Architecture

### Context

AppFitness must evolve into a production-grade mobile health and fitness platform with offline-first behavior, deterministic coaching, secure health data handling, and future AI capabilities.

The project needs an architecture that supports long-term maintainability and controlled growth.

### Decision

AppFitness will use:

* Clean Architecture
* Domain-Driven Design
* Feature-First organization
* Repository Pattern
* Modular Monolith principles

### Options Considered

1. Layer-by-type architecture
2. Feature-first architecture
3. Flat component-based architecture
4. Clean Architecture with DDD

### Rationale

Clean Architecture + DDD + Feature-First provides the best balance between scalability, maintainability, testability, and modularity.

It also allows future extraction of modules into services if required.

### Consequences

Positive:

* Clear module boundaries
* Easier testing
* Better maintainability
* Lower risk of duplicated business logic
* Stronger separation between UI, domain, and infrastructure

Negative:

* Requires more discipline
* Initial structure may feel more complex than a simple app

### Related Documents

* .ai/01_ARCHITECTURE.md
* .ai/03_CODING_STANDARDS.md

---

## ADR-0002 — Use React Native with Expo for Mobile Development

Status: Accepted
Date: 2026-07-03
Owner: Mobile Architecture

### Context

AppFitness must support both iOS and Android with a native-feeling experience while maintaining development speed and long-term scalability.

### Decision

The mobile application will use:

* React Native
* Expo
* TypeScript strict mode

### Options Considered

1. Native iOS + Native Android
2. Flutter
3. React Native CLI
4. React Native with Expo

### Rationale

Expo provides a strong development workflow, faster iteration, OTA updates, EAS Build, native capabilities, and broad ecosystem support.

React Native aligns well with the TypeScript-based backend and shared engineering standards.

### Consequences

Positive:

* Faster cross-platform development
* Strong Expo ecosystem
* Easier builds with EAS
* OTA update support
* Shared TypeScript knowledge

Negative:

* Some native capabilities may require development builds
* Some low-level native customization may require additional configuration

### Related Documents

* .ai/06_MOBILE.md
* .ai/02_TECH_STACK.md

---

## ADR-0003 — Use NestJS as the Backend Framework

Status: Accepted
Date: 2026-07-03
Owner: Backend Architecture

### Context

AppFitness requires a backend capable of authentication, synchronization, health data storage, background jobs, API validation, security controls, and future AI integrations.

### Decision

The backend will use:

* NestJS
* TypeScript
* Modular Monolith architecture

### Options Considered

1. Express
2. Fastify standalone
3. NestJS
4. Microservices from day one

### Rationale

NestJS provides enterprise-grade structure, strong TypeScript support, dependency injection, modular architecture, validation, testing support, and clean integration with PostgreSQL, Prisma, Redis, and background workers.

### Consequences

Positive:

* Strong modularity
* Good testing support
* Better long-term maintainability
* Excellent fit for DDD-style modules
* Easier future extraction into microservices

Negative:

* More structure than Express
* Slightly higher learning curve

### Related Documents

* .ai/01_ARCHITECTURE.md
* .ai/02_TECH_STACK.md

---

## ADR-0004 — Use PostgreSQL with Prisma for Server Persistence

Status: Accepted
Date: 2026-07-03
Owner: Database Architecture

### Context

The backend requires a reliable relational database for health data, users, synchronization records, audit logs, analytics, and long-term persistence.

### Decision

The server database will use:

* PostgreSQL
* Prisma ORM
* Prisma Migrate

### Options Considered

1. MySQL
2. MongoDB
3. PostgreSQL
4. Supabase-only backend
5. Prisma
6. TypeORM

### Rationale

PostgreSQL provides strong relational integrity, transactions, indexing, JSON support, and production reliability.

Prisma provides type-safe database access and a strong migration workflow.

### Consequences

Positive:

* Strong relational consistency
* Type-safe queries
* Good migration tooling
* Excellent fit for structured health data

Negative:

* Requires careful migration management
* Prisma abstractions must not replace proper database design

### Related Documents

* .ai/04_DATABASE.md
* .ai/02_TECH_STACK.md

---

## ADR-0005 — Use Expo SQLite as the Local Operational Database

Status: Accepted
Date: 2026-07-03
Owner: Mobile/Data Architecture

### Context

The app must remain functional offline for up to 48 hours.

Users must be able to log evaluations, meals, workouts, progress, and iCoach-related changes without Internet access.

### Decision

The mobile app will use:

* Expo SQLite as the local operational database
* Repository Pattern for all persistence access
* Local-first writes

### Options Considered

1. AsyncStorage
2. MMKV only
3. Realm
4. WatermelonDB
5. Expo SQLite

### Rationale

SQLite provides relational structure, transactions, local query performance, and better suitability for complex health, nutrition, workout, and synchronization data.

### Consequences

Positive:

* Strong offline support
* Structured relational data
* Better synchronization modeling
* Works well with repository pattern

Negative:

* Requires schema migration planning
* Sensitive data encryption needs additional strategy

### Related Documents

* .ai/04_DATABASE.md
* .ai/06_MOBILE.md
* .ai/05_SECURITY.md

---

## ADR-0006 — Use Offline-First Synchronization with a Local Sync Queue

Status: Accepted
Date: 2026-07-03
Owner: Data Architecture

### Context

AppFitness must operate offline for 1–2 days and synchronize safely when connectivity returns.

Direct network-dependent writes would create poor UX and data loss risks.

### Decision

All user changes will be written locally first and then added to a sync queue.

Synchronization flow:

User Action
→ SQLite
→ Sync Queue
→ Background Sync
→ Backend API
→ PostgreSQL

### Options Considered

1. Online-only writes
2. Immediate API write with local cache
3. Local-first writes with sync queue
4. Full real-time sync

### Rationale

A local sync queue is the safest and most predictable model for offline-first behavior.

It supports retry, conflict detection, idempotency, and delayed synchronization.

### Consequences

Positive:

* App remains usable offline
* Better data resilience
* Safer synchronization
* Better UX during poor connectivity

Negative:

* Requires careful conflict handling
* Requires queue monitoring and retry logic

### Related Documents

* .ai/04_DATABASE.md
* .ai/06_MOBILE.md

---

## ADR-0007 — Use a Deterministic iCoach Engine with Future AI Extension

Status: Accepted
Date: 2026-07-03
Owner: iCoach Architecture

### Context

AppFitness needs intelligent coaching recommendations based on user health, nutrition, workout history, restrictions, and goals.

Because the app handles health-related data, recommendations must be explainable, deterministic, and safe.

### Decision

The iCoach system will be divided into:

1. Deterministic Rule Engine
2. Knowledge Engine
3. Optional AI Provider Layer

The Deterministic Rule Engine is always the primary decision maker.

AI may explain, summarize, educate, or assist, but must not override deterministic rules.

### Options Considered

1. Fully AI-generated coaching
2. Fully static rule system
3. Deterministic engine with optional AI support
4. Cloud-only recommendation system

### Rationale

This hybrid architecture preserves safety and explainability while allowing future AI-powered improvements.

### Consequences

Positive:

* Safe recommendations
* Offline-capable coaching
* Explainable decisions
* Future AI support without rewriting core logic

Negative:

* Requires more rule documentation
* Requires strong testing discipline

### Related Documents

* .ai/07_ICOACH.md
* .ai/09_TESTING.md
* .ai/05_SECURITY.md

---

## ADR-0008 — Use Zustand for Mobile State Management

Status: Accepted
Date: 2026-07-03
Owner: Mobile Architecture

### Context

The mobile app needs lightweight state management for UI state, derived state, local persistent state orchestration, and reactive dashboard updates.

### Decision

Use Zustand as the primary mobile state management library.

SQLite remains the persistence layer.

Zustand must not replace the database.

### Options Considered

1. Redux Toolkit
2. Zustand
3. React Context only
4. MobX
5. Jotai

### Rationale

Zustand is lightweight, simple, performant, TypeScript-friendly, and well suited for React Native.

It avoids Redux boilerplate while still supporting scalable stores.

### Consequences

Positive:

* Low boilerplate
* Fast state updates
* Good DX
* Easy feature-level stores

Negative:

* Requires discipline to avoid global mutable state misuse
* Persistence responsibilities must remain in SQLite/repositories

### Related Documents

* .ai/06_MOBILE.md
* .ai/03_CODING_STANDARDS.md

---

## ADR-0009 — Use Expo Router for Navigation

Status: Accepted
Date: 2026-07-03
Owner: Mobile Architecture

### Context

AppFitness requires typed, scalable, protected, and deep-link-friendly navigation.

### Decision

Use Expo Router for mobile navigation.

### Options Considered

1. React Navigation manually configured
2. Expo Router
3. Custom navigation layer

### Rationale

Expo Router provides file-based routing, deep link support, protected route patterns, and strong Expo integration.

### Consequences

Positive:

* Better Expo alignment
* Easier route organization
* Deep link support
* Cleaner navigation structure

Negative:

* Requires careful folder organization
* Must avoid overly nested routes

### Related Documents

* .ai/06_MOBILE.md
* .ai/08_UI_UX.md

---

## ADR-0010 — Use Material Design 3 as the Base Design Language

Status: Accepted
Date: 2026-07-03
Owner: Product Design

### Context

AppFitness requires a professional, modern, accessible, and consistent mobile design system.

### Decision

Use Material Design 3 as the foundation for the design system.

### Options Considered

1. Fully custom design system
2. Apple Human Interface Guidelines only
3. Material Design 3
4. Mixed unstructured design approach

### Rationale

Material Design 3 provides a mature, accessible, token-driven, cross-platform design foundation.

It fits well with React Native and supports light/dark themes, semantic colors, accessibility, and scalable UI patterns.

### Consequences

Positive:

* Consistent UI
* Faster design implementation
* Strong accessibility foundation
* Better theming support

Negative:

* Requires customization to avoid generic appearance
* Must still feel polished and premium

### Related Documents

* .ai/08_UI_UX.md
* .ai/06_MOBILE.md

---

## ADR-0011 — Treat Health Data as Highly Sensitive

Status: Accepted
Date: 2026-07-03
Owner: Security Architecture

### Context

AppFitness will store physical evaluations, doctor notes, injuries, restrictions, nutrition plans, workout history, and health progress.

This data must be treated with strong privacy and security controls.

### Decision

Health-related data is classified as highly sensitive.

The system must follow:

* Privacy by Design
* Security by Design
* HIPAA principles
* GDPR principles
* OWASP Mobile/API guidance

### Options Considered

1. Treat health data as normal app data
2. Encrypt only authentication tokens
3. Treat all health-related data as highly sensitive

### Rationale

Health-related data requires higher protection due to privacy, safety, and compliance implications.

### Consequences

Positive:

* Stronger user trust
* Better regulatory readiness
* Safer architecture
* Reduced risk of sensitive data exposure

Negative:

* More implementation complexity
* Requires secure storage and careful logging

### Related Documents

* .ai/05_SECURITY.md
* .ai/04_DATABASE.md

---

## ADR-0012 — Use GitHub Flow and GitHub Actions

Status: Accepted
Date: 2026-07-03
Owner: DevOps

### Context

The project requires a simple but reliable workflow for code collaboration, quality gates, and automated validation.

### Decision

Use:

* GitHub Flow
* GitHub Actions
* Conventional Commits
* Pull Request checks

### Options Considered

1. GitFlow
2. Trunk-based development
3. GitHub Flow
4. Manual deployment workflow

### Rationale

GitHub Flow is simple, effective, and appropriate for a growing project.

GitHub Actions integrates well with repository checks, CI/CD, secrets, testing, and deployment automation.

### Consequences

Positive:

* Simple branching model
* Easy automation
* Good CI/CD integration
* Lower operational complexity

Negative:

* Requires strong discipline around PR quality
* Release processes must be clearly documented

### Related Documents

* .ai/10_DEPLOYMENT.md
* .ai/09_TESTING.md
* .ai/03_CODING_STANDARDS.md

---

## ADR-0013 — Migration Strategy from Web MVP to Mobile Offline-First Architecture

Status: Accepted
Date: 2026-07-03
Owner: Architecture

### Context

AppFitness currently exists as a working MVP:

* `client/` — Vite + React 18 web SPA, React Router, Zustand, Tailwind CSS,
  i18next, socket.io-client, vite-plugin-pwa.
* `server/` — Express 4 API with routes/controllers/services/models/engines,
  Prisma ORM against a **SQLite** datasource, JWT auth with bcryptjs hashing.

This MVP was built and shipped (5 commits: MVP, AI engines, a11y/i18n/PWA
phases, dependency fixes) before `.ai/*` existed. It has zero automated test
coverage, no CI/CD, and no offline capability.

The `.ai/*` documentation defines the official target architecture
(ADR-0001 through ADR-0012): React Native + Expo mobile app, NestJS backend,
PostgreSQL as system of record, Expo SQLite as local operational database,
offline-first synchronization via a local sync queue, and a deterministic
iCoach engine.

The target architecture and the current implementation diverge at nearly
every layer: platform (web vs. mobile), framework (Express vs. NestJS),
database (SQLite-only vs. dual PostgreSQL/SQLite with sync), and password
hashing (bcryptjs vs. Argon2). A decision is required on how to move from
one to the other without disrupting the working MVP or losing the
engineering investment already made.

### Decision

AppFitness will migrate from the current web MVP to the target
mobile offline-first architecture **incrementally, in isolated phases,
running the new stack alongside the existing MVP** until each capability
reaches parity and is verified safe to cut over. The MVP is not deleted,
frozen mid-migration, or rewritten in place — it continues operating as
the reference implementation and (optionally) as the live system for
existing users until the mobile app reaches functional parity.

Detailed phase-by-phase execution is defined in `.ai/13_MIGRATION_ROADMAP.md`.

### Current State

* Platform: Web SPA only. No mobile app exists.
* Backend: Express, not NestJS. No dependency injection, module, or guard
  structure.
* Database: Single SQLite database via Prisma, used as if it were a
  traditional server database (not offline-local storage). No PostgreSQL.
  No dual-database model. No sync queue.
* Auth: JWT + bcryptjs. No RBAC verified. No Argon2.
* Testing: None. No unit, integration, component, or E2E tests exist.
* CI/CD: None. No `.github/workflows`, no Docker.
* Undocumented dependency: `socket.io` / `socket.io-client` used for
  realtime features with no corresponding entry in `02_TECH_STACK.md`.

### Target State

As defined in `.ai/01_ARCHITECTURE.md`, `.ai/02_TECH_STACK.md`,
`.ai/04_DATABASE.md`, `.ai/06_MOBILE.md`, `.ai/07_ICOACH.md`, and
ADR-0001 through ADR-0012:

* React Native + Expo mobile app (iOS/Android), TypeScript strict,
  Feature-First + Clean Architecture + DDD, Expo Router, Zustand.
* NestJS backend, modular monolith, PostgreSQL system of record via Prisma.
* Expo SQLite as the offline-first operational database, with a
  retryable/idempotent/conflict-aware sync queue to PostgreSQL.
* Deterministic, versioned, explainable iCoach engine as the core
  intelligence of the product.
* Full test pyramid (unit/integration/component/E2E) and GitHub Actions
  CI/CD per `.ai/09_TESTING.md` and `.ai/10_DEPLOYMENT.md`.

### Options Considered

1. **Full rewrite** — freeze the MVP, build the entire target stack from
   scratch, cut over in one release.
2. **In-place transformation** — incrementally replace pieces of
   `client/`/`server/` in the same codebase until it converges on the
   target stack.
3. **Parallel incremental migration** — build the new mobile/NestJS/
   Postgres stack in new, isolated directories alongside the untouched
   MVP, migrate feature-by-feature, and cut over only when each phase
   passes its exit criteria.
4. **Do nothing** — keep the MVP indefinitely and treat `.ai/*` as
   aspirational only.

### Rationale

**Why a full rewrite is rejected:**

* `CLAUDE.md` and `.ai/01_ARCHITECTURE.md` explicitly discourage large
  rewrites ("Large rewrites are discouraged... new capabilities should
  extend existing modules") and require incremental, verifiable steps.
* A full rewrite defers all validation to a single "big bang" cutover —
  the riskiest possible strategy for an application whose Decision
  Hierarchy (`00_PROJECT.md`) places user safety and data integrity
  above everything else, including developer convenience and speed.
* The MVP already encodes real product knowledge (iCoach engine logic,
  nutrition/workout rules, UX flows) that would be expensive and
  error-prone to reconstruct from memory rather than by reference.
* There is currently no automated test suite, so a rewrite would have no
  regression safety net to confirm behavioral parity — differences would
  only surface after users are affected.

**Why an incremental, parallel migration is safer:**

* Each phase in `.ai/13_MIGRATION_ROADMAP.md` has its own exit criteria,
  so failure is contained to one phase rather than the whole program.
* The existing MVP keeps serving as a living functional specification —
  new mobile/NestJS features are built by reading the MVP's current
  behavior first, satisfying `01_ARCHITECTURE.md`'s "Understand existing
  code before modifying it" principle.
* Running the new stack in new directories (`mobile/`, and a new backend
  directory, e.g. `api/`) avoids destabilizing the MVP that may still be
  serving real users/data during the transition.
* It allows testing, CI/CD, and security posture (Argon2, RBAC, audit
  logging) to be built in from day one of the new stack, instead of
  retrofitted under time pressure.

**What can be reused as-is or as reference:**

* Product/business logic embedded in `server/src/engines/*` (coach,
  gamification, health, notification, progress, recommendation) — reused
  as the *specification* for the deterministic iCoach engine (Phase 9),
  not copied wholesale, since it must become framework-independent and
  versioned per `07_ICOACH.md`.
* `server/prisma/schema.prisma` entity definitions — reused as the input
  reference for the target PostgreSQL schema design (Phase 3); field
  names, relationships, and business fields carry over even though the
  provider, sync metadata, and versioning columns change.
* Zod validation schemas and Zustand store patterns from `client/` —
  directly reusable idioms in the mobile app (both are already the
  documented mobile tech stack; see `02_TECH_STACK.md`).
* UX/flow decisions already made in `client/src/features/*` (screen
  structure, what data is collected, in what order) — reused as UX
  reference for `.ai/08_UI_UX.md`-compliant mobile screens.
* i18next locale files (`client/src/i18n/locales`) — reusable content,
  ported to the mobile i18n setup.

**What must be replaced (not ported as code):**

* The Express server itself — replaced by NestJS (ADR-0003). Controllers/
  routes are re-implemented as Nest controllers/modules, not adapted in
  place.
* The Prisma SQLite datasource on the backend — replaced by PostgreSQL
  (ADR-0004). This requires new migrations, not a schema swap.
* bcryptjs password hashing — replaced by Argon2 (`02_TECH_STACK.md`,
  `05_SECURITY.md`). Existing bcrypt hashes need an explicit rehash-on-
  login migration path (Phase 6), not a bulk conversion, since plaintext
  passwords aren't available.
* The web SPA itself — not ported to mobile; mobile screens are built
  fresh in Expo per `06_MOBILE.md`/`08_UI_UX.md`, using the SPA only as
  behavioral/UX reference.
* Any direct online-only assumption (immediate API calls with no local
  persistence) — replaced by the offline-first local-write-then-sync
  model (ADR-0006).

**What should be isolated (kept, but walled off during migration):**

* The current `client/` and `server/` directories remain untouched and
  fully operational for the duration of the migration, isolated from new
  work by living in separate top-level directories from the new mobile/
  backend code. No shared imports between old and new stacks.
* `socket.io`/`socket.io-client` (undocumented dependency) — isolated
  and not propagated into the new architecture until it goes through the
  ADR process required by `02_TECH_STACK.md`'s Dependency Policy. If
  realtime functionality is required in the target architecture, it must
  be proposed as its own ADR.
* The existing SQLite `dev.db` and its data — isolated as MVP-only state;
  it is not migrated automatically into PostgreSQL. Any real user data
  migration is a separate, explicitly-approved data migration effort,
  not an implicit side effect of this ADR.

### Migration Phases (Summary)

Full detail, objectives, affected files, dependencies, risks, validation
commands, and exit criteria for each phase are defined in
`.ai/13_MIGRATION_ROADMAP.md`:

0. Stabilize and document current MVP
1. Create mobile app foundation
2. Create backend foundation with NestJS
3. Design PostgreSQL schema
4. Design local Expo SQLite schema
5. Implement sync queue
6. Port/rebuild authentication
7. Port/rebuild user profile
8. Port/rebuild medical and physical evaluation module
9. Implement deterministic iCoach engine
10. Implement mobile dashboard
11. Add tests and CI/CD
12. Prepare store release

### Risks

* **Dual maintenance cost:** the MVP and the new stack both need to be
  kept working simultaneously for the duration of the migration,
  increasing short-term engineering load.
* **Scope/behavior drift:** without Phase 0 stabilization and
  documentation, the new stack may unintentionally diverge from actual
  MVP behavior that users depend on.
* **Sensitive-data handling gap:** medical/health data (Phase 8) is the
  highest-risk phase — encryption strategy (ADR-P001, still Proposed)
  must be resolved before, not during, that phase.
* **Password migration:** bcrypt → Argon2 requires a rehash-on-login
  strategy; if mishandled, it could lock out existing users or leave a
  mixed-hash state improperly validated.
* **Undocumented dependency creep:** `socket.io` or other patterns from
  the MVP could silently leak into the new architecture without going
  through the ADR process if migration engineers copy code too literally.
* **Indefinite parallel state:** without clear phase exit criteria and a
  decommissioning trigger for the MVP, the project could end up
  permanently maintaining two systems.

### Rollback Strategy

* Because the new stack lives in isolated directories and the MVP is
  never modified, rollback at any point before full cutover is simply
  **continuing to operate the existing MVP** — there is no shared state
  to unwind.
* Each phase's exit criteria acts as a go/no-go gate; a failed phase
  blocks progression to the next phase but does not affect the MVP or
  previously completed phases.
* Data migration (when real user data eventually moves from SQLite to
  PostgreSQL) must follow `.ai/04_DATABASE.md`'s backup and versioning
  rules and have its own tested rollback/restore procedure before it is
  executed — this ADR does not authorize that data migration itself.
* Final cutover (retiring `client/`/`server/`) only happens after mobile
  app parity is confirmed via the acceptance criteria below, and must be
  its own explicitly approved step, not an automatic consequence of
  reaching Phase 12.

### Acceptance Criteria

This ADR is satisfied, and migration is considered complete, when:

* [ ] All 12 phases in `.ai/13_MIGRATION_ROADMAP.md` have met their exit
      criteria.
* [ ] The mobile app + NestJS/PostgreSQL backend reach functional parity
      with the current MVP's feature set (coach, dashboard, gamification,
      health, measurements, nutrition, profile, progress, reevaluation,
      supplements, workouts).
* [ ] Offline-first behavior is verified for 48 hours per
      `00_PROJECT.md`/`06_MOBILE.md`.
* [ ] iCoach engine outputs are deterministic, versioned, and covered by
      ≥95% test coverage per `09_TESTING.md`.
* [ ] Security checklist in `05_SECURITY.md` passes for the new stack,
      including Argon2 hashing and encrypted sensitive local storage.
* [ ] CI/CD (`.ai/10_DEPLOYMENT.md`) is green and enforced on every PR.
* [ ] A separate, explicit decision (new ADR or documented approval) is
      made before decommissioning `client/`/`server/`.

### Consequences

Positive:

* Preserves a working, revenue/user-serving MVP throughout the migration.
* Each phase is independently testable and reversible, reducing overall
  program risk.
* Forces resolution of currently-undocumented gaps (encryption strategy,
  password migration, socket.io) before they become embedded in the
  target architecture.
* Produces a documented, auditable trail (this ADR + roadmap) that
  future contributors and AI agents can follow without re-litigating the
  strategy.

Negative:

* Two codebases (MVP + new stack) must be maintained in parallel for an
  extended period, at real engineering cost.
* Slower path to full target-architecture delivery than a rewrite would
  nominally promise (though that promise is generally not realized in
  practice for systems of this complexity).
* Requires discipline to prevent the new stack from silently absorbing
  MVP shortcuts (undocumented dependencies, missing tests) during
  "reference" lookups.

### Related Documents

* .ai/00_PROJECT.md
* .ai/01_ARCHITECTURE.md
* .ai/02_TECH_STACK.md
* .ai/04_DATABASE.md
* .ai/05_SECURITY.md
* .ai/06_MOBILE.md
* .ai/07_ICOACH.md
* .ai/09_TESTING.md
* .ai/10_DEPLOYMENT.md
* .ai/13_MIGRATION_ROADMAP.md
* ADR-0001 through ADR-0012

---

# Proposed Future ADRs

The following decisions should be evaluated before implementation.

---

## ADR-P001 — SQLite Encryption Strategy

Status: **Accepted** (2026-07-06, by project owner)
Date: 2026-07-03 (expanded Phase 4; accepted at Phase 8 start)
Owner: Security/Data Architecture

### Accepted Decision (2026-07-06)

Option 1: **field-level AES-256-GCM at the app layer**, implemented with
the audited `@noble/ciphers` library. A per-device 256-bit data key is
generated on first use and stored in Expo SecureStore (hardware-backed);
`enc_key_id` tracks the key used per row. Encrypted fields: medical
free-text (`doctor_notes_enc`, `medical_conditions_enc`,
`medications_enc`, `medical_restrictions.notes_enc`). OS-level file
encryption remains as defense-in-depth underneath.

**Refinement recorded at acceptance:** because keys are per-device (and
per-server, ADR-P006), ciphertext cannot travel between devices. Sync
payloads therefore carry sensitive fields protected by TLS 1.3 in
transit, and EACH side encrypts at rest with its own key. True
end-to-end encryption (a shared user key with escrow/multi-device
enrollment) is a possible future hardening with its own ADR.
Consequence: key loss on a device is recoverable — the server retains
the canonical (server-side-encrypted) copy and re-sync restores data.

### Context

Expo SQLite does not provide database encryption. The Phase 4 local
schema design (`.ai/16_SQLITE_SCHEMA_DESIGN.md`, pending) mirrors the
PostgreSQL medical domain locally — doctor notes, medical conditions,
medications, restriction notes — classified Highly Sensitive
(ADR-0011). `.ai/05_SECURITY.md` requires encrypted sensitive local
storage; tokens already have a decided home (SecureStore) and are out
of scope here.

The local schema reserves `*_enc BLOB` columns plus `enc_key_id`
(mirroring the server-side ADR-P006 design), which are compatible with
every option below — schema and repository work are not blocked by this
decision, but **Phase 8 (medical module) must not store real medical
free-text locally until this ADR is Accepted.**

### Decision

Pending.

### Options Considered

1. **Field-level AES-256-GCM at the app layer (recommended candidate)**
   — encrypt sensitive fields before they reach SQLite; per-device data
   key generated on first run and stored in Expo SecureStore
   (hardware-backed keystore); `enc_key_id` supports rotation. Symmetric
   with the server-side ADR-P006 candidate, so mobile and backend share
   one mental model and ciphertext travels through sync without
   re-encryption design work. Requires a vetted JS crypto implementation
   (e.g. audited `@noble/ciphers`, or `react-native-quick-crypto`) —
   library choice needs approval since neither is in
   `.ai/02_TECH_STACK.md`. Never custom cryptography.
2. **Full-database encryption via SQLCipher** — strongest at-rest story
   (everything encrypted), but Expo SQLite does not support SQLCipher;
   this requires replacing the approved `expo-sqlite` with a different
   driver (e.g. `op-sqlite`), a tech-stack change with its own ADR-level
   consequences (native module, EAS build implications, ecosystem risk).
3. **Rely on OS-level file encryption only** (iOS Data Protection /
   Android File-Based Encryption) — zero implementation cost, but
   protection ends when the device is unlocked, and a rooted/jailbroken
   device or extracted backup exposes plaintext. Does not satisfy
   `.ai/05_SECURITY.md`'s intent for Highly Sensitive fields.
4. **Keep sensitive fields out of SQLite entirely** (SecureStore-only) —
   SecureStore is size-limited (~2KB/entry) and unsuited to
   multi-record medical history; breaks offline iCoach access to
   restrictions. Rejected as primary strategy; viable only for keys.

### Rationale (preliminary — to be confirmed on acceptance)

Option 1 protects the specific Highly Sensitive fields even if the
database file is exfiltrated, works within the approved `expo-sqlite`,
keeps key material in hardware-backed storage, and mirrors ADR-P006 so
the sync payloads for encrypted fields are consistent end-to-end.
Options 3's OS encryption remains as defense-in-depth underneath it.

### Consequences (if Option 1 is accepted)

Positive: sensitive fields unreadable without the SecureStore key;
no driver replacement; rotation supported via `enc_key_id`; symmetric
with the backend strategy.

Negative: encrypted fields cannot be queried/filtered in SQL locally;
adds a crypto dependency requiring approval; key loss (SecureStore
wipe, e.g. uninstall on iOS keychain edge cases) makes local ciphertext
unreadable — acceptable because the server retains the canonical copy
and re-sync restores data.

### Open Questions

* Crypto library selection (`@noble/ciphers` pure-JS audited vs.
  `react-native-quick-crypto` native) — performance vs. build
  complexity; needs its own approval as a new dependency.
* Whether locally generated, not-yet-synced medical notes tolerate the
  key-loss window (mitigation: prioritize medical entities in the sync
  queue).
* Whether `health_logs.notes` (wellness diary) joins the encrypted set —
  same open question as ADR-P006.

### Related Documents

* .ai/04_DATABASE.md
* .ai/05_SECURITY.md
* .ai/06_MOBILE.md
* .ai/15_DATABASE_SCHEMA_DESIGN.md
* ADR-P006

---

## ADR-P002 — AI Provider Strategy

Status: Proposed
Date: 2026-07-03
Owner: iCoach Architecture

### Context

Future AI features may support education, explanation, summarization, and research ingestion.

### Decision

Pending.

### Options to Evaluate

1. Claude
2. OpenAI
3. Gemini
4. Local models
5. Multi-provider abstraction

### Related Documents

* .ai/07_ICOACH.md
* .ai/05_SECURITY.md

---

## ADR-P003 — Backend Hosting Strategy

Status: Proposed
Date: 2026-07-03
Owner: DevOps

### Context

Production hosting must support NestJS, PostgreSQL, Redis, background workers, monitoring, backups, and secure deployments.

### Decision

Pending.

### Options to Evaluate

1. Railway
2. Render
3. Fly.io
4. AWS
5. DigitalOcean
6. Azure
7. Self-managed VPS

### Related Documents

* .ai/10_DEPLOYMENT.md
* .ai/05_SECURITY.md

---

## ADR-P004 — Push Notification Strategy

Status: Proposed
Date: 2026-07-03
Owner: Mobile Architecture

### Context

The app will likely require reminders for workouts, meals, progress tracking, hydration, and iCoach insights.

### Decision

Pending.

### Options to Evaluate

1. Expo Notifications
2. Firebase Cloud Messaging
3. OneSignal
4. Native platform notification services

### Related Documents

* .ai/06_MOBILE.md
* .ai/10_DEPLOYMENT.md

---

## ADR-P005 — Analytics and Product Telemetry Strategy

Status: Proposed
Date: 2026-07-03
Owner: Product/DevOps

### Context

The product needs analytics without compromising user privacy or exposing sensitive health data.

### Decision

Pending.

### Options to Evaluate

1. PostHog
2. Firebase Analytics
3. Custom analytics
4. No analytics initially

### Related Documents

* .ai/05_SECURITY.md
* .ai/10_DEPLOYMENT.md

---

## ADR-P006 — Server-Side Field-Level Encryption for Medical Data

Status: **Accepted** (2026-07-06, by project owner)
Date: 2026-07-03
Owner: Security/Backend Architecture

### Accepted Decision (2026-07-06)

Option 1: **application-layer AES-256-GCM** in the NestJS infrastructure
layer using Node's built-in `crypto` (no new dependency; never custom
cryptography). PostgreSQL stores only ciphertext (`bytea`: 12-byte IV ‖
ciphertext ‖ 16-byte GCM tag) with `enc_key_id` recording the key
version. The key is provided via environment/secret manager
(`MEDICAL_ENC_KEY`, base64 32 bytes; `MEDICAL_ENC_KEY_ID`) — required in
production (boot fails without it), never in the repository. Key
rotation: new key id for new writes; old rows re-encrypted lazily or by
a controlled migration. Sync transport carries sensitive fields under
TLS; at-rest encryption is per-side (see ADR-P001 refinement).
Open question resolved later with the deletion flow: `health_logs.notes`
stays plaintext "Sensitive" tier for now (wellness diary, not doctor
data) — revisit if product treats it as medical.

### Context

The target PostgreSQL schema (Phase 3, `.ai/15_DATABASE_SCHEMA_DESIGN.md`)
stores medical free-text — doctor notes, medical conditions, medications,
restriction notes — classified Highly Sensitive by ADR-0011 and
`.ai/05_SECURITY.md`. `.ai/04_DATABASE.md` requires encryption for
medical notes and personal identifiers at rest, beyond disk-level
encryption. ADR-P001 covers only the mobile SQLite side; the server side
has no decided mechanism.

The Phase 3 schema already reserves `bytea` columns (`*_enc`) plus an
`enc_key_id` key-version column, which are compatible with any of the
options below — schema work is not blocked by this decision, but
**Phase 8 (medical evaluation module) must not write real medical data
until this ADR is Accepted.**

### Decision

Pending.

### Options Considered

1. **Application-layer AES-256-GCM (recommended candidate)** — encrypt/
   decrypt in the NestJS infrastructure layer; PostgreSQL never sees
   plaintext; keys from a secret manager with `enc_key_id`-based
   rotation. Cons: search/index over encrypted fields impossible;
   key-management burden lives in the app.
2. **pgcrypto (in-database encryption)** — simpler app code; but keys
   transit to the DB per query, plaintext exists inside the DB process,
   and DB logs/monitoring become part of the trust boundary.
3. **Rely on full-disk/volume encryption only** — weakest: any DB-level
   access (backups, dumps, operator queries) exposes plaintext medical
   notes. Does not satisfy `.ai/04_DATABASE.md`'s field-level intent.

### Rationale (preliminary — to be confirmed on acceptance)

Option 1 keeps plaintext out of the database entirely (backups, dumps,
and DB operators never see it), aligns with "never implement custom
cryptography" by using Node's built-in AES-256-GCM via vetted libraries,
and the `enc_key_id` column supports rotation without rewriting history.

### Consequences (if Option 1 is accepted)

Positive: strongest at-rest posture for the most sensitive fields; DB
compromise alone does not expose medical notes; key rotation supported.

Negative: encrypted fields cannot be queried/indexed server-side; key
loss = data loss (key backup/escrow procedures required); small
CPU/latency overhead on medical reads/writes.

### Open Questions

* Key storage: environment secret vs. cloud KMS (ties into ADR-P003
  hosting decision).
* Key rotation cadence and re-encryption policy.
* Whether health_log free-text `notes` (wellness diary) should also be
  encrypted or remains "Sensitive" plaintext.

### Related Documents

* .ai/04_DATABASE.md
* .ai/05_SECURITY.md
* .ai/15_DATABASE_SCHEMA_DESIGN.md
* ADR-0011, ADR-P001, ADR-P003

---

## ADR-P007 - Mobile E2E Strategy for Expo Managed App

Status: Accepted (2026-07-06, by project owner)
Date: 2026-07-06
Owner: QA/Mobile Architecture

### Context

Phase 11 requires cross-cutting mobile E2E coverage for registration,
login, evaluation entry, plan generation, offline data entry,
sync-on-reconnect, and logout.

`.ai/09_TESTING.md` currently says to use Detox for mobile E2E testing.
However, the current mobile app is still an Expo managed application:

* No `mobile/android/` native project is committed.
* No `mobile/ios/` native project is committed.
* No `mobile/eas.json` exists yet.
* No Detox configuration exists yet.

Detox remains a strong React Native E2E framework, but its project setup
expects app binaries, native build commands, and binary paths. The Detox
documentation explicitly says Expo projects have a different setup path
and should use Expo documentation. Current Expo documentation describes
E2E testing for managed Expo apps with EAS Workflows and Maestro.

A decision is required before Phase 11 Step 4 installs E2E tooling or
creates workflows, because choosing Detox now may force native prebuild
or EAS binary handling, while choosing Maestro would update the current
testing standard.

### Decision

Use **Maestro with EAS Workflows** for the first mobile E2E automation
layer while the app remains Expo managed.

Keep Detox as a future option if AppFitness later commits native
projects, requires deeper gray-box synchronization, or adopts a
development-build workflow where Detox's additional complexity is
justified.

### Options Considered

1. **Detox now with native prebuild**
   * Run `expo prebuild`, commit native `android/` and/or `ios/`, install
     Detox, and configure native build paths.
2. **Detox now with EAS-built binaries**
   * Keep native projects uncommitted, but create EAS build profiles and
     configure Detox around generated artifacts.
3. **Maestro with EAS Workflows**
   * Add EAS build profiles, Maestro flows, and EAS Workflow files for
     emulator/simulator E2E runs.
4. **Defer mobile E2E**
   * Keep unit/component/integration coverage only until later product
     flows and store-release infrastructure exist.

### Rationale

Maestro with EAS Workflows is the lowest-risk candidate for the current
Expo managed state. It avoids committing native projects solely for test
automation, aligns with Expo's current E2E workflow guidance, and is
sufficient for the first smoke-critical flows: launch, local
registration/login, dashboard loading, dev-only sample data, sync-visible
states, and logout once implemented.

Detox remains technically valuable, especially for gray-box
synchronization and lower-flake React Native tests, but adopting it now
would expand the native build surface before Phase 12 store-release work
has decided the broader EAS/native strategy.

### Consequences

Positive:

* Avoids premature native project churn.
* Keeps Phase 11 incremental and reversible.
* Provides E2E coverage through Expo-aligned infrastructure.
* Leaves Detox available as a future upgrade path.

Negative:

* Requires updating `.ai/09_TESTING.md` language if Maestro is accepted.
* Maestro is black-box and has less app-internal synchronization than
  Detox.
* EAS Workflows require Expo/EAS project configuration and may involve
  external service minutes/cost.
* Some required flows cannot be fully automated until profile/medical
  edit forms and logout UI exist.

### Related Documents

* .ai/09_TESTING.md
* .ai/10_DEPLOYMENT.md
* .ai/13_MIGRATION_ROADMAP.md
* ADR-0002
* ADR-0012

---

## ADR-P008 - E2E Test Backend Strategy: Seeded Local API Now, Hosted Test Environment Later

Status: Accepted (2026-07-07, by project owner)
Date: 2026-07-07
Owner: QA/Mobile Architecture

### Context

ADR-P007 fixed the mobile E2E harness (Maestro + EAS Workflows) and the
first smoke flow passed against a real EAS-built release artifact. The
remaining Phase 11 E2E flows (registration, dashboard, sync) require a
backend, but:

* The mobile app has no profile/medical entry forms yet and its sample
  data seeder is `__DEV__`-only (proven absent from release builds), so
  populated-dashboard state cannot be created through the UI — data must
  arrive server-side and enter the app through the real sync pull.
* EAS's hosted Maestro runners cannot reach a developer-local API, and
  the EAS Maestro job type is billing-blocked anyway.
* No shared Development environment exists yet (`10_DEPLOYMENT.md`
  defines one, but deployment work is Phase 12).
* The server exposes goals only through `/sync/push` — there is no goals
  REST endpoint.

### Decision

Staged hybrid:

1. **Now:** E2E runs use a **seeded local API** — the real NestJS `api/`
   plus disposable PostgreSQL, colocated with the Android emulator
   (developer machine or a single CI runner). The emulator reaches the
   host via `adb reverse tcp:3001 tcp:3001`, so the e2e build profile
   keeps `EXPO_PUBLIC_API_URL=http://127.0.0.1:3001` and can never reach
   a non-local backend.
2. **Seeding uses public API/sync contracts only** — register/login via
   `/auth/*`, profile via `PUT /users/me/profile`, evaluations via
   `POST /medical/evaluations`, and goals by emulating a device push via
   `/sync/push`. No test-only backend endpoints.
3. **Fake, synthetic, non-sensitive data only**, unique per run via
   environment variables.
4. **Later (Phase 12):** a hosted disposable Development/test API
   becomes the backend for EAS cloud Maestro runs once billing is
   enabled — only the E2E build profile URL changes.
5. GitHub Actions E2E uses the **EAS-built e2e APK artifact**, fetched
   with an `EXPO_TOKEN` repository secret (no native prebuild in the
   repo).

### Options Considered

1. Seeded local API (chosen for now)
2. Mock transport / fake backend compiled into the app
3. Hosted disposable test API immediately
4. Staged hybrid of 1 → 3 (chosen)

### Rationale

The seeded local API preserves real behavior end to end — real auth,
token rotation, sync push/pull, conflict machinery — which is exactly
the layer where Phase 10 validation found its bugs. It requires zero
product-code changes and no internet-exposed infrastructure. A mock
transport was rejected: it would fake the riskiest layers, requires
inventing a DI seam the app deliberately does not have, and risks
test-only code paths in release artifacts. An immediate hosted test API
was rejected as premature infrastructure before Phase 12; it remains
the planned enabler for EAS cloud Maestro.

### Consequences

Positive:

* Full-fidelity E2E now, at zero infrastructure/billing cost.
* The seed script's `/sync/push` goal seeding doubles as a
  second-device sync test of the public contract.
* The EAS Workflow path (ADR-P007) stays intact; enabling it later is a
  build-profile URL change plus billing.

Negative:

* EAS cloud Maestro stays blocked until Phase 12 hosting + billing.
* CI E2E depends on GitHub-hosted Android emulation (flake risk) and an
  `EXPO_TOKEN` secret for artifact download.
* The seed script is coupled to the sync wire format for goals until a
  goals REST endpoint exists.

### Related Documents

* ADR-P007
* .ai/09_TESTING.md
* .ai/10_DEPLOYMENT.md
* .ai/13_MIGRATION_ROADMAP.md

---

# Rejected Decisions

No rejected decisions documented yet.

---

# Superseded Decisions

No superseded decisions documented yet.

---

# ADR Maintenance Rules

* Never delete accepted ADRs.
* Never rewrite historical ADRs to hide previous decisions.
* If a decision changes, create a new ADR and mark the previous one as Superseded.
* Every major architectural change requires an ADR.
* Every new dependency with architectural impact requires an ADR.
* Every security-sensitive change requires an ADR.
* Every database strategy change requires an ADR.
* Every iCoach behavior change requires documentation and, when significant, an ADR.

---

# AI Instructions

Every AI agent working on AppFitness must read this file before proposing architectural changes.

Do not suggest alternatives that contradict accepted ADRs unless explicitly asked to reconsider the decision.

If a new decision is needed, propose a new ADR using the official template.

Never silently override accepted decisions.
