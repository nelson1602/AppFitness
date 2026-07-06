# AppFitness Current MVP Baseline

Version: 1.0
Status: Active
Last Updated: 2026-07-03

---

# Purpose

This document is the official behavioral baseline of the current AppFitness
MVP, captured as part of **Phase 0** of `.ai/13_MIGRATION_ROADMAP.md` (see
ADR-0013 in `.ai/12_DECISIONS.md`).

It exists so that every later migration phase has an accurate, evidence-based
description of what the MVP actually does — instead of relying on assumption
or memory — before any mobile/NestJS/PostgreSQL work begins.

This document describes the MVP **as it exists today**. It is not a
specification of the target architecture (see `.ai/01_ARCHITECTURE.md`
through `.ai/10_DEPLOYMENT.md` for that) and it does not authorize or
recommend keeping any of this design permanently — see the "Migration
Relevance" and "Reuse" sections below for that judgment.

The MVP itself was **not modified** to produce this document. All findings
are based on static inspection of the repository as of 2026-07-03.

**Phase 0 closure note (2026-07-03):** builds, type-checks, client lint,
this baseline document, and the `legacy-mvp-baseline` git tag all
completed successfully. The manual UI smoke test was explicitly waived
by the project owner and is tracked as **Pending Human Validation** in
`.ai/13_MIGRATION_ROADMAP.md` Phase 0 — it does not block Phase 1 but
should still be performed by a human against the feature inventory below.

---

# Current Project Architecture

AppFitness's MVP is a conventional two-tier web application, not the
mobile/offline-first architecture described in `.ai/01_ARCHITECTURE.md`:

```
AppFitness/
├── client/     Vite + React 18 single-page web app
└── server/     Express 4 API + Prisma ORM + SQLite
```

There is no separation into Presentation / Application / Domain /
Infrastructure layers as defined by `01_ARCHITECTURE.md`. Instead:

* `client/` is organized by feature folders (`features/<name>/`), each
  containing an `api.ts` (network calls) and a `components/` folder (UI).
  There is no distinct Application or Domain layer inside features —
  components call `api.ts` functions directly, and `api.ts` calls the
  backend directly via Axios.
* `server/` is organized by technical role
  (`routes/ → controllers/ → services/ → models/`), plus a separate
  `engines/` directory holding calculation/business logic. This is closer
  to a classic layered/MVC structure than to Clean Architecture, though
  the `engines/` split does keep a meaningful amount of business logic
  out of controllers.
* The two tiers communicate exclusively over HTTP (REST, `/api/*`) and a
  single Socket.IO channel — there is no offline-local database, no sync
  queue, and no dual-database model. The Express server serves the
  built client (`client/dist`) directly in production (`server/src/index.ts:58-65`),
  meaning today the "backend" and "frontend" are deployed as one process.

---

# Current Frontend Structure (`client/`)

* **Stack:** Vite 6, React 18, TypeScript, React Router v6 (`BrowserRouter`),
  Tailwind CSS, `vite-plugin-pwa`, i18next/react-i18next, Recharts,
  socket.io-client, Axios, `lucide-react` icons, `clsx`/`tailwind-merge`.
* **Entry point:** `client/src/main.tsx` → `client/src/App.tsx`.
* **Routing (`App.tsx`):** all routes are defined in one file using
  React Router, with lazy-loaded pages (`React.lazy`) for every screen
  except `LandingPage`. Route guards are implemented as small wrapper
  components: `ProtectedRoute` (requires `user` in the auth store),
  `PublicRoute` (redirects logged-in users away from login/register),
  `LandingRoute`, and `OnboardingGuard` (redirects to `/onboarding` if
  the user's profile isn't complete). There is no typed/deep-link-aware
  routing layer such as Expo Router's file-based system.
* **Feature folders** under `client/src/features/`: `coach`, `dashboard`,
  `gamification`, `health`, `measurements`, `nutrition`, `profile`,
  `progress`, `reevaluation`, `supplements`, `workouts`. Each has an
  `api.ts` and a `components/` subfolder; `workouts` additionally has a
  `hooks/` subfolder (`useRestTimer.ts`).
* **Shared UI:** `client/src/components/ui/*` (Button, Card, Modal, Input,
  Badge, Toaster, Skeleton, Spinner, InstallPrompt/InstallBanner for PWA,
  LanguageSelector, OfflineBanner, ConfirmModal, AchievementToast) and
  `client/src/components/layout/*` (AppShell, Header, Sidebar, BottomNav,
  NotificationBell).
* **Pages:** `client/src/pages/*.tsx` — one file per route
  (Landing, Login, Register, Onboarding, Dashboard, Workouts,
  RoutineForm, ActiveWorkout, WorkoutLogDetail, Nutrition, Coach,
  Profile, Gamification, Progress).
* **Types:** `client/src/types/*.ts` — hand-written TypeScript interfaces
  per domain area (no shared/generated types with the backend; no
  contract enforcement between client and server beyond convention).
* **i18n:** `client/src/i18n/` with `en.json`/`es.json` locale files —
  aligns with `.ai/06_MOBILE.md`'s i18next requirement, though built for
  web, not React Native.
* **PWA:** implemented via hand-written static assets — `manifest.json`
  and `sw.js` live in `client/public/` and are copied verbatim into the
  build output. `vite-plugin-pwa` is installed as a devDependency but is
  **not referenced in `vite.config.ts`** (verified during Phase 0 build
  validation, 2026-07-03) — it is an unused dependency. Install UX is
  handled by `InstallPrompt`/`InstallBanner` components and the
  `usePwaInstall` hook. This PWA setup is the MVP's substitute for a
  native mobile app; it is not Expo/React Native and does not provide
  native offline SQLite storage.

---

# Current Backend Structure (`server/`)

* **Stack:** Node.js + Express 4, TypeScript, Prisma ORM, Zod (request
  validation), JWT (`jsonwebtoken`), `bcryptjs`, `helmet`, `cors`,
  `compression`, `express-rate-limit`, `nodemailer`, `socket.io`.
* **Entry point:** `server/src/index.ts` — creates the Express app, wraps
  it in a raw `http.Server`, attaches Socket.IO to the same server,
  applies global middleware (`helmet`, `cors`, `compression`,
  JSON body parsing capped at 10kb, a global API rate limiter), mounts
  `/api` routes, and — in production only — serves the built client and
  falls back to `index.html` for any non-`/api` GET request (SPA hosting
  baked into the API process).
* **Route layer:** `server/src/routes/index.ts` mounts one router per
  domain under `/api`: `auth`, `workouts`, `nutrition`, `dashboard`,
  `profile`, `health`, `coach`, `gamification`, `progress`,
  `notifications`, `recommendations`, `reevaluation`, `measurements`,
  `supplements`.
* **Controller layer:** thin per-domain controllers in
  `server/src/controllers/*.controller.ts` — they parse `req`, call a
  matching service function, and forward the result or error
  (`next(err)`), consistent with `03_CODING_STANDARDS.md`'s "controllers
  should validate input, delegate work, return responses" rule at a
  structural level (validation itself is handled by a separate
  `validate.middleware.ts` + Zod schemas, not shown inline above).
* **Service layer:** `server/src/services/*.service.ts` — business
  operations and Prisma queries per domain, including `email.service.ts`
  (nodemailer wrapper, silently skipped if SMTP env vars are unset).
* **Engine layer:** `server/src/engines/*` — see "iCoach/AI/Engine-Related
  Modules" below; this is the closest existing analogue to a Domain layer.
* **Cross-cutting:** `server/src/middlewares/` (`auth.middleware.ts`,
  `error.middleware.ts`, `rateLimiter.ts`, `validate.middleware.ts`),
  `server/src/utils/` (`jwt.ts`, `hash.ts`, `errors.ts` — a custom
  `AppError` class, consistent with `03_CODING_STANDARDS.md`'s "use
  custom error classes" guidance), `server/src/config/`
  (`env.ts`, `prisma.ts`, `socket.ts`).
* **Background jobs:** `server/src/jobs/reevaluation.job.ts` — a simple
  `setInterval`-based job (no queue, no BullMQ/Redis) that runs once at
  startup and then every 24 hours, iterating all users with a completed
  profile and emailing a re-evaluation reminder via
  `reevaluation.service.ts`.
* **Path aliasing:** backend code uses `@/` as an alias to `server/src`
  (seen throughout imports, e.g. `@/config/env`).

---

# Current Database Setup

* **Engine:** SQLite via Prisma, **not PostgreSQL** — the Prisma
  datasource in `server/prisma/schema.prisma` is
  `provider = "sqlite"`, `url = env("DATABASE_URL")`. A `dev.db` file
  exists on disk at `server/prisma/dev.db` (excluded from source control
  reading per this phase's rules — its contents were not inspected).
* **Schema summary** (`server/prisma/schema.prisma`, 400 lines, ~24
  models): `User`, `RefreshToken`; workout domain: `Exercise`, `Routine`,
  `RoutineExercise`, `WorkoutLog`, `WorkoutSet`; nutrition domain: `Food`,
  `NutritionLog`, `Meal`, `MealItem`; progress domain: `BodyWeight`,
  `BodyMeasurement`, `ProgressSnapshot`; engine/derived-data domain:
  `UserProfile`, `HealthLog`, `Recommendation`, `Notification`,
  `Achievement`, `UserAchievement`, `UserStats`, `CoachInsight`.
* **Primary keys:** all models use `cuid()` string IDs, not UUIDs as
  mandated by `04_DATABASE.md` for synchronized entities (cuid and UUID
  are different identifier schemes).
* **No sync/versioning metadata:** no model has `version`, `sync_status`,
  `deleted_at`/`deleted_by` (soft delete), or a `device_id` field. Deletes
  are hard deletes via Prisma's `onDelete: Cascade`/`SetNull`.
  `04_DATABASE.md`'s mandatory soft-delete and versioning requirements
  are not implemented anywhere in the current schema.
* **No audit trail table** — no model records historical change events
  (e.g. medical evaluation edits, permission changes).
* **Dates as strings:** several models store dates as `String` in
  `"YYYY-MM-DD"` format (e.g. `NutritionLog.date`, `BodyWeight.date`,
  `HealthLog.date`) — a documented SQLite-compatibility workaround
  (see inline comment on `NutritionLog.date`), not a `DateTime` column.
* **Migrations:** `server/prisma/migrations/` exists but is excluded from
  git via `.gitignore` (`server/prisma/migrations/`) — migration history
  is not currently version-controlled.
* **Seed data:** `server/prisma/seed.ts` exists (not read in this phase
  to avoid unrelated scope; its presence is noted for Phase 3 reference).

---

# Current Authentication Flow

* **Registration** (`POST /api/auth/register`,
  `auth.controller.ts` → `auth.service.ts`):
  1. Checks for an existing user by email or username.
  2. Performs a live DNS lookup (`dns.lookup`, OS resolver) on the
     email's domain as a lightweight "does this domain exist" check —
     note this only confirms the domain resolves, not that it accepts
     mail (no MX-specific check), and fails open (treats resolver
     errors as "valid") to avoid false rejections from OS/network
     issues.
  3. Hashes the password with **bcryptjs** (`SALT_ROUNDS = 12`) —
     `05_SECURITY.md`/`02_TECH_STACK.md` mandate **Argon2**, not bcrypt.
  4. Creates the `User` row and issues an access/refresh token pair.
* **Login** (`POST /api/auth/login`): looks up by email, compares
  password with `bcrypt.compare`, issues a new token pair.
* **Tokens:** short-lived JWT access token (`JWT_ACCESS_EXPIRES_IN`,
  default `15m`) signed with `JWT_ACCESS_SECRET`, and a longer-lived
  refresh token (`JWT_REFRESH_EXPIRES_IN`, default `7d`) signed with a
  separate `JWT_REFRESH_SECRET`. Refresh tokens are persisted in the
  `RefreshToken` table (one row per issued token) so they can be looked
  up, expired, and deleted server-side.
* **Refresh rotation:** `POST /api/auth/refresh` verifies the refresh
  JWT, confirms the token still exists and is unexpired in the database,
  **deletes it** (single-use), and issues a brand-new access/refresh
  pair — i.e., refresh tokens are rotated per `05_SECURITY.md`'s
  "Secure Rotation" requirement.
* **Logout:** deletes the given refresh token from the database (does
  not revoke the still-valid access token, which simply expires
  naturally within 15 minutes).
* **Request authentication:** `auth.middleware.ts` requires a
  `Authorization: Bearer <token>` header, verifies it with
  `verifyAccessToken`, and attaches `req.userId`. There is **no RBAC/role
  field anywhere** in the `User` model or middleware — every
  authenticated user has identical authorization; `05_SECURITY.md`'s
  RBAC requirement is entirely unimplemented in the MVP.
* **Client-side token handling:** `client/src/lib/axios.ts` attaches the
  access token to every request, and on a `401` transparently attempts
  one token refresh (with a request queue to avoid duplicate refresh
  calls for concurrent requests), retrying the original request on
  success or clearing auth state on failure.
* **Client-side storage:** `client/src/store/auth.store.ts` is a Zustand
  store persisted via `zustand/middleware`'s `persist` (i.e., browser
  `localStorage`) — access token, refresh token, and user object are all
  stored in `localStorage`. This directly conflicts with
  `05_SECURITY.md`'s "Never store authentication credentials inside
  AsyncStorage [or equivalent unencrypted storage]" — `localStorage` is
  the web equivalent of the forbidden pattern; there is no SecureStore
  equivalent in use.
* **Rate limiting:** a stricter `authLimiter` (20 requests / 15 min) is
  defined in `rateLimiter.ts` but note it is not visibly wired to the
  auth routes in the router shown in this inspection — a general
  `apiLimiter` (120 req/min) is applied globally to `/api` in
  `index.ts`. This should be verified against `auth.routes.ts` directly
  in a later phase if precise rate-limit behavior matters.

---

# Current iCoach/AI/Engine-Related Modules

There is no AI/LLM integration anywhere in the MVP — all "engines" are
deterministic TypeScript calculation modules, which is directionally
aligned with `.ai/07_ICOACH.md`'s Deterministic Engine requirement, even
though they are not organized, versioned, or tested to that
specification yet.

`server/src/engines/` contains:

* **`coach/coach.engine.ts`** — the orchestrator. `CoachEngine
  .generateReport()` composes the other engines in sequence: Health →
  Progress → Recommendation (nutrition + training) → Workout (routine
  generation) → Notification → a human-readable Markdown summary. This
  is the MVP's rough equivalent of `07_ICOACH.md`'s
  Decision/Recommendation Engine chain, but implemented as one class
  composing others directly (tight coupling) rather than as independent,
  versioned modules communicating through contracts.
* **`health/health.engine.ts`** — computes a `ReadinessScore` from the
  latest `HealthLog` (sleep, energy, stress, resting HR, mood).
* **`progress/`** — `progress.engine.ts` (analysis orchestrator),
  `plateau.detector.ts`, `deload.scheduler.ts`, `goal.predictor.ts` —
  weight-plateau detection, deload-week decisions, and goal ETA
  prediction.
* **`recommendation/`** — `recommendation.engine.ts`,
  `calorie.adjuster.ts`, `macro.adjuster.ts`, `volume.adjuster.ts` —
  nutrition/training adjustments based on progress and readiness.
* **`workout/`** — `workout.engine.ts`, `routine.builder.ts`,
  `exercise.catalog.ts` — generates/builds workout routines.
* **`notification/`** — `notification.engine.ts`,
  `message.templates.ts` — generates in-app notification content from
  coach output.
* **`gamification/`** — `gamification.engine.ts`,
  `achievement.definitions.ts` — XP/level/streak/achievement logic.

**Determinism/versioning gap:** none of these engines carry a rule
version, author, scientific source, or revision history as required by
`07_ICOACH.md`'s Rule Versioning section, and there is no test suite
verifying identical-input-identical-output behavior. `CoachInsight` and
`Recommendation` rows are persisted with a `createdAt` timestamp but no
`ruleVersion` field, so historical recommendations cannot currently be
traced to the logic version that produced them.

---

# Current Nutrition/Workout/Progress-Related Modules

* **Nutrition:** `Food` (per-100g macro catalog), `NutritionLog` → `Meal`
  → `MealItem` (quantity in grams, linked to a `Food`). Frontend:
  `features/nutrition/` (`MealCard`, `MacroRing`, `MacroBar`,
  `FoodSearchModal`, `macros.ts` calculation helpers).
* **Workout:** `Exercise` catalog, `Routine` → `RoutineExercise`
  (ordered, with target sets/reps/weight), `WorkoutLog` → `WorkoutSet`
  (actual reps/weight/RPE/completed). Frontend:
  `features/workouts/` (`RoutineCard`, `SetRow`, `RestTimer` +
  `useRestTimer` hook, `ExercisePicker`, `ExerciseHistoryModal`) plus
  dedicated pages for building routines and running an active workout
  session.
* **Progress:** `BodyWeight`, `BodyMeasurement` (waist/hip/chest/arms/
  neck/body-fat %), `ProgressSnapshot` (weekly rollups: avg weight, total
  volume, avg calories, workout count, deload flag). Frontend:
  `features/progress/api.ts` (no dedicated components subfolder observed
  — likely renders via dashboard charts).
* **Medical/health evaluation equivalent:** `HealthLog` (daily
  sleep/energy/stress/HR/mood/readiness) and `UserProfile` (birth date,
  gender, height, goals, activity level, blood pressure, injuries,
  training days/session length, macro targets). This is the MVP's
  closest analogue to `.ai/07_ICOACH.md`'s Medical Evaluation Module and
  `04_DATABASE.md`'s "Medical evaluations" data category — notably,
  `UserProfile.injuries` is a free-text `String?` field with no
  structured restriction model, and there is no separate
  doctor-notes/medical-conditions/medications field set as enumerated in
  `07_ICOACH.md`.
* **Re-evaluation:** `features/reevaluation/` (client) +
  `reevaluation.routes/controller/service.ts` (server) +
  `jobs/reevaluation.job.ts` — a periodic email reminder system
  prompting users to update their evaluation data; not itself a
  calculation engine.
* **Supplements:** `features/supplements/` (client) +
  `supplement.routes/controller.ts` (server) — no corresponding Prisma
  model was found in the schema reviewed above, suggesting this feature
  may store data differently (e.g. static catalog) or was only partially
  wired to persistence; worth re-checking in Phase 7/8 rather than
  assuming schema coverage.

---

# Current State Management

* **Client:** Zustand, matching the target stack
  (`02_TECH_STACK.md`/ADR-0008) at the library-choice level.
  Two stores were found: `auth.store.ts` (user, tokens, profile-complete
  flag — persisted to `localStorage`) and `toast.store.ts` (transient UI
  notifications). Most feature/domain data (workouts, nutrition, etc.)
  appears to be fetched ad hoc via each feature's `api.ts` and held in
  local component state/React Query-less `useEffect` patterns rather
  than centralized Zustand stores — this should be confirmed feature by
  feature during Phase 7 onward rather than assumed.
* **No persistent/derived state separation is enforced** in the sense of
  `01_ARCHITECTURE.md`'s four-state model (UI/Local Persistent/Derived/
  Remote) — there is no local persistent state layer at all (no SQLite,
  no IndexedDB), since all durable state lives server-side in SQLite via
  Prisma and is fetched fresh over the network each time.
* **Server:** no in-memory or Redis-backed state; each request is
  stateless apart from the Socket.IO room membership
  (`user:<userId>`) held in the Socket.IO server's own connection
  registry.

---

# Current Realtime/Socket Usage

* **Library:** `socket.io` (server) / `socket.io-client` (client) — **not
  present anywhere in `.ai/02_TECH_STACK.md`**; this is an undocumented
  dependency per ADR-0013's findings.
* **Server setup** (`server/src/index.ts`, `server/src/config/socket.ts`):
  a Socket.IO server is attached to the same HTTP server as Express.
  Connections are authenticated via a JWT passed in the Socket.IO
  handshake `auth` payload (verified against `JWT_ACCESS_SECRET`);
  authenticated sockets join a room named `user:<userId>`.
  `config/socket.ts` exposes a minimal `emitToUser(userId, event, data)`
  helper used elsewhere in the codebase (not traced further in this
  phase) to push events to a specific user's connected clients.
* **Known event usage:** a `rest:start` event (with a `duration` in
  seconds) triggers a server-side `setTimeout` that emits `rest:done`
  back to the same socket — used by the workout rest-timer feature
  (`features/workouts/hooks/useRestTimer.ts`, `RestTimer.tsx`) as a
  server-anchored countdown instead of a purely client-side timer.
* **Client setup** (`client/src/lib/socket.ts`): a singleton socket
  instance configured with `autoConnect: false` and an `auth` callback
  that reads the current access token from the Zustand auth store at
  connect time.
* **Migration relevance:** ADR-0013 already isolates this dependency —
  it is not to be carried into the target architecture without its own
  ADR. If server-anchored rest timers or other realtime behavior are
  wanted on mobile, that must be an explicit, separately-approved
  decision, not an implicit port of this code.

---

# Current Scripts and Run Commands

**Client** (`client/package.json`):

| Script | Command | Purpose |
|---|---|---|
| `dev` | `vite` | Local dev server (port 5173, proxies `/api` and `/socket.io` to `localhost:3000`) |
| `build` | `tsc && vite build` | Type-check then production build to `client/dist` |
| `preview` | `vite preview` | Preview the production build locally |
| `lint` | `eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0` | Lint, zero-warning policy |
| `type-check` | `tsc --noEmit` | Standalone type check |

**Server** (`server/package.json`):

| Script | Command | Purpose |
|---|---|---|
| `dev` | `tsx watch src/index.ts` | Local dev server with hot reload |
| `build` | `tsc` | Compile TypeScript to `dist/` |
| `start` | `node dist/index.js` | Run the compiled production server |
| `db:generate` | `prisma generate` | Regenerate the Prisma client |
| `db:migrate` | `prisma migrate dev` | Apply/create local dev migrations (not run in this phase) |
| `db:studio` | Prisma Studio | Visual DB browser (not run in this phase) |
| `db:seed` | `tsx prisma/seed.ts` | Seed the database (not run in this phase) |
| `type-check` | `tsc --noEmit` | Standalone type check |

No `test` script exists in either `package.json` — consistent with the
earlier finding that no test framework is installed.

---

# Current Environment Requirements (No Secret Values Included)

Derived from `server/.env.example` (placeholder file — no real secrets
were read or reproduced from `server/.env`, which was not opened):

| Variable | Purpose |
|---|---|
| `NODE_ENV` | `development` \| `production` \| `test` (Zod-validated, default `development`) |
| `PORT` | Server listen port (default `3000`) |
| `CLIENT_URL` | Used for CORS origin and email links; must match where the client is served from |
| `DATABASE_URL` | SQLite file path for Prisma (e.g. a `file:./*.db` URL) |
| `JWT_ACCESS_SECRET` | Signing secret for access tokens — Zod-enforced minimum length of 32 characters |
| `JWT_REFRESH_SECRET` | Signing secret for refresh tokens — same minimum length requirement, must differ from the access secret |
| `JWT_ACCESS_EXPIRES_IN` | Access token lifetime (default `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifetime (default `7d`) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Optional outbound email configuration; the email service silently no-ops when unset |

Environment validation happens centrally in `server/src/config/env.ts`
via a Zod schema, and the process exits on invalid/missing required
variables — a good existing practice worth preserving conceptually
(centralized, validated config, per `01_ARCHITECTURE.md`'s Configuration
section).

---

# Current Technical Risks

* **No automated tests** — zero unit, integration, component, or E2E
  tests exist in either `client/` or `server/`. Any future refactor or
  migration-adjacent change to this codebase carries full regression
  risk with no safety net.
* **No CI/CD** — no `.github/workflows`, so nothing currently enforces
  type-check/lint/tests/build on any change.
* **Password hashing uses bcryptjs, not Argon2** — a direct deviation
  from `05_SECURITY.md`/`02_TECH_STACK.md`; any migrated system needs an
  explicit rehash-on-login strategy (already captured in
  `13_MIGRATION_ROADMAP.md` Phase 6).
* **No RBAC / authorization model** — the `User` model has no role or
  permission field; every authenticated user is equivalent. This is a
  functional gap relative to `05_SECURITY.md`, not just a naming
  difference.
* **Tokens stored in `localStorage`** — the web equivalent of the
  explicitly forbidden `AsyncStorage`-for-credentials pattern in
  `05_SECURITY.md`; acceptable for a web MVP under lower requirements,
  but must not be replicated on mobile (SecureStore is mandated there).
* **No soft deletes, versioning, or audit trail** in the database schema
  — `04_DATABASE.md`'s mandatory fields (`version`, `sync_status`,
  `deleted_at`, audit records) are entirely absent; all deletes are hard
  deletes via cascade.
* **`cuid()` primary keys, not UUIDs** — `04_DATABASE.md` requires UUIDs
  for any synchronized entity; this is a schema-wide identifier mismatch
  that affects every model, not an isolated field.
* **Prisma migration history is gitignored** — `server/prisma/migrations/`
  is excluded from version control, so the authoritative migration
  history only exists on whatever machine generated it; this is a data
  point for Phase 3, not something to fix in Phase 0.
* **Client and server are deployed as one process in production** — the
  Express server serves the built client bundle directly and falls back
  to it for all non-API routes; there is no independent deployability
  between frontend and backend today, contrary to
  `01_ARCHITECTURE.md`'s scalability/independent-deployability goals.
* **Weak email-domain validation** — registration checks only that the
  email's domain resolves via `dns.lookup` (OS resolver), which confirms
  the domain exists but not that it can receive mail (no MX-specific
  check), and treats any resolver error as "valid" (fails open). This is
  a pre-existing MVP design choice, not a blocking defect, but should be
  reconsidered when authentication is rebuilt in Phase 6.
* **Undocumented realtime dependency** — `socket.io`/`socket.io-client`
  is used in production but has no entry in `.ai/02_TECH_STACK.md` and
  no ADR (already captured in ADR-0013).
* **`supplements` feature has no corresponding Prisma model** — RESOLVED
  (2026-07-03, Phase 3): `server/src/services/supplement.service.ts` is a
  pure rule engine computing suggestions on request from workout/profile/
  health data with a hardcoded in-code catalog; nothing is persisted. No
  supplement tables are needed in the target schema; the feature becomes
  deterministic iCoach rule logic in Phase 9.

---

# Current Migration Relevance

This MVP is the primary behavioral reference for the entire
`13_MIGRATION_ROADMAP.md`. Concretely:

* Phase 3 (PostgreSQL schema design) must treat
  `server/prisma/schema.prisma` as its starting input for entity and
  field coverage, then add the versioning/sync/audit columns this MVP
  lacks.
* Phase 6 (auth) must treat `auth.service.ts`'s register/login/refresh/
  logout/change-password/update-account behavior as the functional
  baseline to match or intentionally improve upon (e.g. adding RBAC,
  Argon2, SecureStore).
* Phase 7–8 (profile, medical/evaluation) must treat
  `UserProfile`/`HealthLog` and their frontend features as the baseline
  for what data is collected today, while restructuring it to match
  `07_ICOACH.md`'s more detailed Medical Evaluation Module inputs.
* Phase 9 (iCoach engine) must treat `server/src/engines/*` as the
  functional specification of existing calculations (readiness scoring,
  plateau/deload/goal-prediction logic, nutrition/training adjustment,
  routine generation), to be reimplemented as versioned, tested,
  framework-independent domain logic — not copied as-is.
* Phase 10 (dashboard) must treat `client/src/features/dashboard/*` as
  UX reference for what a "coach report" / dashboard currently surfaces.

---

# What Can Be Reused

* **Business/calculation logic embedded in `server/src/engines/*`** — as
  a specification to reimplement deterministically and with versioning,
  not as literal ported code (see ADR-0013).
* **`server/prisma/schema.prisma` entity/field definitions** — as the
  input reference for the target PostgreSQL schema (Phase 3).
* **Zod validation patterns** already used on the backend
  (`validate.middleware.ts` + per-domain schemas) — Zod is the mandated
  validation library on both mobile and (conceptually) via
  class-validator equivalents on NestJS; the *shapes* being validated
  transfer directly even though the enforcement mechanism changes.
* **Zustand store patterns** (`auth.store.ts`, `toast.store.ts`) — same
  library as the mobile target stack; store *shape* and update patterns
  are a reasonable starting reference, though the `persist`-to-
  `localStorage` middleware must not be reused for tokens (see "What
  Must Not Be Reused").
* **i18next locale content** (`client/src/i18n/locales/en.json`,
  `es.json`) — directly portable translation strings for the mobile app.
* **UX/flow decisions** encoded in `client/src/pages/*` and
  `client/src/features/*/components/*` — what data is collected, in
  what order, and how results are presented — as UX reference for
  `.ai/08_UI_UX.md`-compliant mobile screens, not as ported React DOM
  components (React Native requires different primitives).
* **Centralized, Zod-validated environment configuration pattern**
  (`server/src/config/env.ts`) — a good practice worth carrying into the
  NestJS backend's configuration module.
* **Custom `AppError` error-handling pattern** (`server/src/utils/
  errors.ts` + `error.middleware.ts`) — aligns with
  `03_CODING_STANDARDS.md`'s "use custom error classes" rule and is a
  reasonable pattern to carry into NestJS's exception-filter equivalent.

---

# What Should Not Be Reused

* **Storing JWT access/refresh tokens in `localStorage`** (via Zustand's
  `persist` middleware) — must become SecureStore-backed storage on
  mobile per `05_SECURITY.md`; this pattern should not be replicated
  even as a starting point.
* **bcryptjs password hashing** — must become Argon2; do not port the
  hashing utility (`server/src/utils/hash.ts`) as-is.
* **Client/server co-deployment** (Express serving the built SPA) — the
  target architecture has an independently-deployable mobile app and
  backend; this coupling should not be carried forward.
* **`socket.io`/`socket.io-client`** — isolated per ADR-0013; not to be
  propagated into the mobile/NestJS stack without its own ADR.
* **`setInterval`-based background job** (`reevaluation.job.ts`) — the
  target stack specifies BullMQ + Redis for background jobs
  (`02_TECH_STACK.md`); this ad hoc in-process timer pattern does not
  scale past a single server instance and should not be the model for
  the new backend's job system.
* **`cuid()` identifiers** — the target schema requires UUIDs for
  synchronized entities; do not carry the ID generation strategy
  forward.
* **Weak DNS-only email domain validation** — should be reconsidered
  (e.g. proper MX lookup, or a different verification strategy such as
  confirmation email) rather than copied into the rebuilt auth module.

---

# What Must Be Replaced

* Express → NestJS (ADR-0003).
* SQLite-as-server-database → PostgreSQL as system of record (ADR-0004),
  with Expo SQLite introduced as a genuinely offline-local database
  (ADR-0005) — a new concept, not a replacement of an existing local DB,
  since none exists today.
* Online-only request/response data flow → offline-first local-write +
  sync-queue flow (ADR-0006) — this is a net-new capability, not a
  modification of existing sync logic (none exists).
* bcryptjs → Argon2 (with a rehash-on-login migration path for existing
  users, per Phase 6).
* No-RBAC → RBAC-enforced authorization (per `05_SECURITY.md`).
* React web SPA (React DOM, React Router, Tailwind) → React Native +
  Expo + Expo Router + the Material Design 3-based mobile design system
  (ADR-0002, ADR-0009, ADR-0010).
* Ad hoc engine composition (`CoachEngine` directly instantiating and
  calling other engine classes) → the independent, contract-based module
  chain described in `07_ICOACH.md` (Medical Evaluation → Body
  Composition → Metabolic → Goal Analysis → Nutrition → Workout →
  Recovery → Decision → Recommendation → Dashboard), with versioning and
  explainability metadata attached to every output.

---

# What Must Be Preserved as Behavioral Reference

Even though the following will not be reused as code, they must be
**read and understood** before their replacements are built, so the new
system doesn't silently regress functionality real users may already
depend on:

* Every field currently collected in `UserProfile` and `HealthLog`
  (Phase 7/8) — the new Medical Evaluation Module must be a superset,
  not an accidental subset.
* The full `CoachEngine.generateReport()` composition order and the
  specific calculations inside `health`, `progress`, `recommendation`,
  and `workout` engines (Phase 9) — determinism and explainability must
  be added *without* silently dropping an existing calculation.
* The complete route surface in `server/src/routes/index.ts` (14 mounted
  routers) — every one of these domains needs an equivalent (or an
  explicit, approved decision to drop it) in the NestJS backend.
* The full page/route list in `client/src/App.tsx` — every screen here
  needs a mobile equivalent (or an explicit, approved decision to drop
  it) before the MVP can be decommissioned per ADR-0013's Acceptance
  Criteria.
* The onboarding/profile-completion gating logic (`OnboardingGuard` in
  `App.tsx`, `profileComplete` state) — this UX flow (must complete
  onboarding before reaching the main app) should be intentionally
  carried into the mobile app's navigation design, not lost.

---

# AI Instructions

Every AI agent working on any later migration phase must:

* Treat this document, not memory or assumption, as the source of truth
  for "what the MVP currently does."
* Re-verify any specific behavioral claim in this document against the
  live MVP source before depending on it for an implementation decision,
  since this document is a point-in-time snapshot (2026-07-03) and the
  MVP could still receive fixes during the migration period.
* Never treat this document as authorization to modify, refactor, or
  delete any file in `client/` or `server/` — it is a reference artifact
  only, produced under Phase 0 of `.ai/13_MIGRATION_ROADMAP.md`.
* Flag any discrepancy discovered later between this baseline and actual
  MVP behavior by updating this document, not by silently working around
  it.
