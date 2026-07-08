# AppFitness — Dependency Audit Policy & Exceptions Register

Deterministic dependency-audit policy for CI (`10_DEPLOYMENT.md` CI
pipeline / Release Checklist "Security audit reviewed").

Last reviewed: 2026-07-08 · Owner: Eng (rotate per release)

## Policy

- Both `mobile-ci` and `api-ci` run a dedicated `audit` job on
  **production** dependencies only (`npm audit --omit=dev`).
- **Gate (deterministic):** the job **fails only on `critical`**
  production advisories (`--audit-level=critical`). It first prints the
  full advisory list (non-gating) for visibility.
- The `audit` job is **not** a branch-protection required check, so a new
  high/moderate finding does not block unrelated merges — but it is
  visible on every run and must be triaged here.
- **Severity thresholds:**
  - `critical` → **blocks CI**; must be fixed or explicitly waived here
    before release.
  - `high` → **triage required**; fix via an approved upgrade or record a
    time-boxed exception below with rationale.
  - `moderate`/`low` → tracked below; addressed opportunistically.
- **No dependency upgrades are applied without explicit owner approval.**
  This register records findings; it does not authorize `npm audit fix`.

## Current exceptions (2026-07-08)

### api (production deps)

| Severity | Package | Advisory | Fix | Disposition |
|---|---|---|---|---|
| HIGH | `multer` (via `@nestjs/platform-express`) | DoS via deeply-nested field names; incomplete cleanup of aborted uploads | non-major fix available | **Triage — recommend approved upgrade** of `@nestjs/platform-express`/`multer`. Exposure is limited: the API currently defines no multipart/file-upload routes, so the DoS vectors are not reachable via existing endpoints. Fix before adding any upload route or production launch. |
| MODERATE | `prisma`, `@prisma/dev`, `@hono/node-server` | Middleware bypass via repeated slashes in Prisma's dev server (`@hono/node-server`) | only via a **major** `prisma` downgrade (7 → 6.19.3) — rejected | Accepted: these are **Prisma dev-tooling transitives** not used by the production runtime (the app serves via NestJS/Express, not `@prisma/dev`). Do not downgrade Prisma 7. Re-evaluate when Prisma ships a fix on the 7.x line. |

### mobile (production deps)

| Severity | Package | Advisory | Fix | Disposition |
|---|---|---|---|---|
| MODERATE (×) | `uuid` (transitive) | Missing buffer bounds check in v3/v5/v6 when `buf` is provided | upstream | Accepted: AppFitness code never calls `uuid` with a caller-provided `buf` (the vulnerable path); pulled transitively by Expo/tooling. Track for an Expo SDK bump. |

## Review cadence

Re-run and reconcile this register at each release checkpoint and whenever
`package-lock.json` changes materially. Remove exceptions once upstream
fixes land; escalate any `critical` immediately (it will already be
failing CI).
