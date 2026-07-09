# AppFitness — Release Readiness (Phase 12 walkthrough)

> Engineering audit of every `10_DEPLOYMENT.md` Release Checklist item and
> Phase 12 exit criterion against repository evidence. **Not a submission
> approval.** Legal/owner/store-console gates are called out explicitly.

Last updated: 2026-07-08 (Step 7 — in-repo release-engineering blockers
closed) · App version `0.1.0`

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
| 6 | Security audit reviewed | PASS (with tracked exceptions) | dedicated `audit` job in both CI workflows (critical-gates prod deps; prints all advisories); findings triaged in `docs/DEPENDENCY_AUDIT.md`. **No high/critical prod advisories** (multer high remediated Step 8A via platform-express 11.1.28→multer 2.2.0); remaining = api Prisma dev-transitive moderates + mobile `uuid` moderate |
| 7 | Migrations tested | PASS | `prisma migrate deploy` in api-ci e2e job + local; `account_deletion_cascade` applied & e2e-verified |
| 8 | Rollback plan exists | PASS (untested) | API rollback (`api/DEPLOYMENT.md`) + mobile store-track runbook (`docs/MOBILE_ROLLBACK.md`); both documented, not yet exercised on a live track |
| 9 | Environment variables verified | PASS (dev) | Railway Development env set; `/health` + smoke verified (Step 2B). Production/Staging env do not exist yet (N/A until created) |
| 10 | Monitoring enabled | BLOCKED (external) | Sentry wired + scrubber-tested but inert — no org/DSN (ADR-P010; owner action) |
| 11 | Logs reviewed | PENDING-HUMAN | hosted Development logs exist; no production logs to review yet |
| 12 | Store metadata ready | BLOCKED | `eas.json` `submit` profile now present (Android internal/draft, key path gitignored); still missing store-listing assets — screenshots, descriptions, categories (owner/store-console) |
| 13 | Privacy requirements satisfied | PENDING-HUMAN | deletion implemented + in-app surfaced; access/export/consent flows are drafted intent; `docs/legal/*` are Draft pending legal review |
| 14 | Smoke tests completed | PARTIAL | Maestro E2E (register / sync-on-reconnect / logout) green in CI; production/hosted smoke + monitoring checks not run |

## Phase 12 Exit Criteria (`13_MIGRATION_ROADMAP.md`)

| Criterion | Status | Evidence / gap |
|---|---|---|
| Production build passes every Release Checklist item | BLOCKED | items 10 (Sentry) & 12 (store-listing assets) open; 11/13/14 pending-human. (Items 6 and 8 resolved in Steps 7–8A.) |
| Rollback plan documented and tested | PARTIAL | API documented (untested against a live redeploy); mobile track rollback pending |
| Monitoring/error tracking (Sentry) wired up **and verified** | BLOCKED (external) | wired ✅; live verification needs org + DSNs |
| Release notes prepared | PASS (template) | reusable template `docs/RELEASE_NOTES_TEMPLATE.md`; per-release note authored at release time |
| Explicit approval before decommissioning `client/`/`server/` | N/A | not decommissioning; separate future owner gate (ADR-0013) |

## CI Pipeline coverage (`10_DEPLOYMENT.md`)

tsc ✅ · eslint ✅ · prettier ✅ · unit ✅ · integration/e2e ✅ (api e2e job) ·
build verification ✅ (expo export / nest build) · **dependency audit ✅
(critical-gated `audit` job in both workflows; Step 7)**.

## Blockers by owner

**Engineering (in-repo) — CLOSED in Step 7 (2026-07-08):**
- ~~Dependency audit in CI + recorded review~~ → `audit` job + `docs/DEPENDENCY_AUDIT.md`.
- ~~Release-notes template~~ → `docs/RELEASE_NOTES_TEMPLATE.md`.
- ~~`eas.json` `submit` profile~~ → added (Android internal/draft).
- ~~Mobile store-track rollback runbook~~ → `docs/MOBILE_ROLLBACK.md`.
- ~~`multer`/`@nestjs/platform-express` high-severity upgrade~~ → done
  (Step 8A). Remaining follow-up needing owner action: a one-time
  rollback dry-run on the first internal track.

**Owner / store-console:**
- Create Sentry org + set DSNs → live monitoring verification (item 10, exit).
- Google Play app + store listing metadata: screenshots, descriptions,
  categories, Data Safety form, privacy-policy URL (item 12).
- Create Production/Staging environments when moving beyond internal test.

**Legal / owner review:**
- `docs/legal/*` drafts (privacy, ToS, health disclaimer, Data Safety) —
  finalize wording, retention obligations, deletion claim (item 13).

## Verdicts

These four dimensions are distinct; do not conflate them.

**1. Phase 12 release-engineering: COMPLETE (in-repo).** CI (type/lint/
format/unit/integration-e2e/build/dependency-audit), migrations, the
account-deletion path, and the release scaffolding (dependency-audit
policy, release-notes template, EAS submit profile, rollback runbooks)
are done and CI-green. No high/critical prod advisories (Step 8A).

**2. Android internal-testing readiness: NOT READY — one narrowed
engineering blocker + external gates.**
- **Engineering blocker (in-repo, real — NARROWED by Phase 13):** the
  original blocker was that there was **no production UI to enter profile,
  goal, or medical/evaluation data**. Phase 13 shipped profile entry
  (Slice 1), goal entry (Slice 2), and the device-side onboarding E2E loop
  (Slice 3): a real (non-`__DEV__`) tester can now register, complete their
  profile and active goal through the dashboard gap actions, and get a
  recalculated iCoach assessment. **Remaining:** there is still **no
  on-device medical/evaluation (weight) entry UI** — `mobile/src/features/
  medical` has application/domain/infrastructure but no `presentation/`.
  Until Phase 14 adds it, a weight measurement must be supplied via sync
  (the onboarding E2E seeds it server-side with `E2E_SEED_SCOPE=
  evaluation`), so an unseeded tester cannot reach a full assessment on
  device alone. Tracked in `TEST-004` (evaluation-entry E2E) and the
  roadmap (Phase 14).
- **External gates (unchanged):** Sentry org+DSNs (monitoring
  verification), Play app + store-listing assets + Data Safety form, a
  published privacy-policy URL, legal sign-off on `docs/legal/*`.
- **Now proven (Phase 13 Slice 3):** the existing-account **login E2E**
  and the full **profile+goal onboarding loop** are covered by
  `mobile/.maestro/onboarding-loop.yml` in the `mobile-e2e` workflow.

**3. Production / store-submission readiness: NO.** All internal-testing
items plus finalized legal artifacts, a Production environment (only
Development exists), production smoke tests, mobile production validation
(push/biometric/no-debug), *tested* rollback (runbooks are documented,
not yet exercised), and the ADR-0013 decommissioning gate.

**4. Product-feature completeness vs `00_PROJECT.md` scope: PARTIAL.**
Implemented & user-accessible: authentication, dashboard (read-only
assessment), account lifecycle, offline sync (for existing entities).
Foundation/domain-only (no entry UI): profile, goal, medical/physical
evaluation. Deterministic iCoach engine: implemented, consumed read-only.
Missing entirely (no code; some have dormant schema tables): nutrition
planning, workout planning, progress monitoring, habit tracking,
notifications, settings. AI-assisted coaching: deferred by scope. See the
missing-feature matrix and continuation phases in
`.ai/13_MIGRATION_ROADMAP.md`. (No completion percentage is asserted —
counts of built vs unbuilt capabilities only.)
