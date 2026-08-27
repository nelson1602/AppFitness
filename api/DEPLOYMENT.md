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
| `SENTRY_DSN` | Optional (ADR-P010). Sentry is fully disabled when unset; all events pass privacy scrubbers |
| `SENTRY_ENVIRONMENT` | e.g. `development` |
| `WEB_CORS_ORIGINS` | Optional (ADR-P018 Slice 3). Comma-separated EXACT browser origins for interim Web Bearer auth (no wildcard/path/trailing slash). Unset/empty ⇒ fail-closed (no cross-origin browser access; native unaffected). Configure per environment. For local Expo Web QA set it on the **Development** service only: `http://localhost:8081,http://127.0.0.1:8081`. Leave **Production** unset unless a hosted Web origin is approved |
| `API_DOCS_ENABLED` | Optional (H-2). Swagger UI (`/docs`) + OpenAPI JSON (`/docs-json`) are served ONLY when this is the exact string `true`; any other value (unset, empty, `false`, `TRUE`, `1`, …) keeps them disabled. Intended for LOCAL development only. **Leave unset on BOTH hosted tiers** so the API surface is never published in Development or Production. Generate the OpenAPI spec locally (flag on) for client codegen rather than serving it live |
| `MAIL_PROVIDER` | Optional (ADR-P026 Vertical 1). `disabled` (default when unset) or `postmark`. While `disabled`, `POST /auth/forgot-password` answers a single generic `503` **before any account lookup** — it never pretends a message was sent. Setting `postmark` REQUIRES the four `POSTMARK_*` / `MAIL_*` values below; a missing or malformed one **throws at boot** rather than starting a mailer that silently drops mail |
| `POSTMARK_SERVER_TOKEN` | Required when `MAIL_PROVIDER=postmark`. Postmark **server** token. Secret — never logged, never included in an error. **Set on Development first** and validate against the provider sandbox before Production (ADR-P026 Decision 17) |
| `MAIL_FROM_ADDRESS` | Required when enabled. A single bare address on the **owned sending subdomain** with SPF/DKIM/DMARC verified, e.g. `no-reply@mail.<owned-domain>`. Display names and lists are rejected |
| `MAIL_PUBLIC_BASE_URL` | Required when enabled. **HTTPS only** (plain HTTP is refused — a reset link is a bearer credential), no query string, no fragment, no embedded credentials. Reset links are built as `<base>/reset-password#token=…` — the token is in the **URL fragment**, which never reaches a server or proxy log. The path resolves to the Expo Web fallback route. A trailing slash is normalized away |
| `POSTMARK_MESSAGE_STREAM` | Optional; defaults to `outbound`. Must be a **transactional** stream — never a broadcast one |

Rules: secrets exist ONLY in Railway's variable store. Never reuse
local `.env` values, never commit values, never share keys between
environments (05_SECURITY.md).


## Transactional email activation (ADR-P026 Vertical 1)

Password recovery ships **inert**: with `MAIL_PROVIDER` unset the code path is
present, tested, and fail-closed, and no message can leave the process. Turning
it on is a sequence of owner actions that ADR-P026 deliberately does **not**
authorize on its own:

1. **Own a domain** and create a **sending subdomain** (e.g. `mail.<domain>`).
2. Configure and verify **SPF, DKIM and DMARC** on that subdomain — required
   *before* any Development-live send.
3. Create the **Postmark** account and choose a plan; use a **transactional**
   message stream.
4. Set `MAIL_PROVIDER=postmark` plus the three required values on the
   **Development** service only, and validate against the **provider sandbox**.
5. Replace the privacy-contact placeholder in `docs/legal/PRIVACY_POLICY.md`
   before AppFitness sends mail in its own name.
6. Only then repeat on **Production** with its own separate token.

Five properties are worth keeping in mind when operating this:

- **CI never sends email.** `FakeMailTransport` is the only transport bound in
  unit and e2e tests; the Postmark adapter is unreachable from a test run.
- **Emailed links need `MAIL_PUBLIC_BASE_URL` to point at a surface that serves
  the Expo Web export**, because `/reset-password` is the Web fallback route.
  Native **Universal / App Links** — which would let the same HTTPS link open
  the installed app — require domain ownership plus a **native rebuild** and are
  NOT configured (`app.json` declares no `intentFilters`/`associatedDomains`).
  Until then a tapped link opens the Web page, while the app's own
  `appfitness://reset-password?token=…` scheme handles in-app navigation. The
  native scheme keeps a query parameter deliberately: a custom-scheme URL is
  handed straight to the app by the OS and never traverses an HTTP server or
  proxy, so there is no log to leak into.
- **The token travels in the URL fragment (`#token=…`), and provider click
  tracking MUST stay off for this stream.** A fragment is never placed in the
  HTTP request-line, so it cannot land in the web server's access log, a
  reverse-proxy log, or a `Referer` header — which is exactly why a `?token=`
  query string was rejected. A click-tracking redirect rewrites the href, and a
  rewritten URL is not guaranteed to carry the fragment through: enabling
  tracking on this stream would silently break every reset link. Verify tracking
  is disabled before the first Development-live send.
- **Delivery is best-effort, not guaranteed.** Sends are dispatched outside the
  request path (so provider latency cannot become an account-enumeration timing
  signal), with **no persistence, no retry, and no dead-letter path** — ADR-P026
  Decision 12 rules out a queue. A send in flight is lost if the process
  crashes, is OOM-killed, or is hard-killed; a provider error is logged and
  dropped. `drain()` runs on `SIGTERM` via Nest's shutdown hook, which covers an
  ordinary Railway deploy replacement but not a hard kill. The user-visible
  failure is an email that never arrives after a `202`; the remedy is to request
  another link. A durable outbox is the real fix and needs its own decision.
- **Rapid repeat requests: multiple emails, only the newest link works.** Each
  issuance invalidates the account's previous reset token, and a partial unique
  index enforces at most one active token per user. If someone taps "send reset
  link" several times in quick succession they will receive **several emails**,
  and because sends are dispatched outside the request path they **may arrive
  out of order** — the newest link is not necessarily the last one to land in
  the inbox. Only the **most recently issued** token is still valid; opening a
  superseded link shows the generic "this link no longer works" state and the
  user must request another one. This is neither guaranteed nor ordered
  delivery: the ordering above is unmanaged, and the delivery caveat in the
  previous bullet still applies to every one of those messages. The per-account
  ceiling (5/hour) bounds how many can be produced.

## Railway setup (one-time, owner account required)

1. Create a Railway project `appfitness-dev` (region: US).
2. Add the **PostgreSQL** database plugin; note its `DATABASE_URL`
   reference variable.
3. Add a service from this GitHub repo with **root directory `api/`** —
   Railway detects `api/Dockerfile` automatically.
4. Set the environment variables above (reference the Postgres plugin
   for `DATABASE_URL`).
5. Set the **pre-deploy command** (runs in the built image before it
   receives traffic): **`npm run db:deploy`** (= `prisma migrate deploy`).
   The runtime image ships `prisma/` (schema + migrations) and
   `prisma.config.ts`, and `npm ci --omit=dev` installs the **Prisma CLI at
   the lockfile-pinned version** (the lockfile resolves `prisma` into the
   production tree). So this command runs the **image-resident** CLI and
   resolves its version **locally, with no registry access at deploy time**.
   Note: the older command `npx prisma@7 migrate deploy` floats the CLI
   version and reaches npm on every deploy — avoid it.
   The Docker build **intentionally fails** (via a runtime-stage assertion)
   if a future lockfile change drops the CLI from the production tree, so
   this can never regress silently to a deploy-time failure.
   **Railway's live pre-deploy setting is NOT changed by this commit;** it
   is updated to `npm run db:deploy` in a separate, Development-first
   rollout step (see the deterministic-CLI rollout notes).
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
- Locally/CI the same step is `npm run db:deploy`. The production runtime
  image already contains the lockfile-pinned Prisma CLI (installed by
  `npm ci --omit=dev`), so this command is also the deterministic pre-deploy
  step in Railway — no floating version, no deploy-time download. A
  runtime-stage build assertion fails the image if that CLI ever goes
  missing, keeping the guarantee enforced without pinning a second version.

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

- **Production** (created 2026-08-05, Phase 20 Gate B1):
  `https://appfitness-production-5cfa.up.railway.app` — API + PostgreSQL
  online (US West); `/health` = 200 (independently confirmed); 10 migrations
  applied, none pending; deployed commit `4ee52a1`. Railway project
  `68c0d53d-9c53-4f12-8482-be35da190d25` · API deployment
  `0416691a-5a32-491c-b584-b9e9da5b4754`. Fresh production secrets set in the
  Railway variable store (never reused from Development; values not recorded
  here). **Backups/PITR WAIVED (owner-approved 2026-08-05):** Railway daily
  backups require the Pro plan — owner declined the upgrade; no automated
  backups and no restore test performed (data-loss risk accepted for v1).
  Rollback therefore relies on redeploy-previous under the expand-first
  migration policy (§ Rollback), not on DB snapshot restore.
- **Development** (the original environment, ADR-P009):
  `https://appfitness-production-1e78.up.railway.app` — verified
  2026-07-07 (health, register/login, profile write, sync pull; HTTPS
  only, plain HTTP 301-redirects). Note: "production" in the hostname is
  Railway's default *environment name*, not our environment tier — this
  deployment is Development-only and holds disposable data. Left untouched
  by the Production setup.

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
