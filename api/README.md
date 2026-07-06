# AppFitness API

The NestJS backend for AppFitness — the target architecture defined by
`.ai/*` (ADR-0003) and built through the migration plan in
`.ai/13_MIGRATION_ROADMAP.md` (ADR-0013).

Created in migration **Phase 2** (2026-07-03). Contains the foundation
only — no business logic, database, or authentication yet. The legacy
Express MVP in `server/` remains the operational backend until cutover.

---

## Stack (Phase 2 baseline)

| Piece | Version |
|---|---|
| NestJS | 11 |
| TypeScript | ~5.7 (strict mode) |
| Validation | class-validator + class-transformer (global `ValidationPipe`) |
| API docs | @nestjs/swagger — served at `/docs` |
| Config | @nestjs/config (global), `.env` based |
| Tests | Jest (unit) + Supertest (e2e) |
| Lint/format | ESLint 9 (flat config) + Prettier |

Approved-stack pieces **not yet installed** (added in the phase that
first needs them): Prisma + PostgreSQL (Phase 3), JWT/Argon2/RBAC
(Phase 6), Redis + BullMQ, Pino, Helmet, rate limiting. See
`.ai/02_TECH_STACK.md`.

## Structure

```
api/src/
├── main.ts                 # Bootstrap: ValidationPipe, Swagger (/docs), port 3001
├── app.module.ts           # Root module: ConfigModule + Database + feature modules
└── modules/                # Modular monolith (.ai/01_ARCHITECTURE.md)
    ├── database/           # Global PrismaService (Prisma 7 + pg driver adapter)
    ├── health/             # Liveness endpoint (GET /health)
    ├── sync/               # Phase 5: entity-agnostic sync pipeline
    │   # POST /sync/push — idempotent by client op UUID; version conflicts
    │   #   recorded in sync_conflicts, never auto-overwritten
    │   # GET /sync/pull  — incremental by sync_seq cursor
    │   # EntitySyncHandler registry: feature modules register handlers
    │   #   as they migrate (Phases 6+); unknown entity types are rejected
    │   # ⚠ x-user-id header = TEMPORARY dev identity; Phase 6 replaces
    │   #   it with the JWT guard
    ├── audit/              # Global immutable audit-trail writer
    ├── auth/               # Phase 6: JWT auth
    │   # POST /auth/register|login|refresh|logout, GET /auth/me
    │   # Argon2id hashing; refresh tokens stored as SHA-256 hashes,
    │   #   single-use rotation, family revocation on reuse detection
    │   # Global fail-closed guards: JwtAuthGuard (+ @Public()) and
    │   #   RolesGuard (+ @Roles(...) RBAC baseline)
    ├── medical/            # Phase 8: evaluations (append-only) + restrictions
    │   # AES-256-GCM at rest for free-text (ADR-P006; MEDICAL_ENC_KEY env)
    │   # Sync handlers redact sensitive fields from conflict snapshots
    │   # REST: GET/POST/DELETE /medical/evaluations, GET/POST /medical/restrictions
    └── users/              # Phase 7: profile feature (first real synced entity)
        # GET/PUT /users/me/profile (REST, version-bumping upsert)
        # ProfileSyncHandler — first EntitySyncHandler registered with the
        #   sync pipeline; ownership-scoped state, payload validation
        #   mirroring DB CHECK constraints, soft deletes, audit on writes
        └── each module: presentation/ application/ domain/ infrastructure/
```

Env: `JWT_ACCESS_SECRET` (required in production; ≥32 chars),
`JWT_ACCESS_EXPIRES_IN` (default 15m), `JWT_REFRESH_EXPIRES_IN`
(default 7d). Refresh tokens are opaque random values — no second
signing secret exists.

Layer rules (per `.ai/01_ARCHITECTURE.md`): controllers live in
`presentation/` and stay thin; use cases in `application/`; business
rules in `domain/` (framework-free); Prisma/external services in
`infrastructure/`. Dependencies point inward only.

## Environment

Copy `.env.example` to `.env`. No secrets in the repo — ever
(`.ai/05_SECURITY.md`). Defaults to port **3001** so the legacy MVP
(port 3000) can run alongside during the migration.

## Database (local development)

Disposable PostgreSQL 16 via `docker-compose.yml` (host port **5433** —
5432 is commonly occupied). Local-only credentials, safe to destroy:

```
docker compose up -d          # start
npx prisma migrate dev        # apply migrations (reads DATABASE_URL from env)
npx prisma migrate status     # verify
docker compose down -v        # destroy (data is disposable)
```

Schema: `prisma/schema.prisma` (30 models). The initial migration ends
with a hand-authored raw-SQL section (sync_seq triggers, CHECK
constraints, partial indexes, audit immutability) — see
`.ai/15_DATABASE_SCHEMA_DESIGN.md`. Never edit shipped migrations.

## Commands

```
npm run start:dev     # dev server with watch (http://localhost:3001)
npm run build         # compile
npm run lint          # ESLint (--fix)
npm test              # unit tests
npm run test:e2e      # e2e tests (Supertest, no external services needed)
```

Swagger UI: http://localhost:3001/docs — Health check: GET /health

## Rules

- Read `.ai/01_ARCHITECTURE.md`, `.ai/03_CODING_STANDARDS.md`,
  `.ai/05_SECURITY.md`, and root `CLAUDE.md` before contributing.
- Never import from `server/` — the legacy MVP is read-only reference
  material (ADR-0013).
- No business logic in controllers; no `any`; typed errors only.
