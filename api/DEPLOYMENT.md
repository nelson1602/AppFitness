# AppFitness API — Deployment (ADR-P009)

Hosting: **Railway** (primary; Fly.io is the approved fallback).
Topology for Phase 12: a single **Development** environment. It also
serves as the ADR-P008 stage-2 hosted test API for EAS cloud Maestro.
Data locality: **US** unless the owner overrides before first deploy.

The image is built from `api/Dockerfile` (multi-stage, production deps
only, runs as non-root, no secrets baked in). All configuration is
injected via environment variables.

## Required environment variables

| Variable | Notes |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | Railway injects one; the app honors it (defaults to 3001) |
| `DATABASE_URL` | Railway managed PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Fresh ≥32-char random value. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_ACCESS_EXPIRES_IN` | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | `7d` |
| `MEDICAL_ENC_KEY` | Fresh base64 32-byte key (ADR-P006). Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `MEDICAL_ENC_KEY_ID` | e.g. `dev-1` |

Rules: secrets exist ONLY in Railway's variable store. Never reuse
local `.env` values, never commit values, never share keys between
environments (05_SECURITY.md).

## Railway setup (one-time, owner account required)

1. Create a Railway project `appfitness-dev` (region: US).
2. Add the **PostgreSQL** database plugin; note its `DATABASE_URL`
   reference variable.
3. Add a service from this GitHub repo with **root directory `api/`** —
   Railway detects `api/Dockerfile` automatically.
4. Set the environment variables above (reference the Postgres plugin
   for `DATABASE_URL`).
5. Set the **pre-deploy command** (runs in the built image before it
   receives traffic): `npx prisma@7 migrate deploy`
   — the image ships `prisma/` (schema + migrations) and
   `prisma.config.ts` for exactly this step.
6. Set the **health check path** to `/health`. Deployments only go live
   when it returns 200.
7. Enable database backups (Railway Postgres daily backups) and verify
   one restore before declaring the environment production-shaped.

## Migrations

- Committed migrations under `prisma/migrations/` are the only schema
  change mechanism; `prisma migrate deploy` applies pending ones and
  never generates or resets anything.
- Policy stays expand-first/additive (04_DATABASE.md): the previous
  image must be able to run against the newer schema so rollbacks stay
  one-click. Destructive migrations require an explicitly approved plan.
- Locally/CI the same step is `npm run db:deploy`.

## Rollback

1. App rollback: Railway → deployments → redeploy the previous image
   (safe by the expand-first migration policy).
2. Schema rollback is NOT automatic: write a new forward migration, or
   restore the database from a snapshot (data loss window applies —
   Development-tier data is disposable by definition).

## Local container validation

```bash
cd api
docker build -t appfitness-api .
docker compose up -d           # disposable local Postgres on 5433
docker run --rm -e NODE_ENV=production -e PORT=3001 \
  -e DATABASE_URL="postgresql://appfitness:localdev@host.docker.internal:5433/appfitness_dev" \
  -e JWT_ACCESS_SECRET="local_container_check_not_a_real_secret_000" \
  -e JWT_ACCESS_EXPIRES_IN=15m -e JWT_REFRESH_EXPIRES_IN=7d \
  -e MEDICAL_ENC_KEY="BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=" \
  -e MEDICAL_ENC_KEY_ID=local-check -p 3002:3001 appfitness-api
curl -sf http://127.0.0.1:3002/health
```

(Env values above are throwaway placeholders for the local check only.)

## Current deployment

- **Development** (the only environment, ADR-P009):
  `https://appfitness-production-1e78.up.railway.app` — verified
  2026-07-07 (health, register/login, profile write, sync pull; HTTPS
  only, plain HTTP 301-redirects). Note: "production" in the hostname is
  Railway's default *environment name*, not our environment tier — this
  deployment is Development-only and holds disposable data.

## Troubleshooting

- **`/health` 200 but every DB-touching route returns 500:** the
  database layer is failing behind the opaque error policy. Check, in
  order: (1) the service's `DATABASE_URL` is the *reference*
  `${{Postgres.DATABASE_URL}}` — a hand-typed or wrong-variable value is
  the classic cause (this exact failure occurred on first deploy);
  (2) the deploy log shows the pre-deploy step printing
  `N migrations found` — if the command line is absent, the pre-deploy
  setting didn't save.
- **Verifying a redeploy actually happened:** `GET /health` returns
  `uptimeSeconds` — a large value means the old container is still
  serving.

## Mobile/E2E tie-in

Once deployed, the hosted Development URL becomes:

- `EXPO_PUBLIC_API_URL` for internal-testing mobile builds (HTTPS —
  release builds keep cleartext blocked), and
- the ADR-P008 stage-2 target for the EAS cloud Maestro workflow
  (billing gate unchanged).
