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

## ADR-P009 - API Hosting Provider and Environment Topology

Status: **Accepted** (2026-07-07, by project owner — Railway primary /
Fly.io fallback confirmed; Development-only topology for Phase 12;
data locality: **US** unless the owner explicitly overrides before the
first deployment)
Date: 2026-07-07
Owner: DevOps/Backend Architecture

### Context

Phase 12 (store-release preparation) requires the first hosted backend:
internal testers need a reachable API, ADR-P008 stage 2 needs a hosted
test API for EAS cloud Maestro, and `10_DEPLOYMENT.md` defines a
Development → Staging → Production environment ladder that currently
has zero rungs. The api/ is a standard NestJS + Prisma + PostgreSQL
service with `/health`, committed migrations, and proven boot-on-
ephemeral-infra behavior (CI). It is not yet containerized. It handles
encrypted medical data (ADR-P006), so secret custody and data locality
matter from the first environment.

### Decision (proposed)

1. Host on a **managed container PaaS of the Railway/Fly class**, with
   **Railway as the primary recommendation** and Fly.io as the named
   fallback (choice confirmed at acceptance): deploy `api/` from a
   Dockerfile, attach the platform's managed PostgreSQL, one isolated
   project/environment per rung.
2. **Development environment only in Phase 12.** It serves internal
   testers AND doubles as the ADR-P008 stage-2 hosted test API —
   pointing the e2e build profile at its HTTPS URL is the entire
   remaining unlock for EAS cloud Maestro (besides billing). Staging
   and Production are created later from the same recipe, never shared
   with Development data.
3. **Secrets** live only in the platform's secret manager (fresh
   `JWT_ACCESS_SECRET`, fresh `MEDICAL_ENC_KEY`/`KEY_ID` per ADR-P006,
   `DATABASE_URL`, monitoring DSN). Never in the repo, never reused
   from dev machines.
4. **Migrations** run as a release step: `prisma migrate deploy` against
   the environment's database before the new image serves traffic.
   Migration policy stays additive/expand-first per `04_DATABASE.md`;
   destructive migrations require an explicit approved plan.
5. **Rollback:** redeploy the previous container image (platform-native
   one-click/CLI); because migrations are expand-first, the previous
   image must run against the newer schema. Database restore path =
   platform snapshot/backup, verified once as part of Phase 12
   validation.

### Options Considered

1. Railway/Fly-class managed PaaS (chosen)
2. Render-class managed host
3. VPS/self-managed Docker host (e.g. Hetzner + compose)
4. Defer hosting entirely

### Rationale

Railway/Fly-class gives Dockerfile-native deploys, managed Postgres,
per-environment isolation, built-in secret management, and usage-based
pricing appropriate for a Development environment — the least
operational surface for a solo project handling sensitive data.
Render-class is equivalent in capability but its free/starter tiers
spin down and its Postgres pricing ladder is less favorable at this
scale; it remains an acceptable substitute, not the recommendation. A
self-managed VPS is the cheapest at steady state but transfers OS
patching, Postgres backups, TLS, and secret custody onto the project —
exactly the burden `10_DEPLOYMENT.md`'s philosophy avoids at this
stage. Deferring hosting would block internal testing, ADR-P008 stage
2, and most of the Phase 12 release checklist.

### Consequences

Positive:

* One recipe (Dockerfile + managed Postgres + secret store) reused for
  all three environments.
* Unlocks internal testers, hosted test API, and cloud Maestro with a
  single environment.
* Platform-managed TLS satisfies the no-cleartext production posture.

Negative:

* Recurring cost begins (small; Development-sized).
* Provider lock-in is shallow (Dockerfile + Postgres dump portability)
  but nonzero.
* EU/US data-locality choice must be made at project creation and is
  awkward to change later — flagged for acceptance.

### Related Documents

* .ai/10_DEPLOYMENT.md
* .ai/05_SECURITY.md
* .ai/04_DATABASE.md
* ADR-P006, ADR-P008

---

## ADR-P010 - Monitoring, Crash Reporting, and OTA Update Policy

Status: **Accepted** (2026-07-07, by project owner — Sentry on both
tiers with the strict privacy controls below; OTA/expo-updates remains
deferred; DSNs only from environment/secret stores)
Date: 2026-07-07
Owner: DevOps/Mobile Architecture

### Context

Phase 12's exit criteria require monitoring/error tracking wired and
verified; `10_DEPLOYMENT.md` says "Use Sentry or equivalent" and lists
OTA updates as part of the mobile release strategy. Nothing is
installed. The app handles medical data: crash reports and breadcrumbs
are a classic PHI-leak channel, and the project's own logger policy
(TECHDEBT-003) already established redaction-by-default. `expo-updates`
is not installed and OTA implies an update/rollback policy and store-
compliance obligations.

### Decision (proposed)

1. **Sentry on both tiers** — `@sentry/react-native` (via the Expo
   config plugin) in mobile and Sentry's NestJS integration in api —
   added only after this ADR is Accepted (new dependencies).
2. **Privacy posture is non-negotiable:** `sendDefaultPii` disabled;
   `beforeSend` scrubbers on both tiers reusing the TECHDEBT-003
   redaction key-list (token/password/secret/key/notes/conditions/
   medications/payload); no request/response bodies or sync payloads in
   breadcrumbs; user context limited to opaque user id; medical
   free-text can never appear in events by construction (it is
   encrypted before it reaches any loggable layer). Scrubbing behavior
   gets unit tests like the logger did.
3. **Source maps** uploaded to Sentry during EAS builds via the Sentry
   Expo plugin so release stack traces are symbolicated; DSNs and auth
   tokens live in EAS/host secret stores.
4. **OTA updates: DEFERRED.** `expo-updates` is not adopted in Phase 12.
   Rationale: no user base yet, OTA adds an update-channel/rollback
   policy and review-compliance surface, and `10_DEPLOYMENT.md` already
   constrains OTA to non-native, policy-safe changes. Mobile rollback in
   Phase 12 is therefore store/track rollback plus a new build.
   Revisit with its own acceptance gate before Production launch.

### Options Considered

1. Sentry both tiers + OTA deferred (chosen)
2. Alternative SaaS (Bugsnag-class) or self-hosted (GlitchTip)
3. No monitoring in Phase 12
4. Adopt expo-updates now

### Rationale

Sentry has first-party Expo/React Native and NestJS paths, the
strongest source-map story for EAS builds, and a serviceable free tier
— and `10_DEPLOYMENT.md` names it. Alternatives add integration work
without offsetting benefits; self-hosting a monitoring stack
contradicts the managed-first posture of ADR-P009. Shipping without
monitoring fails a Phase 12 exit criterion outright. Adopting OTA now
front-loads policy and compliance cost for zero users.

### Consequences

Positive:

* Release builds become debuggable (symbolicated crashes) before any
  tester touches them.
* One redaction policy shared between the dev logger and crash
  reporting.

Negative:

* Two new dependencies (mobile + api) once Accepted.
* Crash data leaves the project's infrastructure — mitigated by
  scrubbing, EU region selection at Sentry org creation (flagged for
  acceptance), and no-PHI-by-construction.
* Without OTA, every mobile fix during testing rides a full build +
  track update cycle.

### Related Documents

* .ai/10_DEPLOYMENT.md
* .ai/05_SECURITY.md
* .ai/03_CODING_STANDARDS.md (no silent error swallowing / TECHDEBT-003)
* ADR-P009

---

## ADR-P011 - Account & Personal-Data Deletion Strategy (GDPR erasure vs. audit immutability)

Status: **Accepted** (2026-07-08, by project owner) — see **Revision
2026-07-08** below, which replaces the original explicit-enumeration
decision with database-enforced cascade after implementation inspection.
Date: 2026-07-08
Owner: Backend Architecture / Security

### Revision 2026-07-08 (supersedes decision points 1–2 below)

Implementation inspection (Phase 12 Step 6) surfaced two facts the
original decision did not account for:

1. **Server medical encryption uses a single shared `MEDICAL_ENC_KEY`
   (ADR-P006), not per-user keys.** Per-user "crypto-erasure by key
   destruction" is therefore impossible server-side without destroying
   every user's data. **Server-side, physical row deletion is the
   erasure mechanism.** (Device-side, the per-device SecureStore key in
   ADR-P001 still provides crypto-erasure of the local copy on
   uninstall/clear.)
2. **The blocker spans 20 user-owned `user_id` RESTRICT tables plus
   RESTRICT child-of-child FKs** (`meal_items→meals`,
   `meals→nutrition_logs`, `workout_sets→workout_logs`,
   `routine_exercises→routines`), most belonging to modules not yet
   built. Hand-ordered transactional enumeration across ~24 interdependent
   tables — kept correct as new modules land — is more accident-prone
   than the CASCADE it was meant to avoid.

**Revised decision:** use **database-enforced `ON DELETE CASCADE`** for
user-owned data only — the 20 `user_id` FKs and the 4 structural
child-of-child FKs whose parent is user-owned. **Shared/catalog
references stay `RESTRICT`** (`routine_exercises→exercises`,
`workout_sets→exercises`, `meal_items→foods`,
`user_achievements→achievements`) so deleting a user never touches shared
data. Deletion is then a single guarded, authenticated, audited
`user.delete()`; the database guarantees no orphans and cannot miss a
future user-owned table. The **null-only `audit_logs` trigger exception
is still required** (below) because `audit_logs→users` stays `SET NULL`
and the immutability trigger otherwise rejects the FK cascade. Accidental
mass-deletion risk is controlled by there being exactly one guarded
deletion entry point (no admin bulk-delete, no cascade from elsewhere).
Decision points 3–4 (audit trigger exception; final `ACCOUNT_DELETE`
event) are unchanged.

### Context

Store release (Phase 12) and the privacy commitments in `05_SECURITY.md`
("users must be able to delete their data") require a working account /
personal-data deletion path. Today a hard delete of a user is blocked at
the database level on two independent fronts (TECHDEBT-002):

1. **Immutable audit trail vs. FK cascade.** `audit_logs.user_id` is
   `ON DELETE SET NULL`, but the `trg_audit_logs_immutable` trigger
   (`reject_audit_mutation()`) raises on *any* UPDATE or DELETE — so the
   FK-driven `SET NULL` is itself rejected. Deleting a user who has audit
   rows (every user, from registration onward) fails.
2. **RESTRICT children.** `user_profiles`, `goals`, `medical_evaluations`,
   `medical_restrictions`, `health_logs`, `routines`, `workout_logs`,
   `workout_sets`, `routine_exercises` all use `ON DELETE RESTRICT`, so a
   user with any such row cannot be deleted until those are handled.
   (`devices`, `refresh_tokens`, `sync_operations`, `sync_conflicts`
   already `CASCADE` and are fine.)

The Google Play Data Safety form and GDPR Art. 17 both require a truthful
deletion capability; `PLAY_DATA_SAFETY.md` currently marks every deletion
cell "Blocked" because of this.

### Decision (proposed)

A transactional **deletion service** in `api/` plus one **minimal,
security-reviewed schema/trigger migration**:

1. **RESTRICT children** — the deletion service explicitly removes the
   user's medical/profile/goal/workout rows within a single transaction
   (order respects FKs). Preferred over switching FKs to CASCADE so
   deletion stays an explicit, audited, intentional operation rather than
   an implicit side effect.
2. **Encrypted medical free-text — crypto-erasure as defense in depth.**
   Because medical free-text is AES-256-GCM encrypted per device/server
   key (ADR-P001/P006), destroying the relevant key material renders any
   residual ciphertext unrecoverable, complementing physical deletion.
3. **Audit trail — sever the link, keep the record.** Relax
   `trg_audit_logs_immutable` to permit **exactly one** mutation: an
   UPDATE that only nulls `user_id` (the FK-cascade shape). All other
   UPDATE/DELETE on `audit_logs` stays rejected, so audit *content*
   remains append-only/immutable while personal linkage becomes
   severable. Audit rows are retained (anonymized) to satisfy
   security/legal retention obligations noted in `05_SECURITY.md`.
4. **Emit a final audit event** ("account_deleted") before severing, so
   the deletion itself is auditable.

Net effect: identifiers and health data are physically deleted +
crypto-erased; the immutable audit trail is preserved but de-identified.

### Options Considered

1. Transactional deletion service + null-only audit-trigger exception +
   crypto-erasure (chosen)
2. Anonymize audit rows via a controlled `SECURITY DEFINER` procedure the
   trigger whitelists (heavier; more surface than a null-only exception)
3. Drop the `audit_logs.user_id` FK and keep a bare UUID (a deleted
   user's UUID alone is arguably not PII — but weakens referential
   guarantees and still needs privacy sign-off)
4. Switch all RESTRICT children to `ON DELETE CASCADE` (makes deletion
   implicit/accident-prone; rejected)
5. Soft-delete only (does not satisfy erasure; rejected as the sole
   mechanism)

### Consequences

Positive: a truthful, auditable deletion capability; audit content
integrity preserved; health data provably unrecoverable via key
destruction. Negative: requires a new forward migration to the audit
trigger (security-reviewed) and a well-tested deletion service; the
crypto-erasure key-scoping must be designed so one user's erasure cannot
affect another's data.

### Retention-window resolution (2026-07-08, Phase 12 Step 6B)

**v1 = immediate, irreversible hard deletion; no recovery window.**
Rationale: no user base yet; immediate deletion is the simplest behavior
to reason about and is exactly what the implemented + e2e-tested path
does. The **only retained artifact is the anonymized (de-identified)
audit trail**, which satisfies the security-log obligation in
`05_SECURITY.md` without retaining personal data. Deletion is **surfaced
in-app** with a typed-confirmation gate (Step 6B), so no separate
documented-request process is needed for Play.

Deferred (needs legal input, not an engineering call): whether a
jurisdiction requires a grace/recovery window or a legal-hold period
before permanent removal. If so, the existing `PENDING_DELETION`
`UserStatus` + a scheduled purge job is the intended mechanism — a
future ADR/migration, not v1. The compliance drafts must not state a
specific legally-vetted retention period until that review happens.

### Open questions for review (remaining)

- Confirm no jurisdiction in scope mandates a minimum retention/grace
  window that would require switching from immediate delete to
  `PENDING_DELETION` + scheduled purge.
- Whether to additionally harden the delete endpoint with password/step-up
  re-auth (currently access-token-guarded + in-app typed confirmation).

### Related Documents

- .ai/05_SECURITY.md (Privacy, Data Retention)
- .ai/12_DECISIONS.md (ADR-P001, ADR-P006)
- .ai/15_DATABASE_SCHEMA_DESIGN.md
- api/prisma/migrations/20260703181824_init/migration.sql (audit trigger, FKs)
- docs/legal/DATA_INVENTORY.md, docs/legal/PLAY_DATA_SAFETY.md
- Backlog TECHDEBT-002

---

## ADR-P012 — Offline-First Food Logging, Nutrition Catalog Identity, and Conflict Semantics

Status: **Accepted**
Date: 2026-07-10
Accepted: **2026-07-10 by project owner**
Owner: Architecture / Data / Security

> This ADR gates Phase 15 Slice 4 (Food Logging). It was **Accepted 2026-07-10
> by the project owner** (see **Acceptance Resolution**). Acceptance is
> documentation-only: nothing below has been implemented yet — no product code,
> schema, migration, seed, or dependency was changed by this acceptance. Slice 4
> is now **approved to proceed incrementally**, beginning with the foundation
> slice **4A**, under the implementation constraints recorded below.

### Context

Phase 15 Slices 1–3 shipped read-only nutrition: engine-driven targets
(`/nutrition`), a bundled 300-food catalog with stable slug ids
(`food.chicken_breast`, `CATALOG_VERSION='food-catalog@1.0.0'`), and a
deterministic read-only 15-day meal plan (`/nutrition-plan`, verified E2E).
Slice 4 introduces **actual intake logging** — a net-new synchronized,
Highly-Sensitive write domain.

Repository evidence establishes the ground truth this ADR must reconcile:

- **Tables exist but are inert.** `api/prisma/schema.prisma` defines `Food`,
  `NutritionLog`, `Meal`, `MealItem` (and `MealType`); `mobile/.../database/
  types.ts` mirrors them (`FoodRow`, `NutritionLogRow`, `MealRow`,
  `MealItemRow`). There are **no** repositories, stores, UI, mobile appliers,
  backend handlers, or a NestJS nutrition module.
- **Identity mismatch + missing catalog metadata.** `Food.id` is `@db.Uuid`;
  `MealItem.foodId` is `@db.Uuid` with FK `onDelete: Restrict`. The Slice-2
  catalog keys foods by slug, not UUID, and **no mapping exists**. Worse, the
  live `Food` table has **no catalog key, no catalog/revision version, and no
  serving metadata** — only `name`, `brand?`, a generic `version Int`,
  `createdBy?`/`isVerified`, and macros the schema documents as **"per 100 g"**
  (`// macros per 100 g`). It therefore **cannot receive the proposed
  normalized per-serving catalog seed without a forward schema correction**
  (below).
- **No macro snapshot.** `MealItem` stores only `food_id` + `quantity_grams`
  (both schemas). Catalog calories are Atwater estimates (Slice 2) and may be
  corrected; historical totals would then change retroactively.
- **Plaintext notes.** `nutrition_logs.notes` is a plaintext `String?`
  (Postgres) / `notes TEXT` (SQLite) — no `_enc` column. ADR-0011 classes all
  health data Highly Sensitive.
- **Sync pipeline is entity-agnostic and causal-by-construction.**
  `api/src/modules/sync/application/sync.service.ts` applies push ops
  **"Sequential on purpose: client queues are causally ordered"**; pull sorts
  changes by monotonic `sync_seq`. Version mismatch → a `sync_conflicts` row,
  **never auto-overwritten**. `EntitySyncHandler` (sync.types.ts) exposes
  `getServerState / apply / pullChanges / redactForConflict?` — the last
  explicitly to keep sensitive fields out of `sync_conflicts` JSONB. The
  mobile queue (`sync-queue.ts`) already encrypts payloads at rest when an op
  is enqueued with **`sensitive: true`** (the `{__enc}` envelope via the
  ADR-P001 field cipher), and `SyncOperation.id` is the idempotency key.
- **Documented parity note.** `.ai/16_SQLITE_SCHEMA_DESIGN.md` already records
  the `"order"` (Prisma) ↔ `order_index` (SQLite) mapping owned by the sync
  layer; `.ai/15` treats catalogs as server-owned/pull rows.
- **Established write pattern + real REST contracts.** Profile, goal, and
  medical writes flow local-first → sync queue → backend `EntitySyncHandler`.
  Alongside that, **real supported REST write endpoints exist** and are product
  contracts (not E2E-only): `PUT /users/me/profile`, `POST /medical/evaluations`,
  and `POST /medical/restrictions`. Nutrition **deliberately** forgoes a REST
  write path so intake has exactly one offline-first write path (below).

### Decision

Adopt an **offline-first, sync-only, snapshot-preserving** food-logging model
that reuses the existing sync/conflict/encryption machinery and adds a backend
`NutritionModule` of entity handlers — with **no second write path** and **no
recomputation of the deterministic plan**. Concretely (each expanded below):

1. **Normalize serving semantics first** (below) and log intake as a positive
   `serving_count` of a catalog food, NOT raw `quantity_grams`.
2. Log **actual intake** as `NutritionLog → Meal → MealItem`, separate from the
   generated `NutritionPlan`/`MealPlan`, which remain read-only.
3. Reference **only the bundled 300-food catalog** in v1; defer custom foods
   and free-text notes (notes deferral is **non-blocking** — see below).
4. Correct the `Food` schema (catalog key/revision/version + serving metadata +
   per-serving macro basis) and give every catalog food a **stable, revision-
   scoped UUID** (`uuidv5(catalog_key + food_revision)` under a documented fixed
   namespace), precomputed at build time (no runtime crypto dependency) and
   shared byte-for-byte by the bundle, SQLite, and PostgreSQL. **Catalog
   revisions are immutable** — a corrected food is a new revision/UUID; old
   revisions are retained and FK-valid so older clients stay compatible.
5. **Snapshot per serving** on each `MealItem` at create, **derived by the
   server** from its matching immutable food revision (the client sends only
   `food_id` + `serving_count` + revision identity; the backend never trusts
   client names/macros; unknown revisions → `CATALOG_REVISION_UNSUPPORTED`).
   Only `serving_count` is mutable; consumed totals are **derived** as
   `serving_count × per-serving snapshot`. Foods are versioned + soft-deleted,
   never hard-deleted.
6. Preserve **causal order** via FIFO enqueue (parent→child) + the backend's
   sequential apply + a **deterministic per-applier pull order**
   (`nutrition_logs` → `meals` → `meal_items`), with a small safe protocol
   change for missing parents (below).
7. Use **versioned mutable entities with explicit soft-delete tombstones**
   (not FK cascade); corrections allowed; conflicts recorded and **never
   silently merged** — explicit resolution only.
8. Enforce Highly-Sensitive controls **everywhere**: `sensitive:true` queue
   encryption, encrypted local conflict payloads, `redactForConflict` on all
   nutrition handlers (exclude notes + food-name snapshots), and no PHI in
   logs/Sentry/audit; a single additive `NUTRITION_CHANGE` audit action.

### Entity and Aggregate Model

- **Aggregate root: `NutritionLog`** — one per user per **local calendar day**
  (`@@unique(userId, date)`). Owns its `Meal`s; `date` is immutable (moving a
  day = soft-delete + create).
- **`Meal`** (child) — `type ∈ {BREAKFAST,LUNCH,DINNER,SNACK}` (existing
  `MealType`), `order_index`/`order` for intra-day ordering; denormalized
  `user_id` for sync scoping. Cardinality: 0..n meals per log; multiple meals
  of the same type are allowed (no `unique(log,type)`), ordered by
  `order_index`.
- **`MealItem`** (child) — `meal_id`, `food_id`, **`serving_count`** (positive;
  replaces raw `quantity_grams`), **plus the per-serving snapshot fields
  (below)**; denormalized `user_id`.
- **Ownership/boundary:** the aggregate is user-owned; all three carry
  `user_id` so backend handlers scope every read/write by owner.
- **Soft-delete is explicit tombstones, NOT FK cascade.** The database
  `ON DELETE CASCADE` on the parent FKs governs **physical** deletion only
  (e.g., account hard-erasure, ADR-P011) — it does **not** fire on ordinary
  soft-delete. Ordinary removal sets `deleted_at`/`deleted_by` and replicates
  as a soft-delete op; the client emits **explicit child tombstones plus the
  parent tombstone in causal order** and the backend applies each, so both
  sides converge without relying on the DB cascade.
- **Supported operations:** CREATE (log/meal/item), UPDATE (`meal.type`/
  `order_index`; `meal_item.serving_count`), soft-DELETE (all three, via
  tombstone). Snapshot fields are immutable; a correction that changes the
  *food* is soft-delete-item + create-item.

### Catalog Identity and Versioning

- **Food-table schema correction (prerequisite; not purely additive).** The
  live `Food` table lacks the columns the catalog model needs. A forward-only,
  pre-activation schema correction adds, in **both** Prisma and SQLite:
  - **`catalog_key`** (nullable text) — the stable natural key for bundled foods
    (`food.chicken_breast`); nullable so **future custom user foods** (no catalog
    key) remain possible.
  - **`food_revision`** (int) and **`catalog_version`** (text) — per-food
    revision and the release-level catalog stamp.
  - **`serving_amount`** (float) + **`serving_unit`** (text) canonical serving,
    and nullable **`grams_per_serving`** (float).
  - **Macro fields whose names and documented basis explicitly mean *per
    canonical serving*** — replacing/re-basing the current `// macros per 100 g`
    columns, so the seeded values are unambiguous.
  - A **uniqueness rule for bundled catalog revisions** — unique
    `(catalog_key, food_revision)` **where `catalog_key IS NOT NULL`** (a partial
    index), which pins each bundled revision exactly once while leaving
    custom foods (null `catalog_key`) unconstrained.
- **Deterministic UUIDv5 from `catalog_key + food_revision`** under a fixed,
  documented AppFitness nutrition namespace UUID:
  `Food.id = uuidv5(catalog_key + ':' + food_revision, NUTRITION_NAMESPACE)`.
  The `(catalog_key, food_revision)` pair is the human-stable natural key; the
  UUID is its deterministic, reproducible projection. Precomputed at build time
  and bundled as static data (no runtime UUIDv5 dependency); the backend seed
  uses the identical id list; the derivation is documented so any party can
  regenerate/verify it.
- **Immutable catalog revisions (old-client-safe).** Nutritional values are
  **never updated in place** for an existing catalog revision. A corrected food
  is a **new `food_revision` → new UUID**; the old revision row is **retained
  and FK-valid** forever. The **mobile bundle carries the current revisions**;
  **PostgreSQL retains every supported revision** so a `MealItem` created by an
  older client still resolves its exact food revision. A global
  **`CATALOG_VERSION` bump remains the release-level traceability marker** (it
  does not mutate any prior revision).

### Catalog Initialization and Distribution

- **Bundle-and-seed both sides, idempotently, with identical ids.** On first
  run the app seeds local SQLite `foods` (`INSERT OR IGNORE` by id) from the
  bundled current revisions, so foods exist locally before any `meal_item` FK
  write (offline-safe). The backend seeds PostgreSQL `foods` (upsert by id) at
  deploy via a deterministic, re-runnable seed — a **data seed of global catalog
  rows** (`created_by = NULL`, `is_verified = true`), not a migration of user
  data. Because revisions are immutable, seeding is **insert-new-revisions-only**:
  it never overwrites an existing `(catalog_key, food_revision)` row, and the
  server **accumulates** every supported revision while the bundle ships only the
  current ones.
- Foods are effectively **read-only catalog** in v1 (no write endpoint, no user
  edits). **Custom user foods are deferred** (the nullable `catalog_key` +
  existing `created_by` column anticipate them). Because the catalog is bundled +
  seeded identically, a dedicated foods *pull* handler is **not** required for
  v1 — an older client keeps working against the revisions retained server-side.

### Serving-Unit Normalization (prerequisite)

Three things disagree today: the Slice-2 **bundled catalog data** authors macros
**per serving**, the dormant **`Food` table** documents its macro columns **"per
100 g"**, and the dormant `meal_items` row stores raw `quantity_grams` — while
the bundled catalog even encodes servings inconsistently (e.g. one 182 g apple
is authored as `piece(182)` = `{amount: 182, unit: 'piece'}`, conflating a gram
weight with a piece count). **Food logging must not be activated until serving
semantics are normalized** and the `Food` schema is corrected (see *Catalog
Identity and Versioning*). Decision for v1:

- Catalog macros are stored and documented **per canonical serving** — this
  **re-bases the current per-100 g `Food` macro columns** as part of the schema
  correction.
- Each catalog serving is normalized to an **actual amount + unit** — one apple
  becomes `amount: 1, unit: 'piece'`, with the **gram weight recorded
  separately** (`grams_per_serving`) when known.
- Replace the dormant `meal_items.quantity_grams` via a **forward migration**
  (both schemas; a replacement, not an additive add) and log intake as a positive
  **`serving_count`** instead.
- Permit gram-based entry **only** when the selected food has a valid gram
  conversion (`grams_per_serving` present); otherwise the user logs
  **fractional servings** (e.g. `serving_count = 1.5`).
- This serving-unit conflation is recorded as the third integrity risk under
  **TECHDEBT-004**.

### Historical Macro-Integrity Strategy

- **Per-serving snapshot (chosen).** At create time, `MealItem` records the
  food's immutable **`food_name_snapshot`**, the resolving **catalog identity**
  (`catalog_key`, `food_revision`, `catalog_version`), serving **amount/unit**
  (`serving_amount_snapshot`, `serving_unit_snapshot`), optional
  **`grams_per_serving_snapshot`**, and **per-serving** macros
  (`calories_per_serving_snapshot`, `protein_per_serving_snapshot`,
  `carbs_per_serving_snapshot`, `fat_per_serving_snapshot`,
  `fiber_per_serving_snapshot`). These snapshot fields are **immutable** after
  creation.
- **Snapshot trust boundary (server-derived).** Mobile derives its *local*
  snapshot from its **bundled immutable food revision**, but the **sync payload
  carries only `food_id`, `serving_count`, and the catalog/revision identity
  (`food_id` already encodes `catalog_key + food_revision`)** — **never** names
  or macros. The **backend does not trust client-supplied names or macros**: it
  loads the **matching immutable server food revision** and derives the persisted
  **server** snapshot itself. An unknown or unsupported revision returns a typed,
  **non-silent** compatibility error **`CATALOG_REVISION_UNSUPPORTED`** (not a
  best-effort accept). Because both sides derive from the *same immutable
  revision*, the local and server snapshots are byte-identical by construction —
  a property the tests must prove.
- **Only `serving_count` is mutable.** Consumed totals are **derived**
  (`serving_count × per-serving snapshot`) and never persisted as a second
  immutable value — the ADR does not treat both a per-serving snapshot and a
  quantity-adjusted total as immutable. A later catalog macro correction cannot
  alter historical intake, because totals recompute only from the immutable
  per-serving snapshot × the (mutable) count.
- **Foods remain versioned + soft-deleted** (`version`, `deleted_at`) and are
  **never hard-deleted**; the `onDelete: Restrict` FK guarantees a referenced
  food row persists. Satisfies ADR-0011/ADR-P011 (health data is never silently
  mutated or lost).
- **Schema impact:** new nullable per-serving snapshot columns on `meal_items`
  **plus** the `quantity_grams → serving_count` replacement, in **both** schemas
  — a forward-only, pre-activation migration (SQLite create/upgrade + Postgres)
  that is **data-safe but not purely additive** (the replacement changes an
  existing column). Rejected alternatives: (a) recompute from live catalog (fails
  integrity); (b) client-authored snapshots trusted by the server (fails the
  trust boundary — server derives from its own revision instead).

### Sync and Conflict Semantics

- **Wire shapes / entity names:** `nutrition_logs`, `meals`, `meal_items`
  (matching `entity_type`), payloads shaped like the row snapshots the existing
  handlers use. The meal handler maps `order_index` ↔ `order` (per `.ai/16`). The
  **`meal_items` payload is deliberately minimal** — `food_id`, `serving_count`,
  and the catalog/revision identity — and the backend derives the persisted
  snapshot from its own immutable food revision (see snapshot trust boundary),
  rejecting unknown revisions with `CATALOG_REVISION_UNSUPPORTED`.
- **Push causal order (create):** the mobile repository writes log→meal→item in
  one local transaction and **enqueues CREATE ops in that FIFO order**; the
  backend applies push ops **sequentially in received order** (evidence:
  `sync.service.ts`), so parents commit before children.
- **Push rejection — smallest safe protocol change (proposed, not existing).**
  Today `sync-worker.ts` handles a backend `REJECTED` result by
  **`removeRejected(opId)`** — it deletes the op and does **not** retain
  children for retry. A child whose parent has not yet applied would be
  permanently dropped. Proposed change: the backend returns a typed
  **`DEPENDENCY_NOT_READY`** error code for an FK/missing-parent apply failure;
  the mobile worker treats `DEPENDENCY_NOT_READY` as **retryable** — mark
  **FAILED** (keep the queue item, existing backoff) instead of removing it —
  and, if it never resolves, surfaces a **persistent, actionable failure**.
  **Permanent** validation/ownership rejections remain **non-retryable**
  (removed as today). This is a proposed addition; it does not exist yet.
- **Pull ordering — per-applier, deterministic.** The mobile worker pulls
  **separately per registered applier**, each with its own cursor
  (`pullLoop` in `sync-worker.ts`), so a global `sync_seq` alone does **not**
  guarantee cross-entity order. Require a **deterministic applier order**
  (`nutrition_logs` → `meals` → `meal_items`, by registration order) and **pull
  all pages of each parent entity before advancing to its children**. If an
  applier encounters a **missing parent** while applying a pulled child, it
  **fails that pull without advancing its cursor** and retries on the next
  sync. No in-memory deferral buffer is introduced (none exists in the worker,
  and repository evidence does not require one).
- **Idempotency / retries / tombstones:** `op_id` UUID is the idempotency key
  (duplicate retries are no-ops, `duplicate:true`); soft-delete tombstones
  (`deleted_at`, `deleted_by`) replicate as UPDATE ops in causal (child-first)
  order; retries use the existing FAILED-with-backoff queue.
- **Per-entity conflict policy (multi-device):** every entity is
  **version-guarded**; a base-version mismatch records a `sync_conflicts` row
  and is **never auto-overwritten** (evidence). **No automatic merge** for any
  nutrition entity — the user (or a future explicit resolver UI) reconciles.
  Rationale: intake is health data; silent last-write-wins could erase a
  correction or a removal. Corrections (`serving_count`) and removals
  (soft-delete tombstone) are ordinary version-guarded ops, not overwrites.

### Security and Privacy Controls

- **Classification (decided, not open):** food intake is **Highly Sensitive**
  (ADR-0011) **everywhere** — including the structured scalars. Their sensitivity
  is **not** downgraded to a lower tier; only the concrete at-rest *mechanism*
  differs by field type.
- **Local at rest (SQLite):** catalog `foods` are non-personal reference data.
  User nutrition rows (`food_id`, `serving_count`, `date`, `type`,
  `order_index`, per-serving snapshots) are Highly Sensitive and protected at
  rest by **OS file-based encryption** on the app database — the same at-rest
  posture the existing medical **structured** fields (e.g. evaluation
  weight/BP) already rely on. **`notes` free-text is out of v1 scope**; when
  added it MUST be field-encrypted (`notes_enc` + `enc_key_id`, ADR-P001
  cipher). No plaintext note is written in v1.
- **Local sync queue AND local conflict store — encrypted.** Nutrition ops
  enqueue with **`sensitive: true`**, so the queued payload is encrypted at rest
  via the field cipher (`sync-queue.ts`), and on a CONFLICT the worker likewise
  stores the local conflict payloads **encrypted** (`{__enc}`, `sync-worker.ts`
  lines 128–133). Queued and locally-recorded food data are never at rest in
  plaintext.
- **In transit:** TLS 1.3 (ADR-P001 refinement).
- **Server at rest (PostgreSQL):** structured nutrition columns protected by the
  managed database's at-rest encryption (ADR-P009); when notes land,
  `notes_enc bytea` + `enc_key_id` via the ADR-P006 cipher.
- **Server conflict records (`sync_conflicts`):** all nutrition handlers
  implement **`redactForConflict`** so `client_payload`/`server_snapshot` retain
  **only the minimum structured values required for resolution** (entity
  id/type, versions, operation, and the minimal fields a resolver needs) — and
  **MUST exclude `notes` and the food-name snapshot**. These records are
  protected by the database's at-rest controls. Because minimized structured
  intake values (e.g. `food_id`, `serving_count`) may remain, the ADR does
  **not** claim the conflict records are PHI-free — they are Highly Sensitive,
  minimized, and DB-at-rest-protected. (Redaction chosen over encrypting JSONB —
  reuses the existing hook.)
- **Logs / Sentry / audit:** **never** food names, quantities, ids, dates, or
  notes. Audit `metadata` stays operational — matching `AuditLog.metadata`
  "never medical/PII values." **One** additive `AuditAction` value
  **`NUTRITION_CHANGE`** carries the operation as metadata (e.g. `{ entityType,
  operation }`); no per-CRUD enum proliferation.
- **Authorization/ownership:** backend handlers scope every `getServerState`/
  `apply`/`pullChanges` by `user_id` (denormalized on all three entities);
  cross-user access is rejected — mirrors medical/goal handlers.

### Backend Contract

- Add a NestJS **`NutritionModule`** exposing three `EntitySyncHandler`s
  (`nutrition_logs`, `meals`, `meal_items`) registered in the sync entity
  registry: each implements `getServerState`, `apply` (owns payload validation
  + ownership + version/conflict + FK-order handling), `pullChanges`
  (incremental by `sync_seq`), and `redactForConflict`. The **`meal_items`
  handler additionally derives the persisted per-serving snapshot server-side**
  by loading the matching immutable food revision (never trusting client
  names/macros) and returns **`CATALOG_REVISION_UNSUPPORTED`** for an
  unknown/unsupported revision.
- **Nutrition deliberately chooses sync-only writes.** Profile and medical
  REST write endpoints **are real, supported product contracts** (not
  E2E-only). Nutrition intentionally does **not** add REST writes so that the
  new domain has exactly **one offline-first write path** (the sync queue),
  keeping causal ordering, conflict handling, and queue encryption uniform for
  health-sensitive intake. The catalog is **seeded**, not written via API. No
  new REST endpoints are added for nutrition in v1.

### Schema and Migration Impact

- **Forward-only and pre-activation, but *not* purely additive** (historical
  migrations remain untouched):
  1. **`foods` catalog schema correction (not additive).** Add `catalog_key`
     (nullable), `food_revision`, `catalog_version`, `serving_amount`,
     `serving_unit`, `grams_per_serving` (nullable), and **re-base the macro
     columns to *per canonical serving*** (a change of the documented column
     basis, not a pure column add), plus the partial-unique
     `(catalog_key, food_revision) WHERE catalog_key IS NOT NULL`. Postgres
     migration + SQLite create/upgrade. Runs **before any catalog seed or write
     path exists**, so it is **data-safe** (no user rows to migrate) — but it is
     a schema *correction*, not an additive add-only change.
  2. **`meal_items` serving model (not additive).** **Replace** the dormant
     `quantity_grams` with a positive **`serving_count`** (a rename/replacement,
     not an add), and add per-serving snapshot columns (`food_name_snapshot`,
     `catalog_key`, `food_revision`, `serving_amount_snapshot`,
     `serving_unit_snapshot`, `grams_per_serving_snapshot` nullable,
     `calories_per_serving_snapshot`, `protein_per_serving_snapshot`,
     `carbs_per_serving_snapshot`, `fat_per_serving_snapshot`,
     `fiber_per_serving_snapshot`, `catalog_version`). `meal_items` has no
     production rows yet, so the replacement is **data-safe** though not additive.
  3. `foods` global-catalog **data seed** (both sides, idempotent,
     insert-new-revisions-only) with normalized per-serving macros, serving
     amount/unit, and `grams_per_serving` — not a user migration.
  4. **One** new `AuditAction` value **`NUTRITION_CHANGE`** (this enum add *is*
     additive).
  5. **Two new sync error codes:** `DEPENDENCY_NOT_READY` (retryable
     FK/missing-parent apply failure) and `CATALOG_REVISION_UNSUPPORTED`
     (non-silent unknown/unsupported catalog revision) added to
     `SYNC_ERROR_CODES`.
  6. **Deferred (non-blocking):** `nutrition_logs.notes_enc bytea` + `enc_key_id`
     when notes ship (a later slice; notes are out of v1 scope).
- **Prisma/SQLite parity** maintained; the meal handler owns the
  `order`↔`order_index` mapping (`.ai/16`). No change to `Food.id` type (already
  UUID). No historical migration is touched.

### Options Considered

1. **Normalized-serving, snapshot-preserving, sync-only, bundled-catalog with
   deterministic UUIDs (chosen).** Normalizes serving amount/unit and replaces
   `quantity_grams` with `serving_count`; reuses existing
   sync/conflict/encryption; strongest integrity; offline-safe; no second write
   path; no feature toggle.
2. **Append-only intake (medical-evaluation style).** Rejected: users must be
   able to correct quantities and remove entries; append-only forces
   awkward reversal rows and complicates daily totals. Version-guarded mutable
   + soft-delete is safer *and* correctable, and still never silently
   overwrites.
3. **Live-catalog totals (no snapshot).** Rejected: catalog corrections rewrite
   history — violates ADR-0011 integrity intent.
4. **Runtime slug→UUID mapping / change `Food.id` to text.** Rejected: implicit
   mapping is fragile and forbidden by the gate; changing the PK type is a
   larger, non-additive schema change. Deterministic precomputed UUIDv5 gives a
   shared identity with zero runtime mapping.
5. **REST write endpoints for nutrition.** Rejected for v1: creates a second
   write path divergent from the offline sync queue.
6. **Encrypt `sync_conflicts` JSONB.** Rejected in favor of the existing
   `redactForConflict` hook (simpler, no new key/format), which removes notes and
   food-name snapshots but **may retain minimized structured intake fields** for
   resolution — so it does **not** keep all sensitive values out of the snapshot
   (those records stay Highly Sensitive and DB-at-rest-protected, not PHI-free).

### Rationale

The offline-first, deterministic, health-sensitive constraints are already
solved by the existing machinery (sequential causal apply, version conflicts
never auto-overwritten, `sensitive` queue encryption, `redactForConflict`,
per-entity handlers). The only genuinely new decisions are **identity**
(deterministic shared revision-scoped UUIDs), **historical integrity**
(per-item server-derived snapshots), and **date semantics** — each chosen for
correctness. The migrations are **forward-only, pre-activation, and data-safe,
but not purely additive** (the catalog macro re-basing and the
`quantity_grams → serving_count` replacement change existing columns). This
maximizes reuse, minimizes new surface, and keeps the deterministic plan
untouched.

### Consequences

Positive: strong historical integrity; correctable but never silently
overwritten intake; offline-first; reuses proven sync/security; forward-only
pre-activation migrations that touch no historical migration; no second write
path; catalog identity shared, revision-scoped, and verifiable; old clients stay
compatible via retained immutable revisions.
Negative: the catalog macro re-basing and the `quantity_grams → serving_count`
replacement are **schema corrections (not purely additive)**; the new
`Food`/`meal_items` columns, seed, one enum value, and the `DEPENDENCY_NOT_READY`
+ `CATALOG_REVISION_UNSUPPORTED` error codes require owner-approved forward
migrations/protocol changes; totals must be derived (slightly more query work);
the server must load a food revision to derive each snapshot (extra read); notes
are absent until a follow-up slice; a snapshot duplicates per-serving macros per
item (small storage cost, deliberate).

### Rollout and Rollback

- Implement as small slices (below). Seeds are idempotent and re-runnable.
  **No handler-registration feature toggle** is introduced — it would add an
  untested code path and a second way to lose sync coverage.
- **Rollback = redeploy the previous application version.** The forward
  migrations are **pre-activation and data-safe** — the catalog schema correction
  and the `quantity_grams → serving_count` replacement both run before any
  catalog seed or write path exists, so no user data is at risk **even though the
  changes are not purely additive**; no historical migration is reverted, and any
  rows written under the new version are preserved. The prior deployment simply
  does not register the nutrition handlers.

### Acceptance Criteria (for a future Accepted state + implementation)

- `Food` schema corrected (`catalog_key`, `food_revision`, `catalog_version`,
  `serving_amount`/`serving_unit`/`grams_per_serving`, per-serving macro basis,
  partial-unique `(catalog_key, food_revision)`); catalog serving semantics
  normalized; the `piece(182)`-style conflation is gone; `serving_count` replaces
  `quantity_grams`.
- Revision-scoped deterministic UUIDs (`uuidv5(catalog_key + food_revision)`)
  identical across bundle/SQLite/PostgreSQL; catalog seeds idempotent,
  insert-new-revisions-only, and FK-safe offline.
- **Catalog revisions immutable:** a food correction creates a new revision/UUID;
  old revisions remain retained and FK-valid, and an older client's
  `MealItem` still resolves its exact revision (old-client compatibility).
- **Snapshots are server-derived from the matching immutable revision** (client
  supplies only `food_id` + `serving_count` + revision identity); an
  unknown/unsupported revision returns non-silent `CATALOG_REVISION_UNSUPPORTED`;
  a test proves mobile and server derive **identical** snapshots from the same
  revision.
- Logging writes only nutrition entities; `NutritionPlan`/`MealPlan` unchanged
  and never recomputed.
- Push causal order holds; a not-yet-ready child yields **`DEPENDENCY_NOT_READY`**
  and is **retried** (FAILED-with-backoff), never `removeRejected`ed; permanent
  rejections stay non-retryable.
- Deterministic per-applier pull order (`nutrition_logs` → `meals` →
  `meal_items`), all parent pages before children; a missing parent fails the
  pull **without advancing its cursor** and retries next sync.
- Version conflicts recorded, never auto-merged; corrections (`serving_count`) /
  removals (tombstone) work.
- Totals derived (`serving_count × immutable per-serving snapshot`); catalog
  corrections don't alter history.
- Local queue and local conflict payloads encrypted; server `sync_conflicts`
  minimized (no `notes`, no food-name snapshot) and DB-at-rest-protected — Highly
  Sensitive, not claimed PHI-free; no PHI in logs/Sentry/audit; notes absent.
- `date` is the immutable local `YYYY-MM-DD`; no cross-day drift on timezone
  change.
- Tests green: unit (repo/handler/date/revision-UUID/serving-normalization/
  snapshot + **identical mobile-vs-server snapshot derivation**), integration
  (sync round-trip + conflict + `DEPENDENCY_NOT_READY` retry + pull order +
  `CATALOG_REVISION_UNSUPPORTED`), security (redaction/encryption/no-PHI-in-logs),
  offline (log→sync→reconnect), E2E (log a catalog food → appears in day →
  correct total → soft-delete).

### Acceptance Resolution

**Accepted 2026-07-10 by the project owner.** The consolidated recommendation
above was **approved in full** — the single design that bundles the `foods`
catalog schema correction + serving-unit normalization, `serving_count` +
immutable server-derived per-serving snapshots with derived totals, deterministic
revision-scoped catalog UUIDs (`uuidv5(catalog_key + food_revision)`) with
immutable retained revisions for old-client safety, sync-only writes with
`DEPENDENCY_NOT_READY` retryable push failures + non-silent
`CATALOG_REVISION_UNSUPPORTED`, deterministic per-applier pull ordering,
tombstone soft-delete, a single `NUTRITION_CHANGE` audit action, and
forward-only pre-activation migrations that are data-safe but not purely
additive.

This acceptance authorizes Phase 15 Slice 4 to **proceed incrementally**,
starting with foundation slice **4A**; it does **not** itself implement anything.
All decisions and implementation constraints recorded in this ADR remain binding.

**`notes` free-text stays explicitly deferred and NON-blocking.** Notes are
**out of v1 scope**; their encryption/key-scope decision is a future,
non-blocking gate that does **not** gate Slice 4A or any part of this acceptance.

**Slice 4A implementation guards (binding).** Before and during Slice 4A the
implementer MUST:

1. **Verify no production data** exists in the dormant nutrition/catalog tables
   (`foods`, `nutrition_logs`, `meals`, `meal_items`) **before** replacing or
   re-basing any column; the "data-safe" claim depends on this being true at
   migration time.
2. Implement the conditional **`(catalog_key, food_revision)` uniqueness** rule
   via **reviewed forward-migration SQL** (a partial unique index with the
   `WHERE catalog_key IS NOT NULL` predicate), because **Prisma cannot represent
   the partial-index predicate** directly.
3. Surface **`CATALOG_REVISION_UNSUPPORTED`** as an **actionable sync failure**
   (persistent, user-visible) and **never silently discard** the local
   operation.
4. **Preserve old immutable catalog revisions** — never update nutritional values
   in place for an existing revision; corrections mint a new revision/UUID.
5. **Never edit historical migrations** — all changes are new forward migrations.
6. Keep the **deterministic `NutritionPlan` and `MealPlan` unchanged** — logging
   never recomputes or mutates the generated plan.

### Slice 4A Implementation Note (2026-07-10)

Slice 4A (foundation only) is **implemented and code-validated**; the write
path, sync handlers/appliers, API routes, and UI are intentionally **not** part
of it. What landed:

- Forward-only migrations with no-production-data **preflight guards** —
  Postgres `20260710120000_add_nutrition_change_audit_action` +
  `20260710120100_nutrition_catalog_serving_model_4a`, and SQLite
  `002-nutrition-catalog-4a.ts` (registered via an optional `preflight` hook).
  Historical migrations untouched.
- `Food` schema correction (catalog_key, food_revision, catalog_version,
  serving metadata, per-serving macro rebase) with the **partial** unique
  `(catalog_key, food_revision) WHERE catalog_key IS NOT NULL` created in
  reviewed raw SQL (Prisma cannot express the predicate); `meal_items`
  `quantity_grams` → `serving_count` + immutable per-serving snapshot columns.
- Deterministic revision-scoped identity `uuidv5(catalog_key:food_revision)`
  under the fixed namespace `b9f4d2a1-6c7e-5a83-9d0b-1e2f3a4c5d60`; normalized
  serving + server-derived snapshot helpers; byte-identical canonical seed
  artifacts (mobile `.ts`, api `.json`) with mobile/server parity, golden-UUID,
  uniqueness, and normalization tests. **No runtime UUID dependency on mobile**
  (static ids shipped; derivation is a test-only pure-JS SHA-1). `FoodItem.id`
  and meal-plan output are unchanged (the generator already tie-breaks on the
  slug, which is now `catalog_key`).
- Definitions only: `DEPENDENCY_NOT_READY`, `CATALOG_REVISION_UNSUPPORTED`
  (`SYNC_ERROR_CODES`), `NUTRITION_CHANGE` (`AuditAction`).

**Behavioral validation (2026-07-13) — DONE.** Migrations + seed were validated
against fresh disposable databases (an isolated throwaway Postgres 16 container
and ephemeral `node:sqlite`; the shared dev DB and unrelated containers were
never touched): Postgres `migrate deploy` applied all six migrations with the
expected enum/columns/dropped-`quantity_grams`/partial-unique index; `db:seed`
produced exactly 300 rows, was idempotent, preserved a tampered revision
(immutability), rejected a duplicate `(catalog_key, food_revision)`, and left
null-`catalog_key` custom foods unconstrained; the Postgres preflight guard
aborted atomically with `SLICE_4A_PREFLIGHT_ABORT`; and SQLite 001→002 verified
schema/indexes/partial-unique/`user_version` plus the preflight abort path. The
identity/schema/seed integrity risk (TECHDEBT-004 risk 1) is thereby **resolved**.

**Still open (NOT part of Slice 4A):** the logging write path / meal_items
sync handler that exercises the server-derived snapshot (Slice 4B, TECHDEBT-004
risk 2), and per-food gram-per-serving sourcing for the 192 non-gram foods
(deferred; `grams_per_serving` left null rather than fabricated — TECHDEBT-004
risk 3). TECHDEBT-004 therefore remains **Open** for risks 2 and 3.

### Slice 4B Implementation Note (2026-07-13)

The `meal_items` `EntitySyncHandler` is implemented and registered
(`api/src/modules/nutrition/`), backend only — **no logging UI, no REST write
endpoint, no mobile changes**. Behaviour (all covered by unit + pipeline tests):

- **Server-derived snapshot:** CREATE resolves the referenced immutable Food
  revision and derives the per-serving snapshot via the shared
  `deriveServingSnapshot`; client-supplied names/macros/snapshot values are
  never trusted. Only `serving_count` is mutable (UPDATE); a food change is
  soft-delete + create. DELETE is a soft-delete tombstone.
- **Ownership:** all reads/writes scoped to the authenticated `user_id`; the
  parent `meal` must exist and be owned by the same user (a cross-user or
  deleted parent is rejected).
- **Error semantics (minimal sync-pipeline extension, `SyncApplyError`):** a
  missing parent → retryable **`DEPENDENCY_NOT_READY`** (the op is NOT
  persisted, so a later retry re-processes — never `removeRejected`); an
  unknown/unsupported revision → non-retryable **`CATALOG_REVISION_UNSUPPORTED`**
  (recorded terminally, actionable). Plain errors remain `APPLY_FAILED`.
- **Conflict/privacy:** version conflicts are recorded, never overwritten;
  `redactForConflict` excludes the food-name snapshot (keeps minimal structured
  values); audit uses `NUTRITION_CHANGE` with operational metadata only (no
  names/quantities/dates/PHI).

This resolves TECHDEBT-004 **risk 2**; risk 3 (non-gram gram sourcing) stays
open. TECHDEBT-004 remains **Open** for risk 3 only.

### Slice 4C Implementation Note (2026-07-13)

The mobile food-logging **write path** is implemented
(`mobile/src/features/nutrition/`), consuming the Slice 4B handler — **mobile
only; no logging UI, no route/screen change, no backend, schema, or REST
change**. The logging UI + E2E are deferred to Slice 4D. Behaviour (covered by
unit tests):

- **Local-first, sync-only writes (ADR-0006).** `food-log.repository.logFood`
  get-or-creates the day's `nutrition_logs` + `meals` **locally only** — neither
  has a server handler in 4B, so enqueuing them would be `ENTITY_NOT_SUPPORTED`;
  they are structural local parents. It seeds the referenced canonical `foods`
  row (`INSERT OR IGNORE`, `sync_status='synced'`, never enqueued — the server
  already holds the byte-identical revision) so the `meal_items` FK resolves, then
  inserts the `meal_items` row with its immutable per-serving snapshot and
  enqueues **exactly one** `meal_items` op in the same transaction. Edit
  (`serving_count` only) and soft-delete follow the same enqueue-in-transaction
  discipline; `version` is never bumped locally (baseVersion = last server-acked).
- **Sensitive, minimal payloads.** Every `meal_items` op is `sensitive: true`
  (encrypted at rest in the queue). Payloads carry only the server contract —
  CREATE `{meal_id, food_id, serving_count}`, UPDATE `{serving_count}`, DELETE
  `{}` — never a food name, notes, or other PHI. `serving_count` is the editable
  quantity model; non-gram foods use fractional servings (no fabricated grams).
- **Identity.** The write path works in catalog keys/slugs; the persisted/synced
  identity is the Slice 4A UUIDv5 `food_id` + revision, resolved via a canonical
  lookup service. The local per-serving snapshot is display-only and
  **non-authoritative after reconciliation** (the pull applier upserts server
  state as `synced`).
- **Worker error semantics (mobile side).** `DEPENDENCY_NOT_READY` is treated as
  **retryable** (`markFailed` — kept queued with backoff, never dropped);
  `CATALOG_REVISION_UNSUPPORTED` is surfaced as an **actionable failure**
  (`markActionRequired` parks the op in `CONFLICT` so it stops auto-retrying yet
  stays visible, and the entity row is flagged) — **never silently discarded**,
  satisfying the binding Slice 4A guard #3.
- **Pull compatibility.** `registerNutritionSyncAppliers` registers the
  `meal_items` pull applier at the composition root (`_layout.tsx`, mirroring the
  profile/medical appliers); the applier upserts server rows as `synced` and
  flags version conflicts as action-required. `nutrition_logs`/`meals`/`foods`
  register no applier (no server handler).
- **Deterministic plan untouched.** The write path derives consumed totals from
  the immutable per-serving snapshot (`serving_count × snapshot`); it never reads,
  recomputes, or mutates the read-only iCoach `NutritionPlan`/`MealPlan`. No PHI
  in logs/audit/debug output.

**UI deferred to Slice 4D:** `FoodLogScreen`, add-food form, serving stepper,
`/food-log` route, the food-log store, the meal-plan entry point, and the
food-logging E2E.

TECHDEBT-004 remains **Open** for risk 3 only (per-food non-gram gram sourcing is
still not implemented; Slice 4C logs via fractional servings, no fabrication).

### Slice 4D Implementation Note (2026-07-13)

The food-logging **UI** on top of the merged Slice 4C write path is implemented
(`mobile/src/features/nutrition/`) — **UI + tests + E2E only; no backend,
schema, REST, or write-path change**.

- **Clean layering (ADR-0006, 06_MOBILE).** `FoodLogScreen` + `FoodLogAddForm`
  + `ServingStepper` render state and dispatch actions only; `useFoodLogStore`
  (Zustand) is orchestration-only and delegates ALL persistence to the Slice 4C
  `food-log.repository` and ALL macro math to the `food-log` domain — no SQL or
  business logic in components. Local-first: writes return immediately, the day
  re-reads from SQLite, sync is best-effort and never blocks a write.
- **Deterministic engine untouched (ADR-P006, ADR-0011).** The screen shows the
  read-only iCoach nutrition targets for context; daily totals are DERIVED from
  logged entries (`serving_count × immutable snapshot`) and the
  `NutritionPlan`/`MealPlan` is never recomputed or mutated (asserted by a store
  test). Serving entry is fractional only (ServingStepper 0.25 step) — no
  fabricated grams (TECHDEBT-004 risk 3 stays open).
- **Sync/error UX = the Slice 4C contract, surfaced (05_SECURITY).** Pending and
  retryable `DEPENDENCY_NOT_READY` render as "pending" (never data loss);
  terminal `CATALOG_REVISION_UNSUPPORTED` renders an actionable "Action needed"
  banner/chip (never silently discarded); offline/error are distinct. No food
  name/quantity/PHI/token is logged (store uses the sanitized logger).
- **Navigation.** `/food-log` is session-guarded like the other nutrition
  routes; the entry point is the 15-day meal-plan screen (`open-food-log`).
- **Tests.** RNTL component + store specs cover every state (incl.
  action-required + the no-recompute guarantee); a Maestro flow
  (`.maestro/food-log.yml`, wired into `mobile-e2e.yml` after
  `onboarding-loop.yml`) drives log → totals update → sync-attempt-keeps-entry
  → soft-delete. E2E runs only via the manual, `EXPO_TOKEN`-gated `mobile-e2e`
  workflow (EAS APK) — it cannot run in a plain dev checkout. The
  `CATALOG_REVISION_UNSUPPORTED` E2E surface is deliberately left to the
  component test (forcing it end-to-end needs a server-side bad revision — a
  backend hack — out of scope).

TECHDEBT-004 remains **Open** for risk 3 only; Slice 4D adds no gram sourcing.

### Risk-3 Normalization Note (2026-07-14) — split-risk, part 1 (count-unit foods)

TECHDEBT-004 risk 3 ("per-food non-gram gram sourcing") is **split** because the
192 non-gram foods are two different problems, only one of which can be resolved
without new external data:

- **Part 1 — count-unit foods with an already-authored gram weight (RESOLVED
  here).** 29 `piece` foods were authored with the one-piece gram weight sitting
  in `servingAmount` under a `piece` label — the exact `piece(182)`
  gram/piece conflation ADR-P012 flagged (e.g. `egg_whole = 50 piece / 71 kcal`;
  `apple = 182 piece`). These are corrected **at the authored source**
  (`food-catalog.data.ts`) to `{amount: 1, unit: 'piece', grams: <authored
  weight>}`; **no gram weight is invented** — the value is the weight the catalog
  already carried. Because catalog revisions are IMMUTABLE, each is shipped as a
  **new `food_revision` (2 → a new UUIDv5)**; the revision-1 rows stay FK-valid
  on any server that already seeded them. `CATALOG_VERSION` is bumped **1.0.0 →
  1.1.0**. The canonical artifacts (mobile `.ts` + api `.json`) are regenerated
  from the corrected source (parity test `CANONICAL === buildCanonicalCatalog(
  FOOD_CATALOG)` + cross-package golden ids/hash stay green); a new
  `FOOD_REVISIONS` map holds the per-food revision overrides. The `piece`→
  `1 piece` fix also corrects the meal generator's portion label (macros are
  unchanged — the generator never used `servingAmount` for macro math), e.g. a
  2-serving egg dish now reads `2 piece` instead of `100 piece`.
- **Part 2 — volumetric foods (STILL OPEN, gated).** 158 `cup`/`tbsp`/`tsp`/`ml`
  foods and 5 genuine `slice` counts keep `grams_per_serving = null`. A correct
  gram weight for these needs **per-food authoritative portion/density data**
  (e.g. USDA FoodData Central `foodPortion` gram weights) that **does not exist
  in the repo** — the only provenance is the generic string `USDA FoodData
  Central`. Inventing weights (assuming "1 cup rice ≈ 200 g") is forbidden.

**DATA-SOURCE GATE — recorded as ADR-P013 (Accepted 2026-07-14).** Resolving
part 2 requires adopting an authoritative dataset: import USDA FDC `foodPortion`
household-measure gram weights, matched per food with a recorded `fdcId` +
provenance, each corrected food shipped as a new revision with a
`CATALOG_VERSION` bump — see ADR-P013 for the full strategy. Until sourcing
batches actually land, gram-based entry stays unavailable for volumetric foods
and the log path uses fractional servings.

Seeding stays insert-new-revisions-only and idempotent (300 rows on a fresh DB:
271 rev-1 + 29 rev-2; a second run inserts 0; tampered revisions are not
overwritten). Note: because the seed no-ops on existing ids, a server previously
seeded at 1.0.0 keeps the unchanged foods' `catalog_version` stamp at 1.0.0
while accumulating the 29 new rev-2 rows; the stamp is traceability only (ids,
macros, and snapshots are unaffected, and the server re-derives snapshots on
reconciliation). No production server has been seeded (pre-activation).

### Related Documents

- .ai/01_ARCHITECTURE.md, .ai/04_DATABASE.md, .ai/05_SECURITY.md, .ai/06_MOBILE.md
- .ai/15_DATABASE_SCHEMA_DESIGN.md, .ai/16_SQLITE_SCHEMA_DESIGN.md
- .ai/13_MIGRATION_ROADMAP.md (Phase 15 Slice 4)
- ADR-0005, ADR-0006, ADR-0011, ADR-P001, ADR-P006, ADR-P011
- api/prisma/schema.prisma (Food, NutritionLog, Meal, MealItem, MealType, SyncOperation, SyncConflict, AuditLog)
- api/src/modules/sync/** (sync.service.ts sequential apply; sync.types.ts EntitySyncHandler + redactForConflict + SYNC_ERROR_CODES)
- mobile/src/shared/infrastructure/sync/sync-worker.ts (pushLoop `removeRejected`; per-applier `pullLoop` cursors; encrypted CONFLICT payloads)
- mobile/src/shared/infrastructure/sync/sync-queue.ts (`sensitive` `{__enc}` envelope)
- mobile/src/shared/infrastructure/database/** (SyncedRow rows; `order_index`↔`order`)
- mobile/src/features/nutrition/infrastructure/food-catalog.data.ts (Slice 1–3B bundled catalog; the `piece(182)` count-unit conflation is normalized as of 2026-07-14 — see Risk-3 Normalization Note)
- mobile/src/features/nutrition/domain/catalog-identity.ts (`FOOD_REVISIONS` per-food revision overrides; `normalizeServing`)

---

## ADR-P013 — USDA-FDC `foodPortion` Gram-Weight Sourcing for Volumetric & Slice Catalog Foods (TECHDEBT-004 risk 3, part 2)

Status: **Accepted**
Date: 2026-07-14
Accepted: **2026-07-14 by project owner** (as proposed, unamended)
Owner: Architecture / Data
Supersedes: none. Extends: ADR-P012 (catalog identity, serving normalization, immutable revisions).

> This ADR was drafted as a **documentation-only gate** and **Accepted 2026-07-14
> by the project owner, as proposed** (see **Acceptance Resolution**). Acceptance
> is documentation-only: nothing below has been implemented yet — no FDC data
> import, matching manifest, catalog/schema/seed change, or UI/sync/backend
> change accompanied this acceptance. Implementation of TECHDEBT-004 risk 3
> **part 2** is now **authorized to proceed incrementally** under the rules below;
> until a sourcing batch actually lands, the gated foods keep
> `grams_per_serving = null` (fractional-serving logging only) and the backlog
> item stays OPEN.

### Context

TECHDEBT-004 risk 3 was split (ADR-P012 "Risk-3 Normalization Note"). **Part 1**
is resolved (commit `8897c64`): the 29 count-unit `piece` foods whose authored
`servingAmount` was already a one-piece gram weight were normalized to
`{amount: 1, unit: 'piece', grams: <authored weight>}` as revision-2 records
(`CATALOG_VERSION` 1.1.0) — no fabricated data.

**Part 2 (this ADR) remains blocked on data.** 163 bundled foods still have
`grams_per_serving = null`:

- **158 volumetric:** `cup` (98), `tbsp` (31), `tsp` (6), `ml` (23).
- **5 `slice` counts:** 4 breads (`1 slice`) + `canadian_bacon` (`2 slice`).

Their macros are per canonical serving and correct for **serving-count** logging;
what is missing is a **gram weight per serving**, which needs per-food density /
household-measure data. Repository evidence: the only provenance in the catalog
is the generic string `source.ref = 'USDA FoodData Central'` — there is **no
per-food `fdcId`, no `foodPortion`/`gramWeight`, no density table**. A gram
weight cannot be computed from what is in the repo, and inventing one (e.g.
"1 cup cooked rice ≈ 200 g") is forbidden (ADR-0011 health-data integrity; iCoach
determinism/safety). Hence a formal external data-source decision is required.

### Decision drivers

- **No fabrication.** Every gram weight must trace to an authoritative record.
- **Auditability/reproducibility.** A third party must be able to re-derive each
  value from a recorded identifier + portion.
- **Immutability (ADR-P012).** Adding a gram weight changes a food's data → a new
  revision, never an in-place edit.
- **Minimal blast radius.** Catalog/data + tests only, mirroring part 1.

### Proposed decision

#### 1. Source strategy — USDA FoodData Central `foodPortion`

- Adopt **USDA FDC** (public-domain, U.S. government) as the authoritative source.
  Prefer **SR Legacy** / **Foundation Foods** data types (documented analytical
  values) over Branded/Survey where a choice exists.
- For each catalog food, use the FDC record's **`foodPortion[]`** entries, each of
  which carries a `gramWeight`, an `amount`, a `measureUnit` (or `modifier`, e.g.
  `"1 cup"`, `"1 slice"`, `"1 tbsp"`). The catalog serving's gram weight is the
  `gramWeight` of the matching portion (scaled to the authored `amount`).
- **`ml` (liquids, 23):** FDC portions are mass-based; derive grams from the
  authored millilitres × the food's **density**. Use an FDC portion that pairs a
  volume with a `gramWeight` (e.g. `"1 cup (240 ml)" → gramWeight`) to compute
  g/ml, or an FDC-published density; **never assume 1.0 g/ml** unless the source
  states it (water only).
- Acquire data via the **FDC bulk download / API**, pinned to a **specific FDC
  data release** (record the release date/version) so the mapping is frozen and
  reproducible. No runtime network dependency — values are baked into the bundle
  exactly like the existing catalog.

#### 2. Required per-food identifiers / provenance (schema-additive to the artifact)

Extend the authored `FoodSource` (and the derived canonical/snapshot only if
needed) to record, per sourced food:

- **`fdcId`** (integer) — the exact FDC record used.
- **`fdcDataType`** (e.g. `sr_legacy_food`, `foundation_food`).
- **`fdcReleaseDate`** (the pinned FDC release).
- **`portionRef`** — the chosen `foodPortion` (its `id`/`modifier` + `gramWeight`
  + `amount`/`measureUnit`) and, for `ml`, the derived g/ml.
- Keep the existing human-readable `source.ref`/`note`.

This provenance is additive metadata; it does **not** change catalog identity
(`id = uuidv5(catalog_key:food_revision)` is unaffected by provenance fields).

#### 3. Matching & validation rules

- **Deterministic, reviewed mapping.** Each of the 163 foods is matched to one FDC
  record + one portion by a **human-reviewed manifest** (slug → `fdcId` +
  `portionRef`), not by fuzzy auto-matching at build time. The manifest is the
  auditable artifact.
- **Macro-reconciliation gate (automated).** For each match, compute the FDC
  food's macros scaled to the chosen `gramWeight` and compare to the catalog's
  authored per-serving macros. Require agreement within a **documented tolerance**
  (proposed: calories within `max(15%, 25 kcal)`, mirroring the existing catalog
  integrity tolerance; protein/carbs/fat within a comparable band). A mismatch
  **fails the build** → the match is wrong or the portion is wrong; it must be
  corrected or the food left `null` (still gated), never force-fit.
- **Unit sanity.** The matched portion's unit must be consistent with the catalog
  serving unit (a `cup` food matches a volume portion; a `slice` food matches a
  slice/piece portion). `gramWeight` must be `> 0` and within a plausible range.
- **No partial fabrication.** A food with no acceptable FDC portion stays `null`
  and remains gated — the ADR does not require sourcing *all* 163 at once; it may
  land in reviewed batches (e.g. by unit), each batch its own revision bump.

#### 4. Revision & `CATALOG_VERSION` bump plan

- Each food that gains a gram weight is a **data change → new `food_revision`**
  (its next integer; a new UUIDv5 via the existing `FOOD_REVISIONS` map
  mechanism). Revision-1 rows stay retained/FK-valid.
- **`CATALOG_VERSION`** bumps once per sourcing release (e.g. `1.1.0 → 1.2.0`;
  further batches `1.3.0`, …). The parity test's "every food stamped with the
  current `CATALOG_VERSION`" invariant is preserved (all bundle rows re-stamped).
- Canonical artifacts (mobile `.ts` + api `.json`) regenerated from the corrected
  source via `buildCanonicalCatalog`; content hash + cross-package golden ids
  updated; `normalizeServing` already supports an authored non-gram `grams`
  weight (added in part 1), so no new normalization code is required.

#### 5. Seed / idempotency / immutability implications

- Seeding stays **insert-new-revisions-only** and idempotent: a sourcing release
  adds N new revision rows; a fresh DB seeds the current bundle (still one row per
  food = 300); a re-run inserts 0; tampered existing revisions are never
  overwritten. No seed code change.
- **Version-stamp drift** (as in part 1): a server previously seeded at an older
  `CATALOG_VERSION` keeps unchanged foods' stamp (seed no-ops on existing ids)
  while accumulating the new revisions. This is traceability-only — ids, macros,
  and MealItem snapshots are unaffected, and the server re-derives snapshots on
  reconciliation. No production server has been seeded (pre-activation).
- Immutable historical MealItem snapshots are unaffected: an item logged against
  a `null`-gram revision keeps its snapshot; only *new* logs after a food's new
  revision ships carry the gram weight.

#### 6. Explicitly OUT OF SCOPE until this ADR is Accepted

*(Historical pre-acceptance constraints. The ADR was Accepted 2026-07-14 — the
first bullet's sourcing work is now authorized; see the Acceptance Resolution
for what remains out of scope.)*

- No FDC data download/import, no `fdcId`/portion manifest, no catalog-data edits,
  no `FoodSource`/schema extension, no `CATALOG_VERSION` bump, no artifact
  regeneration.
- No gram-based **entry UI** (the food-log UI change to accept grams is a separate,
  later concern even after data lands).
- No Prisma/SQLite migration, no `meal_items` handler/sync-semantics change, no
  backend/REST change, no Railway/deployment change.
- No change to the 108 gram foods or the 29 part-1 `piece` foods.

### Consequences

- **Positive:** authoritative, auditable gram weights unlock gram-based logging
  and gram-accurate totals for the remaining foods; closes TECHDEBT-004 entirely
  once all batches land.
- **Cost/risk:** per-food FDC matching is manual and error-prone — the
  macro-reconciliation gate + human-reviewed manifest are the mitigations. `ml`
  density handling is the trickiest sub-case. Multiple `CATALOG_VERSION` bumps if
  batched.
- **If rejected / deferred:** status quo holds — those foods log via fractional
  servings; no correctness loss, only missing gram precision.

### Acceptance criteria (what "Accepted" would authorize)

Owner sign-off on: (a) USDA FDC as the source + pinned release, (b) the
provenance fields, (c) the macro-reconciliation tolerance, (d) batching strategy,
(e) the revision/`CATALOG_VERSION` plan. Only then does implementation begin,
incrementally, mirroring part 1's catalog/data-only discipline.

### Acceptance Resolution

**Accepted 2026-07-14 by the project owner, as proposed (unamended).** All five
acceptance-criteria points were approved as written: (a) USDA FDC as the
authoritative source, pinned to a specific FDC data release; (b) the per-food
provenance fields (`fdcId`, `fdcDataType`, `fdcReleaseDate`, `portionRef`, and
the derived g/ml for `ml` liquids); (c) the automated macro-reconciliation gate
with the documented tolerance (calories within `max(15%, 25 kcal)`,
protein/carbs/fat within a comparable band; a mismatch fails the build — never
force-fit); (d) batched sourcing via a human-reviewed slug → `fdcId` + portion
manifest, with any unmatched food left `null` and still gated; (e) a new
immutable `food_revision` per sourced food (via the existing `FOOD_REVISIONS`
mechanism) with one `CATALOG_VERSION` bump per sourcing release.

This acceptance authorizes TECHDEBT-004 risk 3 **part 2** implementation to
**proceed incrementally**; it does **not** itself implement anything. Binding
constraints carried forward from §6:

- **Still out of scope:** gram-based entry UI (a separate, later decision even
  after data lands); any Prisma/SQLite migration, `meal_items` handler or
  sync-semantics change, backend/REST change, or Railway/deployment change; any
  change to the 108 gram foods or the 29 part-1 `piece` foods.
- The backlog item (TECHDEBT-004 risk 3 part 2) stays **OPEN** until sourcing
  batches actually land and are validated; acceptance alone resolves nothing.

### Batch 1 Implementation Note (2026-07-14) — slice foods

The pilot batch (the 5 `slice` foods) is implemented per this ADR. **Catalog/
data + tests only — no schema, migration, UI, sync, backend, or deployment
change.**

- **Pinned source:** `sr_legacy_food_csv_2018-04` (USDA FDC SR Legacy CSV),
  `https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip`,
  6,074,592 bytes, sha256
  `b80817294b8850530aaedf2e515c02593b1824f763a0ff356e5c2081643e6fd0`,
  downloaded 2026-07-14. Public domain.
- **Matched (4), all passing the macro-reconciliation gate:**
  `whole_wheat_bread` → fdc 172688 "Bread, whole-wheat, commercially prepared",
  slice = 32 g (est. 80.6 kcal vs 73 authored); `rye_bread` → fdc 172684
  "Bread, rye", "slice, regular" = 32 g (82.9 vs 81); `ezekiel_bread` → fdc
  171850 "Bread, wheat, sprouted", slice = 38 g (71.4 vs 85); `canadian_bacon`
  → fdc 167869 "Canadian bacon, unprepared", 2 slices = 57 g (62.7 vs 75; the
  alternate 168383 "cooked, pan-fried" FAILED the gate at 40.3 vs 75 and was
  rejected — the gate arbitrated the candidate choice, as designed).
- **Unmatched (1), left null/gated — never force-fit:** `sourdough_bread`. SR
  Legacy's only sourdough-inclusive record (172675 "Bread, french or vienna
  (includes sourdough)") carries a 139 g "slice" portion → scaled estimate
  378.1 kcal vs the authored 97 kcal slice: catastrophic reconciliation
  failure. Revisit in a later batch (possibly a different pinned dataset).
- **Mechanics:** the 4 matched foods gained an authored full-serving `grams`
  (slice counts preserved — `canadian_bacon` stays a 2-slice serving, 57 g
  total), bumped to `food_revision` 2 (new UUIDv5s; rev-1 rows retained),
  `CATALOG_VERSION` → `food-catalog@1.2.0`; canonical artifacts/hash/goldens
  regenerated (a rye rev-2 golden added to both suites).
- **Provenance artifact:** `mobile/.../catalog/fdc-portion-manifest.json`
  (release pin + per-food `fdcId`/`fdcDataType`/`fdcDescription`/portion row/
  `gramWeight`/`fdcPer100g`/`derivedGramsPerServing`/review notes + the
  unmatched list), enforced by the `fdc-portion-manifest.spec.ts` gate: schema/
  provenance completeness, unit compatibility, `0 < gramWeight ≤ 1000`, macro
  reconciliation within the documented tolerance, authored grams ===
  derivation, manifest↔catalog lock, unmatched stay null/gated.
- **Validation:** mobile nutrition 17 suites / 137 tests, api catalog/nutrition
  25 tests, both typechecks + lint, seed preflight/idempotency/immutability sim
  (300 rows, second run inserts 0, 33 rev-2 ids no collision), macros unchanged
  0/300 vs prior release, `git diff --check` clean.


### Batch 2 Implementation Note (2026-07-14) - tablespoon foods

The second batch is implemented per this ADR. **Catalog/data + tests only - no
schema, migration, UI, sync, backend, or deployment change.** It reuses the same
pinned `sr_legacy_food_csv_2018-04` archive and checked-in provenance manifest.

- **Matched (13), all passing the macro-reconciliation gate:** `hummus` (30 g
  per 2 tbsp), `parmesan` (5 g per 1 tbsp), `peanut_butter` (32 g per 2 tbsp),
  `almond_butter` (32 g per 2 tbsp), `sesame_seeds` (18 g per 2 tbsp),
  `hemp_seeds` (20 g per 2 tbsp), `tahini` (30 g per 2 tbsp),
  `cashew_butter` (32 g per 2 tbsp), `sunflower_butter` (32 g per 2 tbsp),
  `flaxseed_oil` (13.6 g per 1 tbsp), `salsa` (36 g per 2 tbsp),
  `balsamic_vinegar` (16 g per 1 tbsp), and `soy_sauce_low_sodium` (14.2 g per
  1 tbsp). Each row has exact FDC id/portion-row/per-100 g macro provenance in
  `fdc-portion-manifest.json`.
- **Unmatched / still gated:** non-reconciling or missing SR Legacy portions
  (`cream_cheese_light`, `chia_seeds`, `flax_seeds`, `poppy_seeds`, several
  oils, `pesto`, `nutritional_yeast`, `tomato_paste`, etc.) remain null. The
  suspicious `tsp(5)`/`tsp(3)`/`tsp(2)` foods (`butter`, `mustard`, `hot_sauce`,
  `garlic`, `ginger`, etc.) are not force-fit because the authored amount likely
  encodes grams rather than teaspoon counts; they require a separate serving-
  semantics correction decision before gram sourcing.
- **Mechanics:** the 13 matched foods gained authored full-serving `grams`,
  bumped to `food_revision` 2 (new UUIDv5s; rev-1 rows retained),
  `CATALOG_VERSION` -> `food-catalog@1.3.0`; canonical artifacts/hash/goldens
  regenerated (a hummus rev-2 golden added to both suites). Macros are unchanged.


### Tsp Serving-Semantics Mini-Slice (2026-07-14) - corrected `tsp(N grams)` foods

Before continuing to the `cup` batch, the six ambiguous `tsp(N)` foods were
resolved because their authored amounts encoded gram weights rather than
teaspoon counts. **Catalog/data + tests only - no schema, migration, UI, sync,
backend, or deployment change.**

- **Corrected to gram servings (no FDC portion row force-fit):** `butter` and
  `ghee` now use `g(5)`. Their authored macros already describe a 5 g serving;
  SR Legacy has butter/ghee analytical records, but no exact ghee teaspoon
  portion row in the pinned archive, so the display semantics were corrected
  without inventing a `tsp` conversion.
- **Corrected to 1 tsp + FDC-sourced grams:** `mustard` (1 tsp = 5 g),
  `hot_sauce` (Tabasco pepper sauce, 1 tsp = 4.7 g), `garlic` (1 tsp = 2.8 g),
  and `ginger` (1 tsp = 2 g). Each row has exact FDC id/portion-row/per-100 g
  macro provenance in `fdc-portion-manifest.json` and passes the same manifest
  gate.
- **Mechanics:** all six foods bumped to `food_revision` 2 (new UUIDv5s; rev-1
  rows retained), `CATALOG_VERSION` -> `food-catalog@1.3.1`; canonical
  artifacts/hash/goldens regenerated (a butter rev-2 golden added to both
  suites). Macros are unchanged.

**Remaining after this mini-slice:** 140 foods (98 `cup` + 18 remaining `tbsp`
+ 23 `ml` + `sourdough_bread`) stayed `grams_per_serving = null`, gated pending
later batches.

### Batch 3A Implementation Note (2026-07-14) - cup grains, legumes, and staples

The first `cup` batch is implemented per this ADR. **Catalog/data + tests only -
no schema, migration, UI, sync, backend, or deployment change.** It reuses the
same pinned `sr_legacy_food_csv_2018-04` archive and checked-in provenance
manifest.

- **Matched (26), all passing the macro-reconciliation gate:** `edamame`,
  `brown_rice`, `white_rice`, `wild_rice`, `quinoa`, `barley`, `bulgur`,
  `buckwheat`, `millet`, `amaranth`, `popcorn_air`, `lentils_brown`,
  `chickpeas`, `black_beans`, `kidney_beans`, `pinto_beans`, `navy_beans`,
  `great_northern_beans`, `lima_beans`, `split_peas`, `green_peas`,
  `black_eyed_peas`, `mung_beans`, `adzuki_beans`, `fava_beans`, and
  `soybeans`. Each row has exact FDC id/portion-row/per-100 g macro provenance
  in `fdc-portion-manifest.json`.
- **Unmatched / still gated:** varietals or preparations without an exact
  reconciling SR Legacy row (`basmati_rice`, `jasmine_rice`, `farro`,
  `sorghum`, `polenta`, `couscous_whole`, `lentils_red`, `lentils_green`,
  `cannellini_beans`) remain null. Generic substitutes were rejected rather than
  force-fit.
- **Mechanics:** the 26 matched foods gained authored full-serving `grams`,
  bumped to `food_revision` 2 (new UUIDv5s; rev-1 rows retained),
  `CATALOG_VERSION` -> `food-catalog@1.4.0`; canonical artifacts/hash/goldens
  regenerated (a `brown_rice` rev-2 golden added to both suites). Macros are
  unchanged.

**Remaining after Batch 3A:** 114 foods (72 remaining `cup` + 18 remaining
`tbsp` + 23 `ml` + `sourdough_bread`) stayed `grams_per_serving = null` — see
Batch 3B below.

### Batch 3B Implementation Note (2026-07-14) — cup vegetables

The second `cup` batch is implemented per this ADR. **Catalog/data + tests only
— no schema, migration, UI, sync, backend, or deployment change.** It reuses
the same pinned `sr_legacy_food_csv_2018-04` archive (sha256 re-verified before
use) and the checked-in provenance manifest.

- **Matched (42 of 47 gated cup vegetables), all passing the
  macro-reconciliation gate** with without-salt (or unsalted-variant) SR
  records: `broccoli`, `spinach`, `kale`, `cauliflower`, `brussels_sprouts`,
  `asparagus`, `green_beans`, `zucchini`, `bell_pepper_red`, `carrots`,
  `tomato`, `cucumber`, `lettuce_romaine`, `cabbage`, `mushrooms`,
  `sweet_potato`, `butternut_squash`, `beets`, `eggplant`, `celery`,
  `bok_choy`, `swiss_chard`, `collard_greens`, `okra`, `snap_peas`, `corn`,
  `pumpkin`, `spaghetti_squash`, `turnip`, `parsnip`, `radish`, `arugula`,
  `watercress`, `fennel`, `kohlrabi`, `acorn_squash`, `bell_pepper_green`,
  `cherry_tomatoes`, `sauerkraut`, `spinach_raw`, `jicama`, `tomatillo`. Each
  row has exact FDC id/portion-row/per-100 g macro provenance in
  `fdc-portion-manifest.json`; every pick was re-verified against the archive
  (description + portion row + nutrients + derivation) before applying.
- **Unmatched / still gated (5), never force-fit:** `onion` and `leeks` (SR
  cooked records fail macro reconciliation), `snow_peas` (catalog food says
  *cooked* but only the RAW edible-podded record reconciles — semantic
  mismatch), `mixed_greens` (no SR record for a mix; single-lettuce analogs
  differ materially, 36–57 g/cup — ambiguous), `broccolini` (no SR record; the
  nearest name match, broccoli raab, is a different vegetable and fails the
  gate catastrophically). Reasons recorded in the manifest's `unmatched` list.
- **Mechanics:** the 42 matched foods gained authored full-serving `grams`
  (2-cup salad servings derive as cup weight × 2), bumped to `food_revision` 2
  (new UUIDv5s; rev-1 rows retained), `CATALOG_VERSION` →
  `food-catalog@1.5.0`; canonical artifacts/hash/goldens regenerated (a
  `broccoli` rev-2 golden added to both suites). Macros are unchanged (0/300).
- **Encoding fix (incidental):** the regenerated canonical `.ts` restores the
  proper em-dash in its GENERATED header comment; a later batch's generator had
  written it as literal `???` (mojibake). Comment-only, no data impact.

**Remaining after Batch 3B:** 72 foods (30 remaining `cup` + 18 remaining
`tbsp` + 23 `ml` + `sourdough_bread`) stayed `grams_per_serving = null` — see
Batch 3C below.

### Batch 3C Implementation Note (2026-07-14) — cup fruits

The third `cup` batch is implemented per this ADR. **Catalog/data + tests only
— no schema, migration, UI, sync, backend, or deployment change.** It reuses
the same pinned `sr_legacy_food_csv_2018-04` archive (sha256 re-verified before
use) and the checked-in provenance manifest.

- **Matched (14 of 16 gated cup fruits), all passing the macro-reconciliation
  gate:** `strawberries`, `blueberries`, `raspberries`, `blackberries`,
  `grapes`, `pineapple`, `mango`, `watermelon`, `cantaloupe`, `cherries`,
  `honeydew`, `papaya`, `guava`, `lychee`. Gate-arbitrated record choices:
  grapes → European/Thompson (the American slip-skin record fails), cherries →
  sweet (sour red fails), guava → common (strawberry guava fails), pineapple →
  the generic all-varieties record (catalog food is generic "Pineapple").
  Portion rule: among passing portions of the chosen record, the closest kcal
  reconciliation. Every pick re-verified against the archive (description +
  portion row + nutrients + derivation) before applying; full provenance in
  `fdc-portion-manifest.json`.
- **Unmatched / still gated (2), never force-fit:** `pomegranate` (the only SR
  cup portion, "0.5 cup arils" → 174 g/cup, passes calories but fails the
  carbs band: 32.5 g est vs 26 authored, delta 6.5 > max(20%, 3 g)) and
  `dragon_fruit` (SR Legacy 2018-04 has no dragon fruit/pitaya record at all).
  Reasons recorded in the manifest's `unmatched` list.
- **Mechanics:** the 14 matched foods gained authored full-serving `grams`,
  bumped to `food_revision` 2 (new UUIDv5s; rev-1 rows retained),
  `CATALOG_VERSION` → `food-catalog@1.6.0`; canonical artifacts/hash/goldens
  regenerated (a `strawberries` rev-2 golden added to both suites). Macros are
  unchanged (0/300).

**Remaining after Batch 3C:** 58 foods (16 remaining `cup` + 18 remaining
`tbsp` + 23 `ml` + `sourdough_bread`) stayed `grams_per_serving = null` — see
Batch 4 below.

### Batch 4 Implementation Note (2026-07-14) — remaining tbsp foods + Batch 2 erratum

The remaining-tablespoon batch is implemented per this ADR. **Catalog/data +
tests only — no schema, migration, UI, sync, backend, or deployment change.**
Same pinned archive (sha256 re-verified) and manifest process.

**Erratum — Batch 2 unmatched verdicts.** All 18 remaining tbsp foods had been
declared unmatched by Batch 2. Re-verification against the archive with
corrected search patterns disproved **8** of those verdicts (Batch 2's search
used name-order patterns like "olive oil" and missed SR Legacy's
`Oil, <name>` / `Cheese, cream, low fat` naming; its tomato-paste
reconciliation-failure claim does not reproduce — likely a missed ×2 serving
scaling). The Batch 2 note above is retained unmodified as history; this note
records the correction, and the 8 wrong `unmatched` manifest entries are
replaced by full provenance entries.

- **Matched (8), all passing the gate:** `olive_oil` → 171413 "Oil, olive,
  salad or cooking" (13.5 g/tbsp; no EVOO-specific SR record — identical
  100 %-fat profile, documented), `avocado_oil` → 173573 (14 g), `canola_oil`
  → 172336 (14 g), `walnut_oil` → 171030 (13.6 g), `sesame_oil` → 171016
  (13.6 g), `coconut_oil` → 171412 (13.6 g), `cream_cheese_light` → 169079
  "Cheese, cream, low fat" (plain tbsp 15 g; chosen over the regular whipped
  portion — closer kcal but a fat-level mismatch), `tomato_paste` → 170459
  no-salt record (2 tbsp = 32 g; est 26.2 vs 28 kcal).
- **Still gated (9), Batch 2 reasons re-verified accurate:** `chia_seeds`
  (record exists, no tbsp portion), `mct_oil` / `tzatziki` (no SR record),
  `pesto` (cup portions only), `nutritional_yeast` (baker's yeast is a source
  mismatch and fails), `flax_seeds` (ground portion fails; whole passes but is
  a preparation mismatch), `poppy_seeds` (fails badly — the authored macros
  look teaspoon-scale; possible future authored-data correction, out of
  scope), `greek_yogurt_dressing` (only unrelated commercial dressings pass —
  semantic mismatch), and `lemon_juice` — reason **corrected**: SR "Lemon
  juice, raw" (167747) EXISTS but has no tbsp portion (only cup/fl-oz/yields);
  deriving tbsp from the fl-oz pairing is the density method reserved for the
  `ml` batch — revisit there.
- **Policy-pending (1), deliberately NOT resolved here:** `apple_cider_vinegar`
  passes the gate trivially (3.1 kcal est vs authored 0), but Batch 2 recorded
  an explicit "zero-macro policy decision" gate; that owner decision is
  surfaced, not overturned.
- **Mechanics:** the 8 matched foods gained authored full-serving `grams`,
  bumped to `food_revision` 2 (new UUIDv5s; rev-1 rows retained),
  `CATALOG_VERSION` → `food-catalog@1.7.0`; canonical artifacts/hash/goldens
  regenerated (an `olive_oil` rev-2 golden added to both suites). Macros
  unchanged (0/300).

**Remaining after Batch 4:** 50 foods (16 `cup` + 10 `tbsp` + 23 `ml` +
`sourdough_bread`) stayed `grams_per_serving = null` — see Batch 5 below.

### Batch 5 Implementation Note (2026-07-14) — ml foods (density method)

The millilitre batch is implemented per this ADR using the **density method**
defined in §1: gram weights derived ONLY from volume-paired SR portion rows —
`density = gramWeight / sourceVolumeMl`, `derivedGramsPerServing = density ×
catalogServingMl` (US customary volumes: cup = 236.588 ml, fl oz = 29.5735 ml,
consistent with SR's own gram weights, e.g. milk 244 g/cup ≈ 1.031 g/ml).
**Never an assumed 1 g/ml.** Each manifest entry carries an explicit
`density: { sourceVolumeMl, gPerMl }` block, enforced by new gate-spec checks
(density present iff `ml` food; gPerMl === gramWeight/sourceVolumeMl;
plausibility band 0.5–1.6 g/ml; derivation to 0.1 g). **Catalog/data + tests
only — no schema, migration, UI, sync, backend, or deployment change.**

- **Matched (11), all gate-passing, densities 1.02–1.11 g/ml from cup
  portions:** `soy_milk_unsweet` → 175215 generic unsweetened soymilk
  (1.0271 → 246.5 g/240 ml), `milk_skim` → 171269 (1.0356 → 248.5 g),
  `milk_1pct` → 170872 (1.0313 → 247.5 g), `milk_2pct` → 171267
  vitamin-fortified for consistency with the other milks (1.0313 → 247.5 g),
  `kefir_plain` → 170904 LIFEWAY (SR's only plain kefir — branded, noted;
  1.0271 → 246.5 g), `almond_milk_unsweet` → 174832 (SR's 262 g/cup gives
  1.1074 — taken as sourced, not adjusted; 265.8 g), `buttermilk_lowfat` →
  170874 (1.0356 → 248.5 g), `tomato_juice_lowsodium` → 170545 no-salt
  (1.0271 → 246.5 g), `orange_juice` → 169098 raw = 100 % (1.0482 → 251.6 g),
  `vegetable_juice_lowsodium` → 167708 exact low-sodium record (1.0229 →
  245.5 g), `coconut_water` → 174831 RTD unsweetened (1.0356 → 248.5 g).
  fl-oz rows cross-check the cup-derived densities where present.
- **Unmatched (8), never force-fit:** `pea_milk_unsweet`, `oat_milk_unsweet`,
  `cashew_milk_unsweet`, `matcha_unsweet`, `kombucha_unsweet` (no SR record —
  categories post-date SR Legacy), `coconut_milk_beverage` (only the SWEETENED
  beverage record exists and fails the gate), `protein_shake_water` /
  `vegan_protein_shake` (prepared composites; only powders exist, fail
  catastrophically).
- **Zero-macro policy class (4), deliberately NOT resolved:** `green_tea`,
  `black_coffee`, `herbal_tea`, `sparkling_water` — authored macros all zero
  with trace-value SR records that pass the gate trivially: the same class as
  `apple_cider_vinegar`, which Batch 2 parked on an explicit owner policy
  decision (and which this batch was instructed to exclude). All four reasons
  name ready SR candidate records so the eventual policy resolution is a
  trivial mini-batch covering all five foods.
- **Mechanics:** the 11 matched foods gained authored full-serving `grams` via
  a new `mlFdc(amount, grams)` helper, bumped to `food_revision` 2 (new
  UUIDv5s; rev-1 rows retained), `CATALOG_VERSION` → `food-catalog@1.8.0`;
  canonical artifacts/hash/goldens regenerated (a `milk_skim` rev-2 golden
  added to both suites). Macros unchanged (0/300).

**Remaining after Batch 5:** 39 foods (16 `cup` + 10 `tbsp` + 12 `ml` +
`sourdough_bread`) — see Batch 6 below.

### Batch 6 Implementation Note (2026-07-14) — zero-macro policy resolution

**Policy decision (owner, 2026-07-14):** zero-macro catalog foods MAY carry
sourced gram weights. Rationale: gram-based entry scales the immutable
zero-macro snapshot, so logged totals stay zero regardless of grams — the
weight adds unit convenience with no correctness risk; provenance requirements
stay unchanged. This resolves the question Batch 2 first recorded for
`apple_cider_vinegar` and Batch 5 extended to four beverages.

All 5 policy-class foods are sourced from the SR candidates pre-recorded in
their unmatched reasons (every pick archive-re-verified by portion row):

- **Density path (4 ml beverages, fl-oz portions, 1.0009 g/ml):** `green_tea`
  → 171917 "tea, green, brewed, regular" (regular over decaf for the generic
  catalog food; the record's 245 g cup row disagrees with its own fl-oz
  density and physical water density, so the fl-oz portion was chosen —
  documented), `black_coffee` → 171890 "coffee, brewed, prepared with tap
  water", `herbal_tea` → 173232 "tea, herb, other than chamomile, brewed",
  `sparkling_water` → 173233 PERRIER (SR's carbonated-water record — branded,
  noted; non-carbonated bottled waters are preparation mismatches, club soda
  carries added sodium). Each derives 240.2 g per 240 ml serving.
- **Standard tbsp path (1):** `apple_cider_vinegar` → 173469 "Vinegar, cider",
  direct 1 tbsp = 14.9 g portion (the data Batch 2 originally identified).
- **Mechanics:** revision 2 for all 5 (new UUIDv5s; rev-1 retained),
  `CATALOG_VERSION` → `food-catalog@1.9.0`; artifacts/hash/goldens regenerated
  (a `green_tea` rev-2 golden added to both suites); the 5 policy `unmatched`
  entries replaced by provenance entries. Macros unchanged (0/300). **Catalog/
  data + tests only — no schema, migration, UI, sync, backend, or deployment
  change.**

**Remaining under this ADR:** 34 foods (16 `cup` + 9 `tbsp` + 8 `ml` +
`sourdough_bread`) stay `grams_per_serving = null` — none matchable under the
pinned SR Legacy archive. Closing them requires a different pinned source
(e.g. FNDDS) via a follow-up source decision, or the poppy-seeds
authored-data correction.

### SR Legacy Sourcing Track — Closure Note (2026-07-14)

The **SR Legacy + zero-macro-policy sourcing track is COMPLETE (exhausted)**
under this ADR's approved source rules. Across Batches 1–6 plus the tsp
semantics mini-slice (`food-catalog@1.2.0` → `1.9.0`), **156 of the 190
non-gram catalog foods carry sourced gram weights** (29 piece + 4 slice + 22
tbsp + 4 tsp + 82 cup + 15 ml), every value traceable to the pinned
`sr_legacy_food_csv_2018-04` archive via the checked-in
`fdc-portion-manifest.json` (127 provenance entries) and enforced by the gate
spec. Nothing was fabricated at any point.

The **34 remaining foods are INTENTIONALLY gated**, each with an
archive-re-verified `unmatched` reason (16 `cup`: 6 grain + 3 legume
varietals, 5 vegetables, 2 fruits; 9 `tbsp`; 8 `ml`; `sourdough_bread`).
No further sourcing is possible without a **separate owner decision**:

- **(a) FNDDS / second-source ADR amendment** — the general unblock for foods
  with no reconciling SR Legacy record (most of the 34, including
  `sourdough_bread`, which FNDDS's dedicated sour-dough record is expected to
  cover; a sourdough-specific source decision is only needed if FNDDS is
  rejected).
- **(b) Poppy-seeds authored-data correction — RESOLVED (correction slice,
  2026-07-14):** the teaspoon-scale hypothesis was proven from the pinned
  archive and the owner authorized the correction; the serving (not the
  macros) was the defect. See the poppy-seeds correction note below.
- **(c) One scoped exception — RESOLVED (Batch 7, 2026-07-14):**
  `food.lemon_juice` was closable under the ALREADY-approved density method
  and the owner authorized the scoped mini-batch; see the Batch 7 note below.

**TECHDEBT-004 risk 3 part 2 therefore remains OPEN (partially resolved):**
the track is closed under current approved sources, but full gram-entry
coverage is still blocked for the remaining gated foods, which log via
fractional servings. ADR-P013 itself remains Accepted and in force — any
future batch under a newly approved source follows the same
manifest/gate/revision discipline.

### Batch 7 Implementation Note (2026-07-14) — lemon_juice density mini-batch

Owner-authorized scoped mini-batch closing gate (c) of the Closure Note.
**Catalog/data + tests only — no schema, migration, UI, sync, backend, or
deployment change; no FNDDS, poppy, or other gated food touched.**

- `food.lemon_juice` (1 tbsp serving) → SR 167747 **"Lemon juice, raw"** —
  exact fresh-preparation match. Density from the cup volume pairing:
  244 g / 236.588 ml = **1.0313 g/ml**, independently cross-checked by the
  record's fl-oz row (30.5 g / 29.5735 ml = the identical 1.0313 g/ml).
  `derivedGramsPerServing = 1.0313 × 14.7868 ml (1 tbsp) = 15.25 g` (exact:
  244/16). Reconciliation: est 3.4 kcal vs authored 4 — passes.
- The manifest density block gains an explicit **`catalogServingMl`** field
  (required for density-derived non-`ml` foods, optional-and-equal-to-
  `servingAmount` for `ml` foods), with gate-spec checks extended accordingly;
  all prior entries untouched.
- Revision 2 (new UUIDv5; rev-1 retained), `CATALOG_VERSION` →
  `food-catalog@1.10.0`; artifacts/hash/goldens regenerated (a `lemon_juice`
  rev-2 golden added to both suites); the corrected unmatched reason replaced
  by full provenance. Macros unchanged (0/300).

### Poppy-Seeds Serving-Semantics Correction Slice (2026-07-14)

Owner-authorized correction slice closing gate (b) of the Closure Note.
**Catalog/data + tests only — no schema, migration, UI, sync, backend, or
deployment change; no FNDDS, sourdough, or other gated food touched.**

- **Proof of the defect (from the pinned archive, not assumed):** SR 171330
  **"Spices, poppy seed"** carries per-100 g kcal 525 / protein 17.99 / carbs
  28.13 / fat 41.56 and two portion rows: 1 tsp = 2.8 g (portionRowId 88449)
  and 1 tbsp = 8.8 g (portionRowId 88450). The authored macros (1/1/1 g,
  17 kcal Atwater) fail the tbsp portion (est 46.2 kcal, Δ29.2 > the 25-kcal
  gate — off ~2.7×) but reconcile cleanly at the tsp portion (est 14.7 kcal,
  Δ2.3; protein 0.50 vs 1; carbs 0.79 vs 1; fat 1.16 vs 1). The authored
  macros were correct for a teaspoon; the authored serving unit was the
  defect.
- **Correction:** serving corrected `tbsp(1)` → `tspFdc(1, 2.8)` — the exact
  pattern of the 1.3.1 tsp semantics mini-slice (mustard/hot_sauce/garlic/
  ginger). **Authored macros unchanged**; no grams invented — the 2.8 g weight
  is the SR tsp portion row.
- Revision 2 (new UUIDv5; rev-1 retained), `CATALOG_VERSION` →
  `food-catalog@1.10.1` (patch bump per the 1.3.1 semantics-correction
  precedent); artifacts/hash/goldens regenerated (a `poppy_seeds` rev-2 golden
  added to both suites); the unmatched reason replaced by full provenance with
  the correction documented in the reviewNote. Macros unchanged (0/300).

**Remaining under this ADR: 28 foods** (15 `cup` + 5 `tbsp` + 8 `ml`),
intentionally gated. Amendment A1 (**Accepted 2026-07-14**) pinned FNDDS
2021-2023; its matching track **F1–F4 is COMPLETE (2026-07-15)** with four
matches (`polenta`, `pesto`, `tzatziki`, `sourdough_bread` — the slice gated
set is now empty); all residues carry FNDDS-verified reasons and are blocked
solely on NON-matching owner decisions (class-4/product-variant correction
slices, the protein-shake composite policy, the mixed_greens proxy, or a
third-source amendment). See the F1–F4 notes and ledgers below.

### Amendment A1 (2026-07-14) — FNDDS Second-Source Gate

Status: **Accepted**
Date: 2026-07-14
Accepted: **2026-07-14 by project owner** (as proposed, unamended; see the
Acceptance resolution at the end of this amendment)
Extends: this ADR (ADR-P013). No new technology; FNDDS is another dataset of
the already-approved USDA FoodData Central source (same publisher, same
public-domain license, same CSV distribution channel) — this amendment gates
the *dataset*, not a stack change.

> This amendment was drafted as a **documentation-only gate** and **Accepted
> 2026-07-14 by the project owner, as proposed**. Acceptance is
> documentation-only: no FNDDS archive has been downloaded, no matching has
> been performed, and no catalog/manifest/artifact/test change has landed.
> Incremental FNDDS batches are now **authorized to proceed** under the rules
> below; until a batch actually lands, the 32 gated foods keep
> `grams_per_serving = null` with fractional-serving logging and TECHDEBT-004
> risk 3 part 2 stays OPEN.

#### Why SR Legacy is exhausted

The SR Legacy sourcing track is CLOSED (Closure Note above): Batches 1–7 plus
two semantics-correction slices sourced **158 of 190** non-gram foods from the
pinned `sr_legacy_food_csv_2018-04` archive. Every one of the **32 remaining
foods** (16 `cup` + 7 `tbsp` + 8 `ml` + `sourdough_bread`) has an
archive-re-verified unmatched reason in `fdc-portion-manifest.json`, falling
into four failure classes SR Legacy cannot resolve:

1. **No SR record at all** (category post-dates SR): pea/oat/cashew milk,
   matcha, kombucha, dragon_fruit, broccolini, mct_oil, tzatziki,
   greek_yogurt_dressing.
2. **Record exists, no usable portion row for the catalog serving**:
   chia_seeds (no tbsp row), pesto (cup rows only), sourdough (only a 139 g
   french/vienna "slice" that fails reconciliation).
3. **Varietal/preparation specificity missing** (generic rows rejected to
   avoid mislabeling): basmati/jasmine rice, farro, sorghum, polenta,
   couscous_whole, lentils_red/green, cannellini_beans, flax_seeds (ground).
4. **All candidates fail macro reconciliation** (possible authored-data
   disagreement): onion, leeks, pomegranate, snow_peas,
   coconut_milk_beverage, protein_shake_water, vegan_protein_shake,
   mixed_greens.

#### Candidate second source

**FNDDS (USDA Food and Nutrient Database for Dietary Studies)** — FDC data
type `survey_fndds_food` — is proposed as the single second source. Rationale:
same publisher/licensing/distribution as SR Legacy; strong coverage of
*prepared, composite, and recent-market* foods (survey foods include prepared
dishes, plant milks, dressings, and sourdough as-eaten), which is exactly
failure classes 1–3; portion rows carry household measures with gram weights,
the same shape our manifest gates already validate. **No other source is
approved by this amendment** — Branded Foods, Foundation Foods, or non-USDA
databases would each need a further amendment.

#### Dataset pinning requirements (acceptance blocker)

Exactly one FNDDS release is pinned before any matching starts, recorded in
the manifest with the same fields as the SR pin and verified before every use:

- `dataset` (e.g. "USDA FoodData Central — FNDDS (CSV)"), `releaseLabel`
  (exact survey cycle, e.g. `surveydownload_csv_<release>`), `archiveUrl`
  (fdc.nal.usda.gov), `archiveSha256`, `archiveBytes`, `downloadedAt`,
  `license` (public domain).
- The pin is chosen at implementation time (newest cycle covering the target
  foods), recorded in the implementation note, and NEVER changed within the
  track; a re-pin is a new amendment.

The manifest `source` block stays the SR pin (existing entries' provenance is
immutable); FNDDS lands as a `secondarySources` array, and each FNDDS-sourced
entry carries a `sourceRef` naming its pin. The manifest gate spec is extended
to validate both. Existing SR entries are byte-untouched.

#### Per-food provenance (same discipline as SR entries)

Every FNDDS-sourced food gets one manifest entry with: `catalogKey`, `fdcId`,
`fdcDataType: "survey_fndds_food"`, `fdcDescription` (verbatim), `sourceRef`,
`portion` (`portionRowId`, `amount`, `modifier`/portion description verbatim,
`gramWeight`), `fdcPer100g` (kcal/protein/carbs/fat), `derivedGramsPerServing`
(= authored grams, exactly), and a human `reviewNote` that **quotes and
supersedes the prior SR unmatched reason**.

#### Matching rules

- Exact food AND preparation semantic match (cooked vs raw, ground vs whole,
  unsweetened vs sweetened, whole-wheat vs refined) — the same standard that
  rejected force-fits in Batches 1–7. Varietal foods (basmati, jasmine, red/
  green lentils, cannellini) match only varietal-specific FNDDS rows; generic
  rows remain rejected.
- **Composite/prepared foods** (pesto, tzatziki, greek_yogurt_dressing,
  protein shakes, mixed_greens): FNDDS survey foods that represent the
  as-consumed dish ARE acceptable — this is FNDDS's purpose — subject to the
  same reconciliation gate. Multi-ingredient recipe assembly by us is NOT
  acceptable (no synthesized foods).
- **Branded rows are out of scope** (data type `branded_food` is not FNDDS
  and not approved).
- Portion selection: prefer the row matching the catalog serving unit;
  cup-row-to-tbsp/tsp conversion and fl-oz/cup density derivation for `ml`
  (and volume-served liquid) foods follow the EXISTING approved rules
  (Batch 5 / Batch 7): density = gramWeight / sourceVolumeMl with US
  customary volumes (cup 236.588 ml, fl oz 29.5735 ml, tbsp 14.7868 ml, tsp
  4.92892 ml), `catalogServingMl` required for non-`ml` volume servings,
  never an assumed 1 g/ml.
- The Batch-4 erratum discipline applies: prior unmatched claims are
  RE-VERIFIED against the FNDDS pin, never trusted from memory or notes.

#### Macro reconciliation rules

Unchanged from ADR-P013: FNDDS per-100 g macros scaled to
`derivedGramsPerServing` must agree with authored per-serving macros within
kcal `max(15%, 25)` and per-macro `max(20%, 3 g)`. The gate arbitrates
candidate rows; no reconciling row → the food STAYS gated with an updated
FNDDS-checked reason. Class-4 foods (onion, leeks, pomegranate, snow_peas,
coconut_milk_beverage, shakes, mixed_greens) are the likely failures here: if
FNDDS also fails, that is evidence of an authored-macro defect and each
becomes a per-food correction-slice decision (poppy precedent) — authored-data
corrections are NOT authorized by this amendment.

#### Superseding prior unmatched reasons

An FNDDS match moves the food from `unmatched` to `entries` exactly as SR
matches did; the prior SR reason is preserved verbatim inside the new entry's
`reviewNote` (auditable history, since the SR reason remains TRUE for the SR
pin). Foods failing under both pins keep ONE unmatched record whose reason
cites both pins.

#### Revision / CATALOG_VERSION / artifact plan

Identical mechanics to Batches 1–7: each sourced food ships as a NEW immutable
revision (rev-1 rows retained; new UUIDv5), batches bump `CATALOG_VERSION` one
MINOR each (first FNDDS batch: `1.11.0`), canonical artifacts + content hash +
mobile/API goldens regenerate per batch under the emitter
identity-check-then-transform discipline, and counts in the canonical/
integrity/manifest gate specs update per batch.

#### Seed / idempotency / immutability impact

None beyond the proven per-batch pattern: the seed remains insert-only (new
revision rows only), idempotent (second run inserts 0), and immutable
(existing rows never updated); each batch's validation includes the seed
simulation, the macros-unchanged-vs-HEAD proof (0/300 — this track sources
gram weights only), `git diff --check`, both test suites, typechecks, and
lint. No schema, migration, sync, or backend behavior change.

#### Proposed batch plan (indicative, not binding)

F1 `cup` varietals/vegetables/fruits (class 3 + class 4 cups) → F2 `tbsp` →
F3 `ml` (density method) → F4 `sourdough_bread` (slice). Foods with no
reconciling FNDDS row stay gated; a residue is EXPECTED (e.g. pea milk or MCT
oil may post-date even the pinned FNDDS cycle) and closing it needs either a
further source amendment or a menu/authored-data decision.

#### Acceptance criteria (what "Accepted" would authorize)

The owner accepts this amendment when satisfied that: (a) FNDDS is approved as
the sole second source, branded/other sources excluded; (b) the pin-before-use
requirement and manifest `secondarySources`/`sourceRef` structure are
approved; (c) the matching rules above — including composite-food eligibility
and the varietal/preparation standard — are approved; (d) the unchanged
reconciliation tolerances are approved; (e) the revision/version/artifact/seed
mechanics (reuse of the Batch 1–7 pattern) are approved; (f) it is understood
that class-4 authored-data corrections and any residue foods remain SEPARATE
owner decisions. Acceptance authorizes incremental FNDDS batches under these
rules; it does NOT itself change any data.

#### Out of scope until Accepted

FNDDS archive download/verification; any matching work; any change to catalog
data, the manifest, canonical artifacts, goldens, tests, schema, migrations,
UI, sync, backend behavior, dependencies, or deployment; any authored-data
correction; any third source.

#### Acceptance resolution (2026-07-14)

The project owner **accepted Amendment A1 as proposed, unamended**, explicitly
approving: (1) FNDDS as the **sole** approved second source for the remaining
ADR-P013 gated foods; (2) the pin-before-use requirements and the
`secondarySources` / `sourceRef` manifest structure; (3) the matching rules,
including composite-food eligibility and the varietal/preparation standard;
(4) the existing macro reconciliation tolerances (unless a later ADR changes
them); (5) reuse of the existing revision, `CATALOG_VERSION`, artifact
regeneration, seed/idempotency, and immutability mechanics; (6) that class-4
authored-data corrections and residue foods remain **separate owner
decisions**. Acceptance authorizes incremental FNDDS batches under these
rules; the "Out of scope until Accepted" list above is now the implementation
backlog, and each batch still requires its own scoped owner authorization to
land, consistent with how Batches 1–7 were executed. **No implementation has
started as of this acceptance.**

#### FNDDS pin record (2026-07-14) — pin batch (owner-authorized)

The owner authorized the **pin batch only** and the FNDDS release is now
pinned per the requirements above (manifest `secondarySources`, SR pin and all
existing entries byte-untouched):

- `sourceRef`: `fndds_survey_food_csv_2024-10-31`
- Dataset: USDA FoodData Central — FNDDS Survey Foods (CSV); survey cycle
  **FNDDS 2021-2023 (WWEIA)** — the newest cycle at pin time.
- `releaseLabel`: `survey_food_csv_2024-10-31`
- URL: `https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_survey_food_csv_2024-10-31.zip`
- SHA-256: `5ccc25ec2777a8982fbb61378a42f415316173eb11e48c9a8ba4cb19f5a4f29c`
- Bytes: 3,325,692 · downloaded 2026-07-14 · public domain (U.S. Government
  work).
- Verification: SHA-256 computed twice (reproducible); archive extracts
  cleanly; exactly 5,432 `survey_fndds_food` records, 22,046 `food_portion`
  rows, plus `food_nutrient`/`measure_unit` tables in the shapes the existing
  gates validate. The manifest gate spec now validates the secondary-source
  pin fields alongside the SR pin.

**Pin-only slice: NO food matching was performed, no manifest entries
reference the FNDDS pin yet, no catalog data / revisions / `CATALOG_VERSION` /
canonical artifacts changed.** Matching batches (F1–F4) each await their own
scoped owner authorization. Per the pinning rules, this pin is never changed
within the track — a re-pin is a new amendment.

#### Batch F1 implementation note (2026-07-15) — cup foods (owner-authorized)

The 16 gated `cup` foods were matched against the pinned FNDDS archive
(SHA-256 re-verified against the pin before use). **Catalog/data +
provenance/tests/docs only — no schema, migration, UI, sync, backend,
dependency, or deployment change; no tbsp/ml/sourdough foods touched.**

- **Matched (1):** `food.polenta` → FNDDS 2708374 **"Cornmeal mush, no added
  fat"** — FNDDS officially codes polenta as cornmeal mush (the record carries
  the additional description "polenta" in `food_attribute.csv`), and the
  no-added-fat variant matches the authored macros. Portion "1 cup, cooked" =
  **240 g**; reconciliation: est 139.2 kcal vs authored 141 (Δ1.8), protein
  2.69 vs 3, carbs 29.93 vs 30, fat 0.67 vs 1 — all pass. First entry carrying
  `sourceRef: fndds_survey_food_csv_2024-10-31`; the manifest gate now
  enforces that entry sourceRefs name a pinned secondary source and carry the
  `survey_fndds_food` data type (SR entries stay sourceRef-free).
- **Unmatched (15), reasons FNDDS-verified in the manifest:**
  - *No FNDDS record at all:* `farro`, `sorghum`.
  - *Generic-only folds (A1 varietal rule — generic rejected):*
    `basmati_rice`/`jasmine_rice` (FNDDS attribute-tags generic "Rice, white"
    as "basmati or jasmine rice" — deliberately not distinguished),
    `couscous_whole` (plain couscous only), `lentils_red`/`lentils_green`
    (generic lentils only), `cannellini_beans` (generic "White beans",
    attribute-tagged "Cannellini").
  - *Reconciliation failures under BOTH pins → class-4 authored-data
    disagreements:* `onion` (est 98.7 kcal vs 64), `snow_peas` (70.4 vs 40),
    `leeks` (149.6 vs 56 — the sole FNDDS record carries added fat),
    `pomegranate` (carbs 32.7 vs 26, same axis as SR), `dragon_fruit` (record
    now EXISTS — 2709234 — but est 122.4 kcal vs authored 56).
  - *Semantic rejections:* `broccolini` (FNDDS codes it to "Broccoli raab,
    cooked", which fails reconciliation and is a different vegetable),
    `mixed_greens` (no mix record; generic "Lettuce, raw" passes NUMERICALLY
    but a single-genus NFS code is not clearly acceptable — accepting that
    proxy is a separate owner decision).
- **Mechanics:** polenta ships as revision 2 (rev-1 retained, new UUIDv5),
  `CATALOG_VERSION` → `food-catalog@1.11.0`, artifacts/hash/goldens
  regenerated under the emitter identity-check discipline (identity verified
  byte-for-byte before the transform). Macros unchanged (0/300).

**Class-4 ledger after F1** (authored-data disagreements needing per-food
correction-slice decisions): `onion`, `snow_peas`, `leeks`, `pomegranate`,
`dragon_fruit` (+ the F3-pending `coconut_milk_beverage`, shakes, and the
`mixed_greens` proxy decision).

#### Batch F2 implementation note (2026-07-15) — tbsp foods (owner-authorized)

The 7 gated `tbsp` foods were matched against the pinned FNDDS archive
(SHA-256 re-verified against the pin before use). **Catalog/data +
provenance/tests/docs only — no schema, migration, UI, sync, backend,
dependency, or deployment change; no cup/ml/sourdough foods, no authored-data
corrections, no proxy decisions.**

- **Matched (2), both as-consumed prepared/composite survey foods (A1
  composite eligibility):**
  - `food.pesto` → FNDDS 2710175 **"Pesto sauce"**, direct "1 tablespoon"
    portion = **16 g**. Reconciliation: est 92.8 kcal vs authored 80 (Δ12.8);
    protein 1.38 vs 1; carbs 0.91 vs 1; fat 9.47 vs 8 (Δ1.47) — all pass.
  - `food.tzatziki` → FNDDS 2705448 **"Tzatziki dip"** (attribute "Greek
    dip"), "1 tablespoon" = 15 g → authored 2-tbsp serving = **30 g**.
    Reconciliation: est 27.3 kcal vs authored 21 (Δ6.3); macros all within
    0.8 g — pass.
- **Unmatched (5), reasons FNDDS-verified in the manifest:** `chia_seeds`
  (record exists, no tbsp portion; cup→tbsp conversion is liquid-only under
  A1 and would fail the kcal gate anyway at Δ25.9), `flax_seeds` (FNDDS record
  is whole-seed; catalog is ground — preparation mismatch persists),
  `mct_oil` (no FNDDS record at all), `nutritional_yeast` (the only yeast
  record is attribute-tagged "brewers yeast" — different product),
  `greek_yogurt_dressing` (the only yogurt-dressing-tagged record is a sweet
  "Fruit dressing" — semantic mismatch).
- **Mechanics:** pesto/tzatziki ship as revision 2 (rev-1 retained, new
  UUIDv5s), `CATALOG_VERSION` → `food-catalog@1.12.0`, artifacts/hash/goldens
  regenerated under the emitter identity-check discipline. Macros unchanged
  (0/300).

**Class-4 ledger is unchanged by F2.** The 5 tbsp residues are all
no-record/no-portion/semantic cases, NOT authored-data disagreements —
closing them needs either a third-source amendment or menu decisions.

#### Batch F3 implementation note (2026-07-15) — ml foods (owner-authorized)

The 8 gated `ml` foods were matched against the pinned FNDDS archive (SHA-256
re-verified before use). **Outcome: ZERO matches — manifest reasons + docs
only; no catalog data, revision, `CATALOG_VERSION`, or canonical-artifact
change.** Nothing force-fit; per the batch instructions, foods needing
product/composite/authored-data decisions were left gated with explicit
reasons:

- **No FNDDS record at all (3):** `pea_milk_unsweet`, `cashew_milk_unsweet`,
  `matcha_unsweet` — no approved source covers them; closing needs a
  third-source amendment or a menu decision.
- **Composite/product-policy cases (2):** `protein_shake_water`,
  `vegan_protein_shake` — FNDDS has only DRY nutritional powder mixes (EAS
  whey/soy powders, 2710731/2710732); no prepared-shake survey food. Defining
  the shake as a powder+water recipe would be a composite-policy decision,
  deliberately not taken in a matching batch.
- **Reconciliation failures on the carbs gate (3), density method applied
  correctly (cup/fl-oz volume pairings, never assumed 1 g/ml):**
  - `oat_milk_unsweet` → FNDDS "Oat milk" (2705412, 1.0313 g/ml): est 13.29 g
    carbs vs authored 9 (Δ4.29 > 3); est protein 1.63 vs authored 3 — the
    authored macros describe a protein-fortified unsweetened product.
    Product-variant/authored-data decision.
  - `coconut_milk_beverage` → FNDDS "Coconut milk" (2705413, 1.0313 g/ml):
    est 76.7 kcal / 7.23 g carbs vs authored 49 / 1 — the sweetened-typical
    NFS beverage. **Failure under BOTH pins → class 4 CONFIRMED.**
  - `kombucha_unsweet` → FNDDS "Tea, kombucha" (2710509, 1.0482 g/ml): est
    10.01 g carbs vs authored 7 (Δ3.01, marginally over the 3 g gate) — the
    NFS record is regular kombucha (~4 g sugar/100 g) vs the authored
    low-sugar variant. Product-variant decision; not force-fit.

**Updated ledgers after F3:**
- *Class-4 / authored-data–product-variant decisions:* `onion`, `snow_peas`,
  `leeks`, `pomegranate`, `dragon_fruit`, **`coconut_milk_beverage`
  (confirmed)**, `oat_milk_unsweet`, `kombucha_unsweet` (+ the
  `mixed_greens` proxy decision).
- *Composite/product-policy decisions:* `protein_shake_water`,
  `vegan_protein_shake`.
- *No-source residue (third-source amendment or menu decision):*
  `pea_milk_unsweet`, `cashew_milk_unsweet`, `matcha_unsweet`, plus the F2
  tbsp residues (`chia_seeds`, `flax_seeds`, `mct_oil`, `nutritional_yeast`,
  `greek_yogurt_dressing`) and the F1 varietal/no-record cup residues.

#### Batch F4 implementation note (2026-07-15) — sourdough_bread (owner-authorized)

`food.sourdough_bread` was matched against the pinned FNDDS archive (SHA-256
re-verified before use). **Catalog/data + provenance/tests/docs only; no
other food touched.**

- **Matched:** `food.sourdough_bread` → FNDDS 2707646 **"Bread, sour dough"**
  (FNDDS spells sourdough as two words — why the original A1 draft grep found
  nothing; the untoasted record matches the catalog food). Portion "1 medium
  or regular slice" = **31 g** — the semantic and numeric match for the
  authored 1-slice serving. Reconciliation: est 84.3 kcal vs authored 97
  (Δ12.7); protein 3.33 vs 4; carbs 16.08 vs 18 (Δ1.92); fat 0.75 vs 1 — all
  pass. The large-slice row (43 g) fails carbs and the small-slice row (24 g)
  fails kcal — not chosen.
- **Mechanics:** revision 2 (rev-1 retained, new UUIDv5), `CATALOG_VERSION` →
  `food-catalog@1.13.0`, artifacts/hash/goldens regenerated under the emitter
  identity-check discipline; the prior SR unmatched reason (139 g
  french/vienna slice failure) is preserved verbatim in the entry's
  reviewNote. Macros unchanged (0/300). **The slice-unit gated set is now
  EMPTY.**

**The Amendment A1 matching track (F1–F4) is COMPLETE.** Four matches total
(polenta, pesto, tzatziki, sourdough_bread); **28 foods remain gated**
(15 `cup` + 5 `tbsp` + 8 `ml`), every one blocked on a NON-matching owner
decision: per-food class-4/product-variant correction slices, the
protein-shake composite policy, the mixed_greens proxy, or a third-source
amendment for the no-record residue. No further matching batch can make
progress under the current pins.

#### Amendment A1 Matching Track — Closure Note (2026-07-15)

The **Amendment A1 / FNDDS matching track is COMPLETE (exhausted)** under the
pinned `fndds_survey_food_csv_2024-10-31` archive. Across the pin batch and
Batches F1–F4 (`food-catalog@1.11.0` → `1.13.0`), 4 of the 32 foods gated at
acceptance were sourced (`polenta`, `pesto`, `tzatziki`, `sourdough_bread`);
combined with the SR Legacy track, **162 of the 190 non-gram catalog foods
carry sourced gram weights** (29 piece + 5 slice + 25 tbsp + 5 tsp + 83 cup +
15 ml). The **28 remaining foods (15 `cup` + 5 `tbsp` + 8 `ml`; the slice set
is empty) are intentionally gated** with reasons verified against BOTH pinned
archives; they log via fractional servings meanwhile.

**TECHDEBT-004 risk 3 part 2 therefore remains OPEN (partially resolved).**
No further sourcing is possible under the two approved pins without a
**separate explicit owner decision**; nothing below is authorized or implied
by this closure note:

- **(a) Class-4 / product-variant correction slices** (per-food
  authored-data decisions; both pins fail reconciliation). Originally eight;
  **`onion`, `snow_peas`, `leeks`, `pomegranate`, and `dragon_fruit`
  RESOLVED by slices 1–5 (2026-07-15, see notes below; pomegranate and
  dragon_fruit via owner-approved Option A authored-macro corrections)**;
  **`coconut_milk_beverage`, `oat_milk_unsweet`, and `kombucha_unsweet`
  RE-CLASSIFIED to gate (d) by owner Option B (2026-07-15, see notes above)**
  — each has correct authored unsweetened/low-sugar data while the pins carry
  only an incompatible (sweetened-typical / regular-NFS) variant, so their
  resolution path is a third-source (not an authored-data correction).
  **Gate (a) is now EMPTY — all eight original class-4 foods resolved
  (3 raw-label renames, 2 Option-A macro corrections, 3 Option-B
  re-classifications).**
- **(b) Protein-shake composite policy** (`protein_shake_water`,
  `vegan_protein_shake`): **RESOLVED by owner Option B (2026-07-15) — both
  RE-CLASSIFIED to gate (d) third-source residue** (authored lean
  powder-in-water values correct; prepared RTD records exist but fail
  reconciliation as fattier meal-replacements, and powder+water recipe
  synthesis is A1-forbidden and was not authorized). **Gate (b) is now
  EMPTY.**
- **(c) Mixed-greens decision** (`mixed_greens`): **RESOLVED by owner
  Option A (2026-07-15) — sourced directly** from the exact-name FNDDS record
  2709792 "Mixed salad greens, raw" (missed in F1), 2 cup = 70 g, macros
  unchanged, revision 2, `food-catalog@1.13.6`. **Gate (c) is now EMPTY**;
  gated count 23 → 22. See the Gate-(c) Decision Note above.
- **(d) Optional third-source amendment** for the no-record/varietal/
  unavailable-variant/composite residue (22 foods): `basmati_rice`,
  `jasmine_rice`, `farro`, `sorghum`, `couscous_whole`, `lentils_red`,
  `lentils_green`, `cannellini_beans`, `broccolini` (varietal folds / no
  acceptable record — cup), `chia_seeds`, `flax_seeds`, `mct_oil`,
  `nutritional_yeast`, `greek_yogurt_dressing` (tbsp), `pea_milk_unsweet`,
  `cashew_milk_unsweet`, `matcha_unsweet`, `coconut_milk_beverage`,
  `oat_milk_unsweet`, `kombucha_unsweet` (ml — re-classified from gate (a) by
  Option B: authored data correct, only an incompatible sweetened-typical /
  regular-NFS variant is pinned), and `protein_shake_water`,
  `vegan_protein_shake` (ml — re-classified from gate (b) by Option B: lean
  powder-in-water composites; no pinned RTD reconciles and recipe synthesis
  is A1-forbidden; each needs a lean whey-/pea-isolate RTD source). Any new
  source (Foundation Foods, branded, or non-USDA) requires its own
  pinned-source amendment. Gate arithmetic at closure: 8 (a) + 2 (b) + 1 (c)
  + 17 (d) = 28 gated foods; after correction slices 1–5 (onion, snow_peas,
  leeks, pomegranate, dragon_fruit), the coconut_milk_beverage +
  oat_milk_unsweet + kombucha_unsweet gate-(a) Option B re-classifications,
  the protein-shake gate-(b) Option B re-classification, and the
  gate-(c) mixed_greens direct FNDDS match (sourced, not re-classified —
  `food-catalog@1.13.6`): 0 (a) + 0 (b) + 0 (c) + 22 (d) = **22 gated**.
  Gates (a), (b), and (c) are all now EMPTY; only the gate-(d) third-source
  residue remains.

ADR-P013 and Amendment A1 remain Accepted and in force — any future slice
under (a)–(d) follows the same manifest/gate/revision discipline.

#### Per-Food Gate Work — Closure Note (2026-07-16)

**Gates (a), (b), and (c) are CLOSED.** All per-food decision work resolvable
under the two pinned sources (SR Legacy `sr_legacy_food_csv_2018-04` + FNDDS
`survey_food_csv_2024-10-31`) is complete:

- **(a) Class-4 / product-variant — 8 foods, all resolved (2026-07-15):**
  onion, snow_peas, leeks (raw-label renames, SR raw cups); pomegranate,
  dragon_fruit (owner Option A authored-macro corrections); and
  coconut_milk_beverage, oat_milk_unsweet, kombucha_unsweet (owner Option B —
  authored data correct, only incompatible sweetened/regular variants pinned;
  re-classified to gate (d)).
- **(b) Composite-policy — 2 foods, resolved (2026-07-15):**
  protein_shake_water, vegan_protein_shake (owner Option B — lean
  powder-in-water composites; prepared RTD records exist but fail
  reconciliation, and powder+water recipe synthesis is A1-forbidden;
  re-classified to gate (d)).
- **(c) Mixed-greens — 1 food, resolved (2026-07-16):** mixed_greens (owner
  Option A — sourced directly from the exact-name FNDDS record 2709792 that
  F1 had missed; `food-catalog@1.13.6`).

**Final gate arithmetic: 0 (a) + 0 (b) + 0 (c) + 22 (d) = 22 gated foods**
(9 `cup` + 5 `tbsp` + 8 `ml` + 0 `slice`); **168 of 190 non-gram catalog
foods are now sourced.**

**The remaining 22 foods are NOT resolvable under the current pinned SR
Legacy and FNDDS sources** — each is a no-record, varietal-fold,
unavailable-variant, or composite case verified against BOTH pins (see the
gate-(d) list above and the per-food unmatched reasons in
`fdc-portion-manifest.json`). No further catalog sourcing is possible without
a NEW pinned source.

**TECHDEBT-004 risk 3 part 2 remains OPEN**, now blocked SOLELY on a future
**third-source amendment decision** (gate (d)) — e.g. USDA Foundation Foods,
Branded Foods, or a non-USDA database, each of which would require its own
pinned-source amendment with the same manifest/gate/revision discipline.
Nothing below authorizes or implies that work. Until it lands, the 22 gated
foods keep `grams_per_serving = null` and log via fractional servings.

#### Gate-(a) Correction Slice 1 (2026-07-15) — food.onion (owner-authorized)

**Root cause proven from both pinned archives before any change** (the
poppy-seeds investigate-then-correct pattern):

- The authored macros (64 kcal / P2 / C14 / F0 / fiber 3 per 1 cup) are
  **RAW-onion chopped-cup values**: SR **170000 "Onions, raw"** (40 kcal /
  9.34 C / 1.1 P / 0.1 F per 100 g; portion row 85855 "cup, chopped" =
  **160 g**) reconciles at **64.0 kcal EXACTLY** (carbs 14.94 vs 14, protein
  1.76 vs 2, fat 0.16 vs 0). FNDDS "Onions, raw" (2709795) independently
  cross-checks: 1 cup = 160 g **identical**, est 60.8 kcal — also passes.
- Both pins' COOKED records fail (SR 170001/170100: 88–92 kcal, 20–21 g
  carbs; FNDDS 2709950: 98.7 kcal, 23.0 g carbs) — the class-4 verdict was
  correct; the **name** was the defect, not the macros.
- **Correction (smallest possible):** renamed **"Onion, cooked" →
  "Onion, raw"**; gram weight sourced from the SR raw cup-chopped row via
  `cupFdc(1, 160)`; **macros unchanged**. Revision 2 (rev-1 retained, new
  UUIDv5), `CATALOG_VERSION` → `food-catalog@1.13.1` (patch bump per the
  semantics-correction precedent), artifacts/hash/goldens regenerated
  (identity-checked emitter), the unmatched record replaced by full SR
  provenance (primary pin — no `sourceRef`). Catalog/data +
  provenance/tests/docs only.

**Remaining after this slice: 27 foods** (14 `cup` + 5 `tbsp` + 8 `ml`),
gated on the decisions above. 163/190 non-gram foods sourced.

#### Gate-(a) Correction Slice 2 (2026-07-15) — food.snow_peas (owner-authorized)

Same defect class and pattern as slice 1, **proven from both pinned archives
before any change**:

- The authored macros (40 kcal / P3 / C7 / F0 / fiber 3 per 1 cup) are
  **RAW snow-pea chopped-cup values**: SR **170010 "Peas, edible-podded,
  raw"** (42 kcal / 7.55 C / 2.8 P / 0.2 F per 100 g; portion row 85890
  "cup, chopped" = **98 g**) reconciles near-exactly (est 41.2 kcal vs 40;
  carbs 7.40 vs 7; protein 2.74 vs 3; fat 0.20 vs 0). FNDDS "Snowpeas, raw"
  (2709806) carries the **identical per-100 g values**; its whole-pod cup
  (65 g ≈ SR "cup, whole" 63 g) reconciles only loosely, confirming the
  chopped cup as the authored basis.
- Both pins' COOKED records fail (SR cooked 160 g cup: 67.2 kcal / 11.3 g
  carbs; FNDDS cooked: 70.4 / 12.5) — the class-4 verdict was correct; the
  **name** was the defect.
- **Correction (smallest possible):** renamed **"Snow peas, cooked" →
  "Snow peas, raw"**; gram weight from the SR raw cup-chopped row via
  `cupFdc(1, 98)`; **macros unchanged**. Revision 2 (rev-1 retained, new
  UUIDv5), `CATALOG_VERSION` → `food-catalog@1.13.2` (patch), artifacts/
  hash/goldens regenerated (identity-checked emitter), unmatched record
  replaced by full SR provenance (primary pin).

**Remaining after this slice: 26 foods** (13 `cup` + 5 `tbsp` + 8 `ml`),
gated on the decisions above. 164/190 non-gram foods sourced.

#### Gate-(a) Correction Slice 3 (2026-07-15) — food.leeks (owner-authorized)

Same defect class and pattern as slices 1–2, **proven from the pinned
archives before any change**. The prior "authored values sit between raw and
cooked" concern dissolved once the RAW record was tested with its actual cup
weight:

- The authored macros (56 kcal / P1 / C13 / F0 / fiber 2 per 1 cup) are
  **RAW-leek cup values**: SR **169246 "Leeks, (bulb and lower
  leaf-portion), raw"** (61 kcal / 14.15 C / 1.5 P / 0.3 F per 100 g;
  portion row 84503 "cup" = **89 g**) reconciles near-exactly (est 54.3 kcal
  vs 56; carbs 12.59 vs 13; protein 1.34 vs 1; fat 0.27 vs 0).
- The SR cooked records fail (32.2 kcal / 7.9 g carbs per cup) and the sole
  FNDDS "Leeks" record carries added fat and fails (149.6 kcal) — the
  class-4 verdict was correct; the **name** was the defect. FNDDS has no
  raw-leek code, so the SR raw record is the single exact-preparation
  source (no FNDDS cross-check exists, unlike slices 1–2).
- **Correction (smallest possible):** renamed **"Leeks, cooked" →
  "Leeks, raw"**; gram weight from the SR raw cup row via `cupFdc(1, 89)`;
  **macros unchanged**. Revision 2 (rev-1 retained, new UUIDv5),
  `CATALOG_VERSION` → `food-catalog@1.13.3` (patch), artifacts/hash/goldens
  regenerated (identity-checked emitter), unmatched record replaced by full
  SR provenance (primary pin).

**Remaining after this slice: 25 foods** (12 `cup` + 5 `tbsp` + 8 `ml`),
gated on the decisions above. 165/190 non-gram foods sourced.

#### Gate-(a) Decision Note (2026-07-15) — food.pomegranate (RESOLVED: Option A)

Status: **Owner chose Option A (2026-07-15); implemented as slice 4 — see the
implementation note below.** Original decision gate as drafted:
Unlike slices 1–3, this is NOT a label defect; the correction requires an
authored-macro change, which is not covered by any existing authorization.

**Evidence (both pins re-verified; they carry IDENTICAL per-100 g values):**
SR 169134 "Pomegranates, raw" / FNDDS 2709267 "Pomegranate, raw" = 83 kcal /
18.7 carbs / 1.67 protein / 1.17 fat / 4.0 fiber per 100 g; SR portion row
84309 "0.5 cup arils" = 87 g → **174 g per cup** (FNDDS cup = 175 g).
Scaled to 174 g: **kcal 144.4 / P 2.91 / C 32.54 / F 2.04 / fiber 6.96** vs
authored **134 / 3 / 26 / 2 / 6**. Protein, fat, and fiber match the 174 g
cup well; **carbs is the sole failing axis** (Δ6.5 > the 5.2 tolerance).

**Root cause: the authored carbs is a NET-carbs figure.** 32.54 total −
6.96 fiber = **25.6 ≈ the authored 26**, while the catalog convention is
TOTAL carbs; the authored kcal (134 = Atwater(3, 26, 2) exactly) inherited
the error. No serving-size reinterpretation can fix it — the authored macros
imply mutually inconsistent gram weights (carbs → 139 g, kcal → 161 g,
protein → 180 g).

**Owner decision required — choose one:**

- **(A) RECOMMENDED — approve the authored-macro correction** to the
  source-scaled 1-cup (174 g) values under the catalog's integer rounding:
  **kcal 134 → 144 (+10), protein 3 → 3, carbs 26 → 33 (+7), fat 2 → 2,
  fiber 6 → 7 (+1)**, with the gram weight sourced from SR row 84309
  (174 g/cup) and full provenance. Reconciliation then passes by
  construction (est 144.4 / 32.5 / 2.91 / 2.04). Mechanics would follow the
  standard slice pattern: revision 2 (rev-1 retained — historical logs keep
  their 134-kcal snapshots), patch `CATALOG_VERSION` bump,
  artifacts/goldens, manifest provenance. Downstream effect: future 1-cup
  pomegranate logs record +10 kcal / +7 g carbs / +1 g fiber (~7% kcal
  increase for this food); generated meal plans using it recalc marginally.
- **(B) Keep the authored values** (treat 26 g as an intentional net-carbs
  presentation): the food stays gated forever under the total-carbs
  reconciliation gate; logging continues via fractional servings.
- **(C) Reject both** and leave gated pending a future decision.

Until a decision is recorded here, `food.pomegranate` remains gated and
counted under gate (a).

#### Gate-(a) Slice 4 Implementation Note (2026-07-15) — food.pomegranate (Option A applied)

The owner **chose Option A** and the correction is implemented — the first
authored-MACRO change in the catalog's history (slices 1–3 changed only
labels/serving weights):

- **Applied:** carbs 26 → **33** (total-carbs convention), fiber 6 → **7**,
  protein/fat unchanged; serving sourced via `cupFdc(1, 174)` from SR 169134
  row 84309 ("0.5 cup arils" = 87 g → 174 g/cup; FNDDS 2709267 cross-checks
  at 175 g with identical per-100 g values).
- **Deviation from the draft, documented:** the draft stated kcal 134 → 144
  (the measured source value), but every catalog kcal is derived as
  `Math.round(4P + 4C + 9F)` (Atwater) — no explicit-kcal field exists in the
  authored shape. Under Option A's macros the derived kcal is **162**
  (134 → 162). Introducing an explicit-kcal override for one food would be a
  catalog-shape change outside this slice's scope. Reconciliation still
  passes (|est 144.4 − 162| = 17.6 ≤ 25); the Atwater-vs-measured gap is the
  same fiber-driven divergence every catalog food carries. If the owner
  prefers measured-kcal semantics, that is a separate catalog-wide
  convention decision.
- **Mechanics:** revision 2 (rev-1 retained — historical logs keep the old
  134/26/6 snapshots), `CATALOG_VERSION` → `food-catalog@1.13.4` (patch),
  artifacts/hash/goldens regenerated (identity-checked emitter), the
  unmatched record replaced by full SR provenance citing this decision.
- **Downstream:** future 1-cup pomegranate logs record 162 kcal / 33 g
  carbs / 7 g fiber (+28 kcal / +7 g carbs / +1 g fiber vs rev 1); generated
  meal plans using pomegranate recalc accordingly.

**Remaining after this slice: 24 foods** (11 `cup` + 5 `tbsp` + 8 `ml`),
gated on the decisions above. 166/190 non-gram foods sourced.

#### Gate-(a) Decision Note (2026-07-15) — food.dragon_fruit (RESOLVED: Option A)

Status: **Owner chose Option A (2026-07-15); implemented as slice 5 — see the
implementation note below.** Original decision gate as drafted:
Tested the pomegranate net-carbs hypothesis: it does NOT apply here. The
defect is a serving-scale/source ambiguity.

**Evidence (SR has no dragon-fruit record — re-confirmed; FNDDS 2709234
"Dragon fruit", attribute "pitaya", is the only pinned source):** per 100 g:
68 kcal / 16.24 carbs / 0.68 protein / 0.21 fat / 1.8 fiber; portions
"1 fruit" = 75 g, "1 cup" = 180 g. Authored: 1 cup, kcal 56 (= Atwater of
P1/C13/F0), fiber 3.

- *Net-carbs test:* at the 180 g cup, net carbs = 26.0 g ≠ authored 13 —
  NOT the pomegranate pattern.
- *Serving-scale test:* authored carbs and kcal cohere at an implied ~80 g
  portion (C → 80.0 g, kcal → 82.4 g) ≈ the FNDDS **"1 fruit" = 75 g** row,
  where reconciliation PASSES every gate (est 51.0 kcal vs 56; carbs 12.18
  vs 13; protein 0.51 vs 1; fat 0.16 vs 0).
- *But* the authored fiber (3 g) fits FNDDS at NO scale (1.35 g at 75 g /
  1.8 g at 100 g) — it matches the commercial pitaya label convention
  (~3 g/100 g), so the authored macros likely came from a non-pinned label
  source. And at 100 g of FNDDS, carbs fails (16.24 vs 13, Δ3.24 > 3).
- The serving label "1 cup" (= 180 g) is wrong under every reading — the
  authored macros describe roughly ONE FRUIT, not a cup.

**Owner decision required — choose one:**

- **(A) RECOMMENDED — keep the 1-cup serving, adopt FNDDS-sourced cup
  macros** (authored-macro change): serving `cupFdc(1, 180)` from FNDDS row
  306141; **protein 1 (unchanged), carbs 13 → 29, fat 0 (unchanged), fiber
  3 (unchanged — FNDDS cup-scale fiber is 3.24), kcal 56 → 120
  (ATWATER-DERIVED: 4·1 + 4·29 + 9·0 — stated per the catalog convention,
  not the measured 122.4)**. Post-correction reconciliation passes (est
  122.4 vs 120, Δ2.4; carbs 29.23 vs 29). Every authored value including
  fiber becomes pinned-source-consistent. Downstream: future 1-cup logs
  +64 kcal / +16 g carbs vs rev 1 — large, but honest for a 180 g cup.
- **(B) Re-scope the serving to one fruit, keep the macros**
  (serving-semantics change): `piece1(75)` from FNDDS row 306139
  ("1 fruit" = 75 g); macros/kcal unchanged (56 / P1 / C13 / F0 / fiber 3);
  reconciliation passes at 75 g. Preserves the numbers users see, but the
  serving changes from "1 cup" to "1 piece", and the authored fiber 3
  remains ~2.2× the pinned source's 1.35 g at that serving (unsupported by
  any approved source).
- **(C) Keep as-is** — stays gated; fractional-serving logging continues.
- **(D) Defer.**

Until a decision is recorded here, `food.dragon_fruit` remains gated and
counted under gate (a).

#### Gate-(a) Slice 5 Implementation Note (2026-07-15) — food.dragon_fruit (Option A applied)

The owner **chose Option A** and it is implemented exactly as drafted (the
kcal was stated Atwater-derived in the draft this time — no deviation):

- **Applied:** serving kept at 1 cup, sourced via `cupFdc(1, 180)` from
  FNDDS 2709234 row 306141 ("1 cup" = 180 g); carbs 13 → **29** (cup-scaled
  29.23); protein 1, fat 0, fiber 3 unchanged (FNDDS cup-scale fiber 3.24 —
  the authored fiber is now pinned-source-consistent); kcal Atwater-derives
  56 → **120**. Post-correction reconciliation: est 122.4 kcal vs 120
  (Δ2.4); carbs 29.23 vs 29; protein 1.22 vs 1; fat 0.38 vs 0 — passes.
- **Mechanics:** revision 2 (rev-1 retained — historical logs keep the old
  56/13 snapshots), `CATALOG_VERSION` → `food-catalog@1.13.5` (patch),
  artifacts/hash/goldens regenerated (identity-checked emitter), the
  unmatched record replaced by full FNDDS provenance
  (`sourceRef: fndds_survey_food_csv_2024-10-31`) citing this decision.
- **Downstream:** future 1-cup dragon-fruit logs record 120 kcal / 29 g
  carbs (+64 kcal / +16 g carbs vs rev 1) — the largest correction in the
  gate-(a) track, reflecting what a 180 g cup actually contains; generated
  meal plans using it recalc accordingly.

**Remaining after this slice: 23 foods** (10 `cup` + 5 `tbsp` + 8 `ml`),
gated on the decisions above. 167/190 non-gram foods sourced.

#### Gate-(a) Decision Note (2026-07-15) — food.coconut_milk_beverage (RESOLVED: Option B)

Status: **Owner chose Option B (2026-07-15) — the authored unsweetened
values are KEPT unchanged and the food is RE-CLASSIFIED from gate (a) to
gate (d) third-source residue. Docs/ledger only; no catalog data, revision,
`CATALOG_VERSION`, artifact, or manifest change. `grams_per_serving` stays
null (gated) pending an unsweetened-product source under a future
third-source amendment.** Original investigation:

Unlike pomegranate and dragon_fruit, the investigation shows the AUTHORED
DATA IS CORRECT for the named product — the pinned sources are what
mismatch.

**Evidence (both pins re-verified):** FNDDS 2705413 "Coconut milk"
(plant-milk beverage category) carries per-100 g values IDENTICAL to SR
174116 "Beverages, coconut milk, **sweetened**, fortified with calcium,
vitamins A, B12, D2": 31 kcal / 2.92 carbs / 0.21 protein / 2.08 fat /
**2.5 g sugar**. Both pins cover ONLY the sweetened-fortified variant.
Scaled to the authored 240 ml serving (cup 244 g → 1.0313 g/ml → 247.5 g):
est 76.7 kcal / 7.23 C / 0.52 P / 5.15 F / 6.19 sugar vs authored 49
(Atwater of P0/C1/F5) / 1 / 0 / 5.

- **Fat matches (5.15 vs 5)** — fat content is variant-independent.
- **Carbs minus sugar = 7.23 − 6.19 = 1.04 ≈ the authored 1 g** — the
  entire carbs gap is the record's added sugar; the kcal gap (27.7) matches
  the sugar's caloric contribution (~24.8) plus rounding.
- The authored values match real unsweetened coconut-milk beverages (e.g.
  ~45–50 kcal / 1 g carb / 5 g fat per cup). The authored data describes
  the named product correctly; no approved source covers it.

**Owner decision required — choose one:**

- **(A) Adopt the pinned sweetened-variant values** (authored-macro + name
  change): rename to "Coconut milk beverage" (dropping "unsweetened"),
  serving `mlFdc(240, 247.5)` (density 1.0313 g/ml from the FNDDS cup row),
  protein 0 → 1 (rounded 0.52), carbs 1 → 7, fat 5 unchanged, **kcal
  Atwater-derives 49 → 77**. Deltas per 240 ml logged: +28 kcal / +6 g
  carbs / +1 g protein. Mechanics: revision 2, `CATALOG_VERSION` →
  `food-catalog@1.13.6` (patch), artifacts/goldens, manifest provenance.
  NOT RECOMMENDED: it silently converts a deliberately-unsweetened catalog
  food into the sweetened-typical product, changing its dietary character.
- **(B) RECOMMENDED — keep the authored unsweetened values and re-classify
  the gate:** the food keeps its correct data and stays gram-gated (no
  approved source), and moves from gate (a) "authored-data correction" to
  gate (d) "third-source residue" — its true resolution path is an
  unsweetened-product source (e.g. Foundation Foods or a branded record)
  under a future third-source amendment. Docs-only ledger change; gated
  count unchanged (a: 3 → 2, d: 17 → 18, total still 23).
- **(C) Defer** — stays in gate (a) as-is.

Until a decision is recorded here, `food.coconut_milk_beverage` remains
gated and counted under gate (a).

#### Gate-(a) Decision Note (2026-07-15) — food.oat_milk_unsweet (RESOLVED: Option B)

Status: **Owner chose Option B (2026-07-15) — the authored unsweetened/
higher-protein values are KEPT unchanged and the food is RE-CLASSIFIED from
gate (a) to gate (d) third-source residue. Docs/ledger only; no catalog
data, revision, `CATALOG_VERSION`, artifact, or manifest change.
`grams_per_serving` stays null (gated) pending an unsweetened/fortified
oat-milk source under a future third-source amendment.** Original
investigation:

Same shape as coconut_milk_beverage (authored data describes a real product
the pins don't carry), with an EXTRA divergence that reinforces it.

**Evidence (both pins re-verified):** SR Legacy has NO oat-milk record.
FNDDS 2705412 "Oat milk" is the sole pinned source — a single NFS
(not-specified-as-to-sweetening) record: per 100 g 45 kcal / 5.37 carbs /
0.66 protein / 2.33 fat / **2.04 g sugar** / 0.5 fiber; cup = 244 g →
density 1.0313 g/ml → 247.5 g per the authored 240 ml serving. Scaled to
247.5 g: est **111.4 kcal / 13.29 C / 1.63 P / 5.77 F / 5.05 sugar** vs
authored **93 (Atwater of P3/C9/F5) / 9 / 3 / 5**.

- **Carbs fail the gate** (13.29 vs 9, Δ4.29 > 3) — but carbs minus the
  record's sugar = 13.29 − 5.05 = **8.24 ≈ authored 9**, so the carbs gap is
  the record's added sugar (the same unsweetened-vs-sweetened signature as
  coconut_milk_beverage). Fat matches (5.77 vs 5).
- **Protein diverges the OTHER way** (est 1.63 vs authored 3): sweetening
  cannot lower protein, so the authored product is a genuinely different,
  higher-protein formulation than the FNDDS generic blend. This is a
  stronger "different product" signal than coconut milk had — the authored
  3 g protein matches real unsweetened/fortified oat-milk SKUs (e.g. Planet
  Oat / Oatly Original ≈ 2–4 g/cup), which the single NFS survey record
  does not represent.

Conclusion: **product-variant issue — the authored unsweetened profile is
defensible and the sole pinned record is an incompatible (sweetened-typical,
lower-protein) variant.** Not a net-carbs convention error, not a
serving-scale error.

**Owner decision required — choose one:**

- **(A) Adopt the pinned FNDDS values** (authored-macro change): serving
  `mlFdc(240, 247.5)` (density 1.0313 g/ml from the FNDDS cup row), protein
  3 → 2 (1.63), carbs 9 → 13 (13.29), fat 5 → 6 (5.77), fiber none → 1
  (1.24), **kcal Atwater-derives 93 → 114**. Deltas per 240 ml: +21 kcal /
  +4 g carbs / −1 g protein / +1 g fat / +1 g fiber. Mechanics: revision 2,
  `CATALOG_VERSION` → next patch, artifacts/goldens, manifest provenance.
  NOT RECOMMENDED: it converts a deliberately-unsweetened, higher-protein
  catalog food into the sweetened-typical NFS blend AND lowers its protein —
  changing the product's dietary character away from what the name states.
- **(B) RECOMMENDED — keep the authored unsweetened values and re-classify
  the gate:** the food keeps its correct data and stays gram-gated (no
  approved source), moving from gate (a) "authored-data correction" to gate
  (d) "third-source residue"; its resolution path is an
  unsweetened/fortified oat-milk source (Foundation Foods or a branded
  record) under a future third-source amendment. Docs-only ledger change;
  gated count unchanged (a: 2 → 1, d: 18 → 19, total still 23). Mirrors the
  coconut_milk_beverage Option B outcome.
- **(C) Defer** — stays in gate (a) as-is.

Until a decision is recorded here, `food.oat_milk_unsweet` remains gated and
counted under gate (a).

#### Gate-(a) Decision Note (2026-07-15) — food.kombucha_unsweet (RESOLVED: Option B)

Status: **Owner chose Option B (2026-07-15) — the authored low-sugar values
are KEPT unchanged and the food is RE-CLASSIFIED from gate (a) to gate (d)
third-source residue. Docs/ledger only; no catalog data, revision,
`CATALOG_VERSION`, artifact, or manifest change. `grams_per_serving` stays
null (gated) pending a low-sugar-specific kombucha source under a future
third-source amendment. This EMPTIES gate (a) — all eight original class-4
foods are now resolved.** Original investigation:

Same product-variant shape as coconut_milk_beverage and oat_milk_unsweet:
the authored low-sugar profile is defensible; the sole pinned record is an
incompatible higher-sugar variant. This is the LAST class-4 candidate.

**Evidence (both pins re-verified):** SR Legacy has NO kombucha record.
FNDDS 2710509 "Tea, kombucha" is the sole pinned source — an NFS
(not-specified) regular kombucha: per 100 g 16 kcal / 3.98 carbs (essentially
all sugar: 3.99 g) / 0.1 protein / 0.01 fat / 0 fiber; fl-oz row = 31 g →
density 1.0482 g/ml (12-fl-oz row 372 g cross-checks identically) → 251.6 g
per the authored 240 ml serving. Scaled to 251.6 g: est **40.3 kcal /
10.01 C / 0.25 P / 0.03 F / 10.04 sugar** vs authored **28 (Atwater of
P0/C7/F0) / 7 / 0 / 0**.

- **Carbs fail the gate** (10.01 vs 7, Δ3.01 — over the 3 g floor by 0.01;
  kcal passes on its own at Δ12.3). Kombucha carbs are essentially all
  sugar, so the gap is a pure sugar-content difference: the authored food is
  ~2.9 g sugar/100 g (low-sugar) vs the FNDDS NFS record's 3.99 g/100 g
  (regular). Real kombucha sugar varies widely by product (regular
  ~4–8 g/100 g, low/reduced-sugar ~1–3 g/100 g), so the authored low-sugar
  profile is a defensible real product the survey NFS record does not
  represent.
- Not a net-carbs error (no fiber; carbs are all sugar). Not a clean
  serving-scale fix either (the FNDDS record would only reconcile at an
  arbitrary ~168 ml, not a standard beverage serving).

Conclusion: **product-variant issue — the authored low-sugar profile is
defensible and the sole pinned record is the incompatible regular/NFS
variant.**

**Owner decision required — choose one:**

- **(A) Adopt the pinned FNDDS NFS values** (authored-macro change): serving
  `mlFdc(240, 251.6)` (density 1.0482 g/ml from the FNDDS fl-oz row), protein
  0 (unchanged), carbs 7 → 10 (10.01), fat 0 (unchanged), **kcal
  Atwater-derives 28 → 40**. Deltas per 240 ml: +12 kcal / +3 g carbs.
  Mechanics: revision 2, `CATALOG_VERSION` → next patch, artifacts/goldens,
  manifest provenance. NOT RECOMMENDED: it converts a deliberately low-sugar
  catalog food into the regular/NFS higher-sugar product — changing the
  food's dietary character away from what the name states.
- **(B) RECOMMENDED — keep the authored low-sugar values and re-classify the
  gate:** the food keeps its correct data and stays gram-gated (no approved
  source), moving from gate (a) "authored-data correction" to gate (d)
  "third-source residue"; its resolution path is a low-sugar-specific
  kombucha source (Foundation Foods or a branded record) under a future
  third-source amendment. Docs-only ledger change; gated count unchanged
  (a: 1 → 0, d: 19 → 20, total still 23). **Empties gate (a)** — mirrors the
  coconut_milk_beverage and oat_milk_unsweet Option B outcomes and completes
  the gate-(a) track.
- **(C) Defer** — stays in gate (a) as-is.

Until a decision is recorded here, `food.kombucha_unsweet` remains gated and
counted under gate (a).

#### Gate-(b) Decision Note (2026-07-15) — protein shakes (RESOLVED: Option B)

Status: **Owner chose Option B (2026-07-15) — the authored lean
powder-in-water values are KEPT unchanged and BOTH protein-shake foods are
RE-CLASSIFIED from gate (b) to gate (d) third-source residue. Docs/ledger
only; no catalog data, revision, `CATALOG_VERSION`, artifact, or manifest
change. `grams_per_serving` stays null (gated) pending a lean
whey-isolate / pea-protein-isolate RTD record from a future third-source
amendment. This EMPTIES gate (b). No powder+water recipe convention was
authorized.** Original investigation:

Covers both gate-(b) foods: `food.protein_shake_water` ("Whey protein shake
(water)", 300 ml, P25/C3/F2, Atwater 130 kcal) and `food.vegan_protein_shake`
("Plant protein shake (water)", 300 ml, P24/C4/F2, Atwater 130 kcal). Both
are the same policy question.

**Correction to the prior gated reason.** The Batch F3 manifest reason said
FNDDS "has only DRY nutritional powder mixes; no prepared-shake survey food
exists." **That is inaccurate** — this re-verification found FNDDS category
7208 carries many prepared ready-to-drink (RTD) shake records (Boost, Ensure,
Carnation Instant Breakfast, Muscle Milk, Slim Fast incl. a HIGH-PROTEIN RTD
2710724, Glucerna). A1's composite-eligibility rule already permits matching
an as-consumed RTD record if it reconciles — so the true blocker is not
"no prepared record" but "no prepared record reconciles." (The manifest
reason should be corrected to this when an option below is implemented; not
touched in this docs-only slice.)

**Evidence (both pins re-verified):**

- **Prepared RTD records exist but FAIL reconciliation** against the lean
  powder-in-water authored profile — they are sweetened/fattier
  meal-replacement composites. Best protein-forward candidates at the
  authored 300 ml: *Slim Fast high-protein RTD* (2710724) → est 192 kcal /
  P20.7 / C2.7 / **F10.6** vs authored 130/25/3/2 (fails kcal + fat);
  *Muscle Milk RTD* (2710720) → est 169 kcal / P19.1 / C7.4 / F7.0 (fails
  kcal, P, C, F). All RTD records carry far more fat/calories than a lean
  isolate-in-water shake.
- **Powder records exist but are the DRY ingredient** (EAS Whey Powder
  2710731 = 66.67 g protein/100 g, "1 scoop" = 19.5 g; EAS Soy Powder
  2710732). Matching a 300 ml *prepared beverage* to a dry-powder record
  requires assembling powder + water at a chosen scoop count — **recipe
  synthesis, which A1 explicitly forbids** ("Multi-ingredient recipe
  assembly by us is NOT acceptable"). Even if allowed, 37.5 g EAS whey in
  water yields C6.7 vs authored 3 — the authored lean-isolate profile does
  not match the EAS blend either.

Conclusion: **composite-policy issue — the authored "protein powder + water"
foods are lean isolate-in-water composites the catalog authored from
product-style data; no pinned record represents that exact preparation (RTD
records are fattier meal-replacements; powder records are the dry
ingredient).**

**Owner decision required — choose one:**

- **(A) Allow prepared-RTD composite matching (already A1-eligible) — but no
  pinned RTD reconciles.** Tested: every category-7208 RTD candidate fails
  the gate on fat and/or calories (see above). So Option A sources NOTHING
  under the current pin; both foods stay gated. Recorded here so the
  "did we check prepared records?" question is closed. Not implementable now.
- **(B) RECOMMENDED — keep the authored lean powder-in-water values and
  re-classify both foods from gate (b) to gate (d) third-source residue.**
  Their resolution path is a lean whey-isolate / pea-protein-isolate RTD
  record from a future approved source (Foundation Foods or branded).
  Docs-only ledger change; **empties gate (b)**; gated count unchanged
  (b: 2 → 0, d: 20 → 22, total still 23). No macro/serving/gram/revision/
  version change; grams stay null. Mirrors the milk-family Option B outcome.
- **(C) Authorize a powder + water recipe convention** — an explicit
  exception to A1's no-recipe-synthesis rule, letting us assemble
  grams/macros from a pinned powder record + water. NOT RECOMMENDED: it is a
  broad policy change, and even the EAS powder does not cleanly reconcile to
  the authored lean-isolate macros (carbs 6.7 vs 3), so it would also require
  an authored-macro change.
- **(D) Defer** — both stay in gate (b) as-is.

**Impact if Option B is later accepted:** foods `protein_shake_water` and
`vegan_protein_shake`; serving unchanged (`ml(300)`); `grams_per_serving`
stays null; NO macro deltas; NO new revisions and NO `CATALOG_VERSION` bump
(docs/ledger only); gated count stays 23 (moves b→d). Gate (b) becomes empty.

Until a decision is recorded here, both protein-shake foods remain gated and
counted under gate (b).

#### Gate-(c) Decision Note (2026-07-15) — food.mixed_greens (RESOLVED: Option A)

Status: **Owner chose Option A (2026-07-15) — mixed_greens sourced directly
from the exact-name FNDDS record 2709792 "Mixed salad greens, raw" as a
normal A1 match (no proxy). Serving kept at 2 cup, `cupFdc(2, 70)` (35 g/cup
× 2); macros UNCHANGED; new immutable revision 2; `CATALOG_VERSION` →
`food-catalog@1.13.6`; artifacts/hash/goldens regenerated; the inaccurate F1
unmatched reason replaced with full FNDDS provenance. Gated count 23 → 22;
gate (c) is now EMPTY.** Original investigation:

The investigation OVERTURNS the premise of this gate: a direct exact-name
FNDDS record exists, so no lettuce-NFS proxy or A1 exception is needed.

**Correction to the F1 finding.** The Batch F1 manifest reason said "No SR
Legacy record exists for a salad-greens mix … FNDDS has no mixed/spring-mix
record either; generic 'Lettuce, raw' passes numerically but is single-genus,
not a greens mix." **That is inaccurate** — FNDDS carries **2709792 "Mixed
salad greens, raw"** (WWEIA category 6410), an exact-name match for the
catalog's "Mixed salad greens." F1's search missed it. (The manifest reason
should be corrected when an option below is implemented; not touched in this
docs-only slice.)

**Evidence (both pins re-verified):** SR Legacy has no salad-greens-mix
record (accurate). FNDDS **2709792 "Mixed salad greens, raw"**: per 100 g
21 kcal / 3.43 C / 1.31 P / 0.21 F / 1.4 fiber; portion "1 cup" = 35 g →
authored 2-cup serving = **70 g**. Reconciliation at 70 g: est 14.7 kcal vs
authored 12 (Δ2.7); protein 0.92 vs 1; carbs 2.40 vs 2; fat 0.15 vs 0; fiber
0.98 vs 1 — **passes every gate comfortably.** This is a normal Amendment A1
FNDDS match (like the F1–F4 batches), NOT a proxy or exception.

Conclusion: **mixed_greens is directly matchable under existing A1 rules** —
the "proxy decision" framing is moot. The generic "Lettuce, raw" (2709789,
also 35 g/cup) was the inferior fallback F1 considered; it is no longer
relevant now that the exact-name mix record is confirmed.

**Owner decision required — choose one:**

- **(A) RECOMMENDED — source mixed_greens directly from FNDDS 2709792 "Mixed
  salad greens, raw"** (a normal A1 match, no proxy/exception): serving kept
  at 2 cup, `cupFdc(2, 70)` (35 g/cup × 2), `sourceRef:
  fndds_survey_food_csv_2024-10-31`. Macros UNCHANGED (all reconcile within
  tolerance). Mechanics: revision 2 (rev-1 retained, new UUIDv5),
  `CATALOG_VERSION` → next patch, artifacts/hash/goldens regenerated,
  manifest entry replaces the (inaccurate) unmatched reason. **Gated count
  decreases 23 → 22**; mixed_greens leaves gate (c), which then EMPTIES.
- **(B) Accept generic "Lettuce, raw" as a documented proxy** — now
  unnecessary and inferior (single-genus vs the exact mix record). Not
  recommended; listed only for completeness.
- **(C) Reject sourcing and re-classify to gate (d) third-source residue** —
  not warranted, since a reconciling same-pin record exists.
- **(D) Defer.**

**Impact if Option A is later accepted:** food `mixed_greens`; serving 2 cup
unchanged; `grams_per_serving` null → **70**; NO macro deltas (est within
tolerance, authored values kept); new immutable revision 2 + patch
`CATALOG_VERSION` bump + regenerated artifacts/goldens; **gated count 23 →
22** (10 cup → 9 cup); gate (c) empties, leaving only gate (d).

Until a decision is recorded here, `food.mixed_greens` remains gated and
counted under gate (c).

### Related Documents

- .ai/12_DECISIONS.md — ADR-P012 (catalog identity, serving normalization, Risk-3 Normalization Note), ADR-0011 (health-data integrity)
- .ai/11_BACKLOG.md — TECHDEBT-004 (risk 3 part 1 resolved; part 2 gated here)
- .ai/13_MIGRATION_ROADMAP.md — Phase 15 Slice 4E / risk-3 status
- mobile/src/features/nutrition/infrastructure/food-catalog.data.ts — authored catalog + `FoodSource`
- mobile/src/features/nutrition/domain/catalog-identity.ts — `FOOD_REVISIONS`, `normalizeServing`
- USDA FoodData Central — https://fdc.nal.usda.gov (foodPortion / gramWeight)

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
