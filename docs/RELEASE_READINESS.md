# AppFitness — Release Readiness (Phase 20 Store-Submission Re-Gate)

> Engineering re-audit of every `10_DEPLOYMENT.md` Release Checklist item and
> the Phase 20 exit criteria against current repository evidence. **Not a
> submission approval.** Legal / owner / store-console gates are called out
> explicitly and remain the owner's to close.

Last updated: 2026-08-05 (Phase 20 Slice 1 — docs-only re-gate audit) ·
Main commit `d5fa45c` · App version `0.1.0` (`mobile/app.json`) ·
Target publication: 2026-08-20.

> **Supersedes** the 2026-07-08 Phase 12 walkthrough. That edition predated
> Phases 13.5–17 and is stale: it listed nutrition / workout / progress
> monitoring as "missing entirely (no code)" and cited `236` mobile tests on
> commit `deeff55`. Both are corrected below against `d5fa45c`.

Legend:
- **PASS** — satisfied, evidence in-repo/CI.
- **BLOCKED-OWNER** — needs an owner account/asset/environment action (Sentry
  org, Play Console, Production env, live track, submission approval).
- **BLOCKED-EXTERNAL** — depends on an external party (legal counsel, store
  review).
- **PENDING-HUMAN** — needs a human review/authoring step not yet done.
- **WAIVED** — explicitly out of scope (documented).
- **N/A** — not applicable yet.

## Current engineering evidence (`d5fa45c`)

- **CI:** all required checks green on `d5fa45c` — `api-ci` (Prisma, type-check,
  lint, format, unit tests, build; Migrations + e2e against disposable Postgres;
  dependency audit) and `mobile-ci` (type-check, lint, format, tests; Expo doctor
  + bundle export; dependency audit). Branch protection requires the 4 gate
  checks.
- **Mobile tests:** 120 suites / 859 tests green (`mobile` jest).
- **API tests:** unit + e2e suites green in the `api-ci` "Migrations + e2e
  against disposable Postgres" job (includes the account-deletion cascade e2e).
- **Mobile E2E (cloud):** manual `mobile-e2e` run
  [31008855392](https://github.com/nelson1602/AppFitness/actions/runs/31008855392)
  = **success** on `d5fa45c`, exercising 12 Maestro flows on an Android emulator
  against a seeded local API: `smoke-auth-surface`, `registration`,
  `dashboard-sync`, `onboarding-loop`, `food-log`, `food-log-exclusion-warning`,
  `medical-management`, `workout-training-plan`, `workout-custom-exercise`,
  **`progress-monitoring`**, `offline-entry`, `reconnect-sync`.
- **Feature scope:** Phases 13–17 complete and merged (profile/goal entry,
  medical/physical evaluation entry, nutrition, workout, **progress monitoring**
  incl. deterministic weekly snapshots + entry UI + trend visualizations +
  dashboard card, E2E-verified). Phases 18 (Habit Tracking) and 19
  (Notifications) are **post-v1** per `13_MIGRATION_ROADMAP.md` — not required for
  this submission.

## Release Checklist (`10_DEPLOYMENT.md`)

| # | Item | Status | Evidence / gap |
|---|---|---|---|
| 1 | CI passes | **PASS** | all required checks green on `d5fa45c`; branch protection enforces the gate checks |
| 2 | Tests pass | **PASS** | mobile 120 suites / 859 tests; api unit + e2e green in `api-ci` |
| 3 | TypeScript passes | **PASS** | `tsc --noEmit` both packages (CI) |
| 4 | Lint passes | **PASS** | expo lint / eslint `--max-warnings 0` (CI) |
| 5 | Formatting passes | **PASS** | prettier `--check` both packages (CI) |
| 6 | Security audit reviewed | **PASS** (tracked exceptions) | dependency-audit job in both CI workflows (critical-gated on prod deps); triage in `docs/DEPENDENCY_AUDIT.md`; no high/critical prod advisories at last audit. *Follow-up: the audit triage predates Phases 15–17 dep changes — a refresh pass is advisable before submission (not a blocker; CI gate remains green).* |
| 7 | Migrations tested | **PASS** | `prisma migrate deploy` in the `api-ci` e2e job + local; account-deletion cascade applied & e2e-verified |
| 8 | Rollback plan exists | **PASS** (plan) / **BLOCKED-OWNER** (tested) | API rollback (`api/DEPLOYMENT.md`) + mobile store-track runbook (`docs/MOBILE_ROLLBACK.md`) documented; **not yet exercised on a live track** — dry-run is an owner action |
| 9 | Environment variables verified | **PASS** (dev) / **BLOCKED-OWNER** (prod) | Railway Development env set; `/health` + smoke verified. **Production/Staging environments do not exist yet** — owner must create |
| 10 | Monitoring enabled | **BLOCKED-OWNER** | Sentry wired + scrubber-tested but inert — no org/DSN (ADR-P010); owner must provision org + DSNs and verify a live event |
| 11 | Logs reviewed | **PENDING-HUMAN** | hosted Development logs exist; no production logs to review yet |
| 12 | Store metadata ready | **BLOCKED-OWNER** | `eas.json` `submit` profile present (Android internal/draft); **missing** store-listing assets (screenshots, descriptions, categories), Data Safety form, and a published privacy-policy URL — owner / store-console |
| 13 | Privacy requirements satisfied | **BLOCKED-EXTERNAL** | account deletion implemented + in-app surfaced (PASS); `docs/legal/*` (privacy, ToS, health disclaimer, Data Safety, data inventory) **refreshed to Phases 13–17 in Phase 20 Slice 2 (2026-08-05)** — now review-ready; still **BLOCKED-EXTERNAL pending legal sign-off** |
| 14 | Smoke tests completed | **PARTIAL** — **PASS** (cloud E2E) / **BLOCKED-OWNER** (production) | 12-flow Maestro `mobile-e2e` green on `d5fa45c` (run 31008855392); **Production Smoke + Mobile Production Validation not run** (need a deployed prod backend + a closed/prod-track build) |

## Additional `10_DEPLOYMENT.md` release gates

| Gate | Status | Evidence / gap |
|---|---|---|
| Production Smoke Tests (10 checks: backend health, auth, profile, SQLite init, dashboard, iCoach recs, offline, sync init, reconnect sync, no critical monitoring errors) | **BLOCKED-OWNER** | requires a deployed Production backend + monitoring — none yet |
| Mobile Production Validation (10 checks: open, login, nav, dashboard, offline, push permissions, SecureStore, biometric-if-enabled, no debug info, store build matches env) | **BLOCKED-OWNER** | requires a closed/production-track build on a real device |
| Release Notes | **PASS** (template) / **PENDING-HUMAN** (v1 note) | reusable `docs/RELEASE_NOTES_TEMPLATE.md`; the v1 note (version/date/features/fixes/breaking/migration/known-issues/rollback) must be authored at release time |

## Phase 20 Exit Criteria (`13_MIGRATION_ROADMAP.md`)

| Criterion | Status | Evidence / gap |
|---|---|---|
| `docs/RELEASE_READINESS.md` matrix all PASS or explicitly waived | **IN PROGRESS** | in-repo engineering items PASS; open gates are all BLOCKED-OWNER / BLOCKED-EXTERNAL / PENDING-HUMAN (see below) |
| internal → closed → production track progression validated | **BLOCKED-OWNER** | no track progression exercised yet |

## Owner / external action list (unresolved gates)

Each item is outside the repo's control and must be completed by the owner or an
external party before submission. **None performed in this audit.**

1. **Sentry** (item 10) — **BLOCKED-OWNER**: create org, set backend + mobile
   DSNs, confirm a live event ingests (per ADR-P010).
2. **Legal sign-off** (item 13) — **BLOCKED-EXTERNAL**: finalize + approve
   `docs/legal/{PRIVACY_POLICY,TERMS_OF_USE,HEALTH_DISCLAIMER,PLAY_DATA_SAFETY,DATA_INVENTORY}.md`.
3. **Play Console** (item 12) — **BLOCKED-OWNER**: create the app; upload
   listing assets (screenshots, descriptions, categories); complete the Data
   Safety form; publish a privacy-policy URL.
4. **Production / Staging environment** (item 9) — **BLOCKED-OWNER**: provision
   + set secrets; only Development exists today.
5. **Rollback dry-run** (item 8) — **BLOCKED-OWNER**: exercise the API +
   mobile-track rollback runbooks on the first internal track.
6. **Production Smoke** (item 11/14) — **BLOCKED-OWNER**: run the 10-check smoke
   against the deployed production backend + review logs.
7. **Mobile Production Validation** (item 14) — **BLOCKED-OWNER**: run the
   10-check validation on a closed/production-track build (push, SecureStore,
   biometric, no-debug, store-build-matches-env).
8. **Release notes + submission approval** — **PENDING-HUMAN**: author the v1
   release note from the template and record explicit owner submission approval.

## Verdicts (four distinct dimensions — do not conflate)

**1. In-repo release engineering: COMPLETE and green on `d5fa45c`.** CI
(type/lint/format/unit/integration-e2e/build/dependency-audit), migrations, the
account-deletion path, and the release scaffolding (dependency-audit policy,
release-notes template, EAS submit profile, rollback runbooks) are done and
CI-green. The 12-flow Maestro `mobile-e2e` suite passes end-to-end in the cloud.

**2. Feature completeness for commercial v1: MET.** Phases 13–17 are merged and
E2E-verified: device-side profile/goal entry, medical/physical evaluation entry +
management, nutrition module, workout module (+ read-only TrainingPlan), and
progress monitoring (deterministic weekly snapshots, entry UI, in-house trend
charts, dashboard card). Phases 18 (Habit) and 19 (Notifications) are post-v1 and
correctly out of scope; AI-assisted coaching is deferred by scope.

**3. Production / store-submission readiness: NOT YET.** All open gates are
owner/external: Sentry live verification, finalized legal artifacts, a Production
environment, Play listing + Data Safety + privacy URL, a *tested* rollback,
production smoke, and mobile production validation. See the action list above.

**4. Audit scope honored.** This is a docs-only re-gate: no legal approval
recorded, no Play submission, no Sentry enablement, no production deploy, and no
rollback test executed. Statuses reflect current repository evidence only.
