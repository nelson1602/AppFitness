# AppFitness — Release Readiness (Phase 12 walkthrough)

> Engineering audit of every `10_DEPLOYMENT.md` Release Checklist item and
> Phase 12 exit criterion against repository evidence. **Not a submission
> approval.** Legal/owner/store-console gates are called out explicitly.

Last updated: 2026-07-08 · Evidence commit: `deeff55` (origin/main;
mobile-ci + api-ci green) · App version `0.1.0`

Legend: **PASS** · **BLOCKED** (engineering/asset gap) · **PENDING-HUMAN**
(needs owner/legal/store action) · **N/A**.

## Release Checklist (`10_DEPLOYMENT.md`)

| # | Item | Status | Evidence / gap |
|---|---|---|---|
| 1 | CI passes | PASS | mobile-ci + api-ci green on `deeff55`; branch protection requires all 4 checks |
| 2 | Tests pass | PASS | mobile 236; api 39 unit + 4 e2e (incl. account-deletion e2e) |
| 3 | TypeScript passes | PASS | `tsc --noEmit` both packages |
| 4 | Lint passes | PASS | expo lint / eslint `--max-warnings 0` |
| 5 | Formatting passes | PASS | prettier `--check` both packages |
| 6 | Security audit reviewed | BLOCKED | no `npm audit` step in CI and no recorded dependency-audit review (both packages) |
| 7 | Migrations tested | PASS | `prisma migrate deploy` in api-ci e2e job + local; `account_deletion_cascade` applied & e2e-verified |
| 8 | Rollback plan exists | PARTIAL | API rollback documented (`api/DEPLOYMENT.md`); mobile store-track rollback not yet documented/tested |
| 9 | Environment variables verified | PASS (dev) | Railway Development env set; `/health` + smoke verified (Step 2B). Production/Staging env do not exist yet (N/A until created) |
| 10 | Monitoring enabled | BLOCKED (external) | Sentry wired + scrubber-tested but inert — no org/DSN (ADR-P010; owner action) |
| 11 | Logs reviewed | PENDING-HUMAN | hosted Development logs exist; no production logs to review yet |
| 12 | Store metadata ready | BLOCKED | app icons/splash only; no screenshots/descriptions/categories; no `eas.json` `submit` profile |
| 13 | Privacy requirements satisfied | PENDING-HUMAN | deletion implemented + in-app surfaced; access/export/consent flows are drafted intent; `docs/legal/*` are Draft pending legal review |
| 14 | Smoke tests completed | PARTIAL | Maestro E2E (register / sync-on-reconnect / logout) green in CI; production/hosted smoke + monitoring checks not run |

## Phase 12 Exit Criteria (`13_MIGRATION_ROADMAP.md`)

| Criterion | Status | Evidence / gap |
|---|---|---|
| Production build passes every Release Checklist item | BLOCKED | items 6, 8(mobile), 10, 12 open; 11/13/14 pending-human |
| Rollback plan documented and tested | PARTIAL | API documented (untested against a live redeploy); mobile track rollback pending |
| Monitoring/error tracking (Sentry) wired up **and verified** | BLOCKED (external) | wired ✅; live verification needs org + DSNs |
| Release notes prepared | BLOCKED | no release-notes/CHANGELOG template exists |
| Explicit approval before decommissioning `client/`/`server/` | N/A | not decommissioning; separate future owner gate (ADR-0013) |

## CI Pipeline coverage (`10_DEPLOYMENT.md`)

tsc ✅ · eslint ✅ · prettier ✅ · unit ✅ · integration/e2e ✅ (api e2e job) ·
build verification ✅ (expo export / nest build) · **dependency audit ✗
(missing — see item 6)**.

## Blockers by owner

**Engineering (no external dependency) — can close in-repo:**
- Dependency audit in CI + recorded review (item 6 / CI pipeline).
- Release-notes/CHANGELOG template (exit criterion).
- `eas.json` `submit` profile (item 12, partial).
- Mobile store-track rollback runbook (item 8).

**Owner / store-console:**
- Create Sentry org + set DSNs → live monitoring verification (item 10, exit).
- Google Play app + store listing metadata: screenshots, descriptions,
  categories, Data Safety form, privacy-policy URL (item 12).
- Create Production/Staging environments when moving beyond internal test.

**Legal / owner review:**
- `docs/legal/*` drafts (privacy, ToS, health disclaimer, Data Safety) —
  finalize wording, retention obligations, deletion claim (item 13).

## Verdicts

**Internal-testing readiness: NOT YET — close engineering blockers + the
external gates.** The app itself is functionally ready (builds via the
`production`/`preview` profiles, hosted Development API verified, auth /
dashboard / sync / account-deletion working and E2E-proven). Before an
honest Play **internal-testing** track: Sentry live verification, release
notes, `submit` profile + minimal store listing, dependency audit, and a
privacy-policy URL. Play's internal track still requires the Data Safety
form and a privacy policy, so legal review is on this path too.

**Production / store-submission readiness: NO.** All internal-testing
items plus: finalized legal artifacts, a Production environment (only
Development exists), production smoke tests, mobile production validation
(push/biometric/no-debug), tested rollback, and the ADR-0013
decommissioning gate remain.
