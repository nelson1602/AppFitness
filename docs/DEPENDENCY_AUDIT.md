# AppFitness — Dependency Audit Policy & Exceptions Register

Deterministic dependency-audit policy for CI (`10_DEPLOYMENT.md` CI
pipeline / Release Checklist "Security audit reviewed").

Last reviewed: 2026-08-05 (Phase 20 Slice 3 — two HIGH prod advisories
remediated; refreshed against `9da7482` + Phases 15–17 deps) · Owner: Eng
(rotate per release)

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
  (Phase 20 Slice 3: the owner explicitly authorized the non-breaking
  `npm audit fix --omit=dev` remediation recorded below.)

## Post-remediation state (2026-08-05, Phase 20 Slice 3)

Owner-authorized, non-breaking `npm audit fix --omit=dev` was applied to both
packages (lockfile-only; no `package.json` changes). Post-remediation
`npm audit --omit=dev` totals:

| Package | critical | high | moderate | low | total |
|---|---|---|---|---|---|
| **api** | 0 | 0 | 0 | 0 | **0** |
| **mobile** | 0 | 0 | 12 | 0 | **12** |

### HIGH advisories remediated

| Pkg | Package | Advisory | Path | Fix applied |
|---|---|---|---|---|
| api | `fast-uri` 3.1.3 | Host confusion via backslash authority (GHSA-v2hh-gcrm-f6hx / GHSA-7p8r-x3mc-p8w7) | `@prisma/client → prisma → @prisma/dev → @prisma/streams-local → ajv → fast-uri` (Prisma CLI tooling, not the API runtime path) | non-breaking `npm audit fix`; api prod audit now **0** advisories |
| mobile | `brace-expansion` | ReDoS via exponential `{}` expansion | `expo → @expo/fingerprint → minimatch → brace-expansion` (build/prebuild tooling, not the shipped RN runtime) | non-breaking `npm audit fix`; HIGH cleared |

### Remaining exceptions

#### api (production deps)
None — prod audit is clean (0 advisories).

#### mobile (production deps)

| Severity | Scope | Advisory family | Disposition |
|---|---|---|---|
| MODERATE (×12) | `@expo/*` config/config-plugins & related tooling transitives (e.g. `@expo/config`, `@expo/prebuild-config`, `expo-splash-screen` plugin chain) | Various transitive advisories in Expo **build/prebuild tooling** | Accepted: these run at build/prebuild time and are **not on the shipped RN app runtime surface**; no non-breaking fix without an Expo SDK bump (`npm audit fix --force` is breaking — not applied). Track for the next Expo SDK upgrade. **Non-critical → CI gate (critical-only) unaffected.** |

## Review cadence

Re-run and reconcile this register at each release checkpoint and whenever
`package-lock.json` changes materially. Remove exceptions once upstream
fixes land; escalate any `critical` immediately (it will already be
failing CI).
