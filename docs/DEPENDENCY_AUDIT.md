# AppFitness — Dependency Audit Policy & Exceptions Register

Deterministic dependency-audit policy for CI (`10_DEPLOYMENT.md` CI
pipeline / Release Checklist "Security audit reviewed").

Last reviewed: **2026-09-21** (Phase 21 candidate — refreshed against
`11f92d2`; **18 new HIGH advisories triaged, none remediated**, see below) ·
Previous review: 2026-08-05 (Phase 20 Slice 3, against `9da7482`) · Owner: Eng
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

> **Superseded by the 2026-09-21 refresh below.** The totals and exception list
> in this section describe the tree as it stood at `9da7482`; the lockfiles have
> moved since. Retained as the record of the Phase 20 remediation.

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

## Refresh 2026-09-21 (Phase 21 candidate, `11f92d2`)

Release-queue item 9. The lockfiles moved materially since the last review —
thirteen commits, including the Expo SDK 57 alignment series and the API's rate
limiting, brute-force protection and HTTP hardening — so the 2026-08-05 totals
no longer described the tree.

`npm audit --omit=dev` on the current lockfiles:

| Package | critical | high | moderate | low | total | vs 2026-08-05 |
|---|---|---|---|---|---|---|
| **api** | 0 | **11** | 1 | 0 | **12** | was 0 / 0 / 0 / 0 |
| **mobile** | 0 | **7** | 15 | 0 | **22** | was 0 / 0 / 12 / 0 |

**Critical is still 0 in both**, so the deterministic CI gate
(`--audit-level=critical`) is unaffected and every green run was honestly
green. That is also why this drift went unnoticed: the gate prints the full
advisory list non-gating, and nothing forced the eighteen HIGHs into this
register until the release queue asked for them.

**Nothing was remediated.** The policy above is explicit that this register
records findings and does not authorize `npm audit fix`, and every HIGH here
resolves only through a **semver-major** upgrade. The one exception —
`qs` — is called out separately below because it is the single finding that is
both on a live runtime path and non-breaking to fix.

### Triage — what is actually reachable

The standard this register has always applied is whether an advisory sits on a
**shipped runtime surface** or on build/dev tooling. Each group below was
resolved against the dependency graph and the source, not inferred from the
package name.

#### api — not on the runtime path

| Advisory | Path | Why it is not reachable |
|---|---|---|
| `multer` (4× DoS) | `@nestjs/platform-express → multer` | Multer only executes for a route that consumes multipart. **`api/src` registers no multipart route** — no `FileInterceptor`, `FilesInterceptor`, `AnyFilesInterceptor` or `multipart` reference exists — so no request reaches the vulnerable parser. |
| `js-yaml` (2× CPU exhaustion) | `@nestjs/swagger → js-yaml` | Swagger is behind `API_DOCS_ENABLED`, which must equal the exact string `'true'`. When it is not, neither `createDocument` nor `SwaggerModule.setup` is invoked and no docs route is registered (`src/config/api-docs.config.ts`). The flag is unset on both deployed environments. |
| `prisma`, `@prisma/config`, `deepmerge-ts`, `mysql2`, `fast-uri` | `@prisma/client → prisma → @prisma/dev → @prisma/streams-local → ajv → fast-uri`; `prisma → mysql2` | The CLI and dev-server modules. `PrismaClient` does not load them at runtime, and the API targets PostgreSQL — `mysql2` is a driver Prisma's CLI carries, never instantiated here. `prisma` is additionally a **devDependency**; it appears in a `--omit=dev` report only because npm audits the installed tree. |
| `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/swagger`, `@sentry/nestjs` | — | Flagged for **depending on** the above, not for advisories of their own. `@sentry/nestjs` is on 10.64.0 and npm's suggested "fix" of 8.19.0 is a downgrade; it is noise. |

#### api — on the runtime path

| Advisory | Path | Disposition |
|---|---|---|
| `qs` 6.15.3 — array-limit bypass via bracket-key comma parsing (GHSA-x5fp-wj9c-mxmx); DoS via attacker-controlled `isBuffer` (GHSA-4mjr-xmp4-gh2g) | `@nestjs/platform-express → express@5.2.1 → qs` | **MODERATE, and genuinely reachable** — `qs` parses the query string of every request. It is the **only** finding in this refresh that is both on a live path and has a **non-breaking** fix (`fixAvailable: true`, not semver-major). Recommended for the next owner-authorized remediation window. Not applied here: the policy requires explicit approval. Tracked as **`RISK-002`**. |

#### mobile — none on the shipped runtime

All seven HIGHs are the Metro bundler and Expo's build/prebuild tooling, traced
through `npm ls`:

- `metro`, `metro-config`, `metro-transform-worker`, `@expo/metro`,
  `image-size` → `expo → @expo/metro` (the **bundler**);
- `@xmldom/xmldom` → `expo-splash-screen → @expo/config-plugins → @expo/plist`
  (**prebuild**);
- `js-yaml` → `expo → @expo/cli → @expo/xcpretty` (iOS build-log formatter) and
  `jest-expo` (**tests**).

None execute in the shipped React Native app. This extends, rather than
replaces, the accepted MODERATE exception recorded for 2026-08-05 — the same
reasoning, a larger set, now including HIGH.

`@sentry/react-native` appears among the moderates and **is** shipped runtime,
so it was checked specifically: it carries no advisory of its own and is flagged
only `via: expo`. Its suggested "fix" of 5.15.2 is a downgrade from the
installed 10.x. No action.

### Owner decision required

Clearing the api HIGHs at source means **NestJS 11 → 12** (`@nestjs/core`,
`@nestjs/platform-express`, `@nestjs/swagger`, and `@sentry/nestjs` behind it)
and **Prisma → 6.19.3**, both semver-major, and the mobile set means an **Expo
SDK bump**. None is a dependency-audit decision; each is a framework upgrade
with its own regression surface, and the mobile one would invalidate the gate-E1
evidence captured on the current SDK.

The narrow, defensible action is the `qs` fix alone. Everything else is recorded
here as an accepted, evidence-backed exception until an upgrade is separately
authorized.

## Review cadence

Re-run and reconcile this register at each release checkpoint and whenever
`package-lock.json` changes materially. Remove exceptions once upstream
fixes land; escalate any `critical` immediately (it will already be
failing CI).
