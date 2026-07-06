# AppFitness Mobile

The React Native + Expo mobile application for AppFitness — the target
platform defined by the `.ai/*` architecture documentation (ADR-0002,
ADR-0009) and built through the migration plan in
`.ai/13_MIGRATION_ROADMAP.md` (ADR-0013).

Created in migration **Phase 1** (2026-07-03). Contains the foundation
only — no business features yet.

---

## Stack (Phase 1 baseline)

| Piece | Version |
|---|---|
| Expo SDK | 57 (`expo ~57.0.2`) |
| React Native | 0.86.0 |
| React | 19.2.3 |
| TypeScript | ~6.0.3 (strict mode) |
| Router | Expo Router ~57.0.3 (typed routes enabled) |
| Lint | ESLint 9 + `eslint-config-expo` (flat config) |
| Tests | Jest 29 + jest-expo (`npm test`; 95%+ coverage enforced on iCoach domain) |

Scaffolded with `create-expo-app` (official default template). The
React Compiler experiment is enabled (template default).

Installed from the approved stack so far: **expo-sqlite ~57.0.0**
(Phase 4) and **expo-secure-store ~57.0.0** (Phase 6 — session storage).
Phase 10 added **zustand ~5.0.14** for dashboard/session UI orchestration
per ADR-0008. Not yet installed (added in the phase that first needs
them): React Hook Form, Zod, React Native Paper, Expo Notifications,
i18next, Victory Native XL, Expo Local Authentication. See
`.ai/02_TECH_STACK.md`.

Authentication (Phase 6): `src/features/authentication/` — SecureStore
session storage (tokens never in SQLite/AsyncStorage), fetch-based auth
client (`EXPO_PUBLIC_API_URL`, default `http://localhost:3001`), and an
offline-tolerant session manager (`restoreSession` keeps the stored
session on network failure; only an explicit 401 signs the user out).

Profile & goals (Phase 7/7.5): `src/features/profile/` — the first
offline-first entities. `saveMyProfile()`/`setGoal()` write SQLite and
enqueue sync operations in the same transaction (baseVersion = last
server-acked version); goal changes preserve history (old active goal
closed, never overwritten). UUIDs via `expo-crypto`.

Medical (Phase 8): `src/features/medical/` — append-only evaluations +
restrictions. Free-text is AES-256-GCM encrypted (ADR-P001:
`@noble/ciphers`, per-device key in SecureStore —
`shared/infrastructure/crypto/field-cipher.ts`) before touching SQLite;
sensitive sync-queue payloads and conflict records are stored encrypted
too. Never log medical field values.

iCoach engine (Phase 9): `src/features/icoach/domain/` — the
deterministic core (.ai/07_ICOACH.md). Pure functions only: no clocks,
randomness, I/O, or AI calls; identical inputs always produce identical
assessments. Rule changes REQUIRE bumping `ENGINE_RULE_VERSION`
(rule-versions.ts) — never silently change a formula. Chain: body
composition → metabolics → nutrition (safety floors) → restriction
analysis (medical overrides everything) → training plan → explainable
recommendations. 54 tests, coverage thresholds enforced.

Dashboard (Phase 10): `src/features/dashboard/` — the first real mobile
screen. It reads local SQLite-backed profile/goal/medical/sync data
through feature public APIs, adapts it into the deterministic iCoach
engine, and renders assessment, recommendations, data gaps, sync status,
offline/sync-pending/error/loading states through shared token-based UI
primitives. The `__DEV__`-only "Load sample data" action writes fake
profile/goal/evaluation data through real repositories for simulator
validation; it is unavailable in production builds.

Sync worker (Phase 7.5): `runSync()` in `shared/infrastructure/sync/` —
drains the queue in FIFO batches to `/sync/push`, processes APPLIED/
CONFLICT/REJECTED outcomes (conflicts recorded locally with the server
snapshot; failures rescheduled with exponential backoff), then pulls per
entity cursor and applies through the `EntityApplier` registry — a
pending-op guard ensures pulled state never clobbers unshipped local
edits. No background scheduling yet; the app decides when to call it.

## Structure

```
mobile/
├── src/
│   ├── app/                # Expo Router file-based routes
│   │   ├── _layout.tsx     # Root layout: theme → navigation bridge, StatusBar
│   │   ├── index.tsx       # Auth-aware redirect
│   │   ├── sign-in.tsx     # Minimal development auth route
│   │   └── dashboard.tsx   # Protected dashboard route
│   ├── features/           # Feature-First modules (.ai/06_MOBILE.md)
│   │   └── <feature>/{presentation,application,domain,infrastructure,tests}/
│   │       # authentication, dashboard, medical, nutrition, workout,
│   │       # progress, icoach, profile, settings, notifications
│   └── shared/
│       ├── theme/          # Design tokens (.ai/08_UI_UX.md, MD3)
│       │   # colors (light/dark), spacing (8pt grid), typography,
│       │   # radius, elevation, motion, useTheme()
│       ├── presentation/   # Token-based primitives (Screen, Card,
│       │   # AppText, AppButton, Banner)
│       └── infrastructure/
│           ├── database/   # Expo SQLite foundation (Phase 4)
│           │   # getDatabase(), migration runner (PRAGMA user_version),
│           │   # 001-initial DDL (27 tables), typed sql helpers, row types
│           │   # Design: .ai/16_SQLITE_SCHEMA_DESIGN.md
│           └── sync/       # Sync queue infrastructure (Phase 5)
│               # enqueue/peekReady/mark* (FIFO, exponential backoff),
│               # pull cursors (sync-state), local conflict store.
│               # Entity-agnostic: repositories enqueue; the sync worker
│               # (Phase 6+) drains against POST /sync/push, GET /sync/pull.
│               # opId is caller-minted (UUID) — it is the server-side
│               # idempotency key.
├── assets/                 # Icons, splash (template defaults for now)
├── app.json                # name: AppFitness, scheme: appfitness
└── tsconfig.json           # strict: true, "@/*" → ./src/*
```

## Rules

- Read `.ai/06_MOBILE.md`, `.ai/08_UI_UX.md`, and `CLAUDE.md` (repo root)
  before contributing.
- No hardcoded colors/spacing/typography — consume tokens via
  `useTheme()` from `@/shared/theme`.
- No business logic in screens/components; features own their
  presentation/application/domain/infrastructure layers.
- Never import from `client/` or `server/` (the legacy MVP is read-only
  reference material — see ADR-0013).
- Typography targets Inter (`.ai/02_TECH_STACK.md`); the font is not yet
  bundled — tokens fall back to the platform font until it is added.

## Commands

```
npm start            # Expo dev server
npm run android      # dev server + Android
npm run ios          # dev server + iOS (macOS required)
npx tsc --noEmit     # type check (strict)
npm run lint         # ESLint
npm test             # Jest (iCoach coverage gate + dashboard adapter tests)
npx expo-doctor      # project health checks
npx expo export --platform ios --platform android
```
