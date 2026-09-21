# AppFitness — Release Readiness (current re-gate)

> Engineering re-audit of every `10_DEPLOYMENT.md` Release Checklist item and
> the Phase 20 exit criteria against current repository evidence. **Not a
> submission approval.** Legal / owner / store-console gates are called out
> explicitly and remain the owner's to close.

Last reconciled: **2026-09-15** · Current `main` baseline **`d498658`** ·
App version `1.0.0` · Publication date: **not set**.

> **Partial reconciliation, 2026-09-15 (`051aecd`).** Stage 1 item 1, the
> localization evidence line, the open-defect list and verdict 2 were updated by
> the exhaustive bilingual surface audit
> (`.ai/21_BILINGUAL_SURFACE_AUDIT.md`). That change also moves the mobile
> suite to **195 suites / 2618 tests** and the catalogues to 1063 keys. No
> other row was re-verified against `051aecd`; the rest of this matrix still
> describes `d498658`.

> **Partial reconciliation, 2026-09-16 (`96c81df`).** Stage 1 item 2, the
> localization evidence line and verdict 2 were updated by the bilingual
> **quality** review (`.ai/22_BILINGUAL_QUALITY_REVIEW.md`). Unlike the two
> reconciliations above it is **not documentation-only**: it migrates the 43
> inventoried user-facing numeric renders onto the shared formatter, corrects
> two catalogue values, and adds a compiler-backed regression spec. The
> mobile suite moves to **196 suites / 2631 tests**; the catalogues stay at
> **1063 / 1063**. No other row was re-verified against `96c81df`.

> **Partial reconciliation, 2026-09-16 (`606c3e7`).** §Web boundary, the open-
> defect list, §Future tracks, Stage 1 item 1 and verdict 2 were updated by the
> **Web document-shell slice** — `BUG-016` (now **Done**) and **ADR-P032**, which
> also records the owner-approved public-V1 Web boundary. Like the previous
> reconciliation it is **not documentation-only**: it adds `app/+html.tsx` with a
> pre-hydration language correction, the Web document title, a bilingual product
> `+not-found` screen, four catalogue keys and an artifact gate
> (`npm run verify:web-export`). The mobile suite moves to **200 suites / 2684
> tests**; the catalogues move to **1067 / 1067**, still at exact parity. No
> other row was re-verified against `606c3e7`.

> **Partial reconciliation, 2026-09-17 (`ef8b181`).** Stage 2 gate 6, §Web
> boundary and the open-defect list were updated by **pass 2** of the light/dark
> per-surface verification (`.ai/23_THEME_SURFACE_VERIFICATION.md`). It closes
> the five native gaps pass 1 left open — populated rows, `TrendBars`,
> `WeeklySnapshotSummary`, `GeneratedWorkoutPlan` and the conflict card — with
> 40 native captures from the same verified build, and covers the three public
> Web portals at four widths, where it found **`BUG-017`**: the portals do not
> render dark mode. Like the first two reconciliations above it is
> **documentation plus test-only tooling**: three `mobile/e2e/theme-*.mjs`
> harnesses and one staging Maestro flow, no product source, no dependency, no
> lockfile, no schema, no configuration and no hosted service. Test counts are
> unchanged. No other row was re-verified against `ef8b181`.

## What this edition changed

This is a **documentation-only reconciliation**. It changes no runtime code,
test, dependency, schema, migration, configuration, infrastructure, secret or
external service. It rebaselines stale facts and resolves contradictions the
previous edition carried:

- **Baseline and counts rebaselined.** The header cited `efd75ff9` and the
  evidence section cited `d5fa45c` with **120 suites / 859 tests**. Current
  `main` is **`d498658`** with **194 mobile suites / 2598 mobile tests** and
  **43 API suites / 606 API unit tests** (plus the API e2e job).
- **Production contradiction resolved.** Item 9 recorded Railway Production as
  created and verified on 2026-08-05, while the owner action list simultaneously
  said "only Development exists today". **Production exists**; the owner-list
  line was stale. **Staging** still does not exist (optional).
- **Transactional email reconciled.** Password recovery *and* email verification
  are both Production-validated, and **FEATURE-011 is Done**. The owner list
  previously described the prerequisites as "PARTLY SATISFIED (Vertical 1)".
- **Conflict resolution reconciled.** ADR-P030 **C-0 … C-7 are all implemented**
  and **BUG-012 is Done** (2026-09-15, PR #155). Documents that described it as
  absent or unauthorized are corrected in `.ai/**`.
- **E2E evidence marked stale.** The cloud `mobile-e2e` evidence is from
  **2026-08-05 on `d5fa45c`** and has **not** been re-run since. It predates
  medical decoupling, the bilingual work, the Wellness Safety Profile and
  conflict resolution, so it **does not describe `main`**. See gate E1.
- **Web boundary recorded** (new section below), replacing any implication of
  Web app parity.

Historical Phase 20 gate records are preserved as **historical**; where a dated
record's status clause had expired it is marked, not rewritten.

**Where the detailed evidence lives.** This document is the matrix. The
underlying gate evidence — Railway project/deployment identifiers, EAS build
identifiers, Sentry issue and event references, and the B1–B6 owner-gate records
— stays in `docs/PHASE20_EXTERNAL_GATES.md`. The transactional-email V-gate
evidence, including the Cloudflare Worker versions and Railway deployments
behind each portal, stays in `.ai/11_BACKLOG.md` under **FEATURE-011**. This
edition stopped duplicating those identifiers here; none was removed from its
owning record.

Legend:
- **PASS** — satisfied, evidence in-repo/CI.
- **STALE** — was PASS on an older commit; the evidence no longer describes `main`.
- **BLOCKED-OWNER** — needs an owner account/asset/environment action.
- **BLOCKED-EXTERNAL** — depends on an external party (legal counsel, store review).
- **PENDING-HUMAN** — needs a human review/authoring step not yet done.
- **WAIVED** — explicitly out of scope (documented).

## Current engineering evidence (on `d498658`)

- **CI:** `api-ci` (Prisma, type-check, lint, format, unit tests, build;
  migrations + e2e against disposable Postgres; dependency audit) and
  `mobile-ci` (type-check, lint, format, tests; Expo doctor + bundle export;
  dependency audit) are **green on `d498658`**, verified post-merge.
- **Mobile tests:** **194 suites / 2598 tests**.
- **API tests:** **43 suites / 606 unit tests**, plus the e2e suite in the
  `api-ci` "Migrations + e2e against disposable Postgres" job.
- **Localization:** **1063 EN / 1063 ES keys at exact parity** (0 keys on either
  side only), verified against the shipped catalogues. Parity is no longer the
  only evidence: `.ai/21_BILINGUAL_SURFACE_AUDIT.md` (2026-09-15) traces every
  key to a surface and every public-v1 surface back to the catalogue, and
  `mobile/src/shared/localization/surface-coverage.spec.ts` keeps that proof
  from regressing. **Locale formatting is now evidenced too**
  (`.ai/22_BILINGUAL_QUALITY_REVIEW.md`, 2026-09-16): all 43 user-facing numeric
  renders that bypassed the shared formatter now use it, `Intl` is constructed
  in one module, every public display date is still on `formatDate`, and
  `mobile/src/shared/localization/localized-formatting.spec.ts` fails the build
  if a rendered number bypasses it again. **Wording is reviewed, not certified**:
  1063 key pairs were read in both languages, three values changed, and six
  decisions are recorded as `OBS-BQR-1 … OBS-BQR-6`.
- **Migrations:** **16** Prisma migrations; **7** SQLite migrations (001–007).
- **Conflict resolution (ADR-P030):** C-0 … C-7 implemented. C-7 drove **14
  Maestro journeys across two Android emulators** against a disposable local
  stack — 78 steps, 78 passes, no retries — covering ten authorized
  requirements with every device outcome checked against account state. This is
  a **manual two-device** suite, documented in `mobile/e2e/README.md`; it is
  **not** part of the CI E2E job.
- **Feature scope:** Phases 13–17 complete and merged. Phase 21 is **in
  progress** (see `13_MIGRATION_ROADMAP.md`). Phases 18 (Habit Tracking) and 19
  (Notifications) are **post-v1**.

## Release Checklist (`10_DEPLOYMENT.md`)

| # | Item | Status | Evidence / gap |
|---|---|---|---|
| 1 | CI passes | **PASS** | all required checks green on `d498658`; branch protection enforces the gate checks |
| 2 | Tests pass | **PASS** | mobile 194 suites / 2598 tests; api 43 suites / 606 unit tests + e2e green in `api-ci` |
| 3 | TypeScript passes | **PASS** | `tsc --noEmit` both packages (CI) |
| 4 | Lint passes | **PASS** | expo lint / eslint `--max-warnings 0` (CI) |
| 5 | Formatting passes | **PASS** | prettier `--check` both packages (CI) |
| 6 | Security audit reviewed | **STALE** | the dependency-audit **job** runs in both CI workflows and is critical-gated on prod deps, so the gate itself is live. The **triage** in `docs/DEPENDENCY_AUDIT.md` is dated **2026-08-05**, and `mobile/package-lock.json` has changed several times since (Expo SDK 57 patch alignment). The recorded post-remediation state — api 0 advisories, mobile 12 moderate, 0 high/critical — **has not been re-verified against the current lockfiles**. Needs a refreshed triage before submission. |
| 7 | Migrations tested | **PASS** | `prisma migrate deploy` in the `api-ci` e2e job; account-deletion cascade applied and e2e-verified |
| 8 | Rollback plan exists | **PASS** (plan) / **BLOCKED-OWNER** (tested) | API rollback (`api/DEPLOYMENT.md`) + mobile store-track runbook (`docs/MOBILE_ROLLBACK.md`) documented; **never exercised on a live track**. **Note (B1 waiver):** the DB snapshot/restore fallback is unavailable in Production (no backups/PITR — item 9), so backend rollback relies on redeploy-previous under the expand-first migration policy. |
| 9 | Environment variables verified | **PASS** (dev + prod) / **WAIVED** (backup/restore) | Railway **Production exists** — created and verified 2026-08-05 (Gate B1): distinct from Development, API + PostgreSQL online, `/health` = 200 independently confirmed, migrations applied with none pending, post-merge CI green. Fresh prod secrets set (names per `api/DEPLOYMENT.md`; values not recorded). **WAIVER (owner-approved 2026-08-05):** Railway daily backups / PITR require the Pro plan; the owner declined the paid upgrade, so **no automated backups and no restore test exist** for v1 — data-loss risk explicitly accepted. *Restore verification is NOT claimed.* **Staging was never created** (optional). |
| 10 | Monitoring enabled | **PASS (backend + mobile)** | Backend enabled and live-verified 2026-08-05 (Gate B2); mobile enabled and live-verified 2026-08-06 (Gate B2-mobile) with source-map upload succeeding, symbolicated frames, and synthetic `notes`/`token` values arriving redacted. The verified events contained **no PHI, no authentication token and no user-entered health data**. See `docs/SENTRY_ENABLEMENT.md`. **Caveat:** verified on the Phase 20 build, not on a `d498658` build. |
| 11 | Logs reviewed | **PENDING-HUMAN** | Production has existed since 2026-08-05, so production logs now exist; **no production log / monitoring-error review has been performed**. |
| 12 | Store metadata ready | **BLOCKED-OWNER** | `eas.json` `submit` profile present (Android internal/draft); **missing** store-listing assets (screenshots, descriptions, categories), Data Safety form, and a published privacy-policy URL |
| 13 | Privacy requirements satisfied | **BLOCKED-EXTERNAL** | account deletion implemented and in-app surfaced (PASS); `docs/legal/{PRIVACY_POLICY,TERMS_OF_USE,HEALTH_DISCLAIMER,PLAY_DATA_SAFETY,DATA_INVENTORY}.md` refreshed 2026-08-05 and review-ready. **Still blocked pending legal sign-off**, and the legal set has **not** been refreshed for Phase 21 (wellness rebaseline, bilingual surface, conflict resolution) — see the route-to-publication queue, Stage 5 item 19. |
| 14 | Smoke tests completed | **PASS-WITH-LIMITATION** (historical) | **Backend/API Production smoke — PASS (Gate B5, 2026-08-06):** 15/15 checks against the live Production API with synthetic data only, deleted and verified inaccessible. **Device-side — PASS-WITH-LIMITATION (Gate B6, 2026-08-10):** production-validation APK on an **emulator** (Android 15 / API 35), not a physical device and not a Play internal-track build; **biometric not applicable on an emulator**. **Both were run on the Phase 20 build, not on `d498658`** — they do not cover the wellness rebaseline, the bilingual surface or conflict resolution. |

## Additional `10_DEPLOYMENT.md` release gates

| Gate | Status | Evidence / gap |
|---|---|---|
| **E1 — Cloud E2E currency** | **PASS** | Until 2026-09-21 the only successful `mobile-e2e` cloud run was **31008855392, 2026-08-05, on `d5fa45c`**, unre-run since. CI runs **11 distinct flows** (`smoke-auth-surface`, `registration`, `dashboard-sync`, `onboarding-loop`, `food-log`, `food-log-exclusion-warning`, `workout-training-plan`, `workout-custom-exercise`, `progress-monitoring`, `offline-entry`, `reconnect-sync`). A previous edition claimed **12 flows including `medical-management`** — that flow file still exists but the workflow **no longer runs it**, consistent with the medical decoupling. A fresh run on a Phase 21 candidate was required; see the closing entry below.<br><br>**Refresh attempted 2026-09-17.** Two stale journey defects were corrected: ADR-P027 replaced the first-run card and later cards moved it below the fold. `registration.yml` then passed on device, while `onboarding-loop.yml` exposed **BUG-018 (P1)** in the profile save. **BUG-018 is now fixed in-repo:** the post-write read had escaped the Expo SQLite transaction onto the root connection, could not see the uncommitted row and rolled the save back. The repository now threads the transaction through that read and has a red-before/green-after regression for CREATE and UPDATE. **E1 remains STALE until the complete cloud suite runs successfully on an APK containing the fix**; repository and CI evidence do not substitute for that device journey.<br><br>**Verified on device 2026-09-17.** An APK built from `6fce7c1` confirms the BUG-018 fix: the profile saves and its gaps close. Re-running the journey then exposed **`BUG-019` (P2)** — the dashboard reads its data in a mount effect only, and **no screen in the app uses `useFocusEffect`**, so returning from the weight form by `back` leaves it showing pre-weight state: it still asks for a weight the user just recorded, while the Progress preview on the same screen already shows it. A force-stop and relaunch, changing nothing else, renders the assessment, which is the control proving the data was always sufficient. `onboarding-loop.yml` deliberately still asserts the **correct** behaviour and therefore fails. **E1 remains blocked — now on BUG-019.**<br><br>**CLOSED 2026-09-21 — run `35597775166` on `a00392891b334dbc29209db61aeb383e438c7cc9`, green in 20m.** All **eleven** flows executed with zero failures: `smoke-auth-surface`, `registration` (×3, for the demo, onboard and offline accounts), `node e2e/seed.mjs`, `dashboard-sync`, `onboarding-loop`, `food-log`, `food-log-exclusion-warning`, `workout-training-plan`, `workout-custom-exercise`, `progress-monitoring`, `offline-entry` and `reconnect-sync`. BUG-018 and BUG-019 are confirmed fixed on a device by the journeys that exposed them.<br><br>**Re-confirmed on the merged tree — run `35600746413`, green.** `main` had meanwhile landed PR #174, an independent fix for the same seeder defect; the merge took `main`'s seeder, so the suite was re-run rather than the earlier result carried across a tree it had not tested.<br><br>Six cloud runs were needed, each blocked by different accumulated drift rather than by product defects: the seeder called `POST /medical/evaluations`, a route ADR-P017 Decision 4 made unreachable; two journeys asserted copy ADR-P027 replaced or that survives only in an unreachable module; and the rest asserted or tapped dashboard content from the top of a screen that has since grown two advisory cards above the fold, or gave a scroll 20s to cross a page the catalog has since made much longer. **No product code changed to close this gate** — the only non-journey change is `e2e/seed.mjs` moving to the public ADR-P016 progress entities, and a new guard, `mobile/src/shared/localization/maestro-flow-copy.spec.ts`, that fails in CI if a journey names copy the app cannot render. That guard cannot see fold position or render state; only this suite can, which is why its currency is the gate. |
| **Password recovery (ADR-P026, FEATURE-011 Vertical 1)** | **PASS** — Production-validated 2026-09-02 | Shipped by PR #102 (`724a18e7`). Reset tokens SHA-256-stored, single-use via `consumedAt`, 30-minute TTL; `forgot-password` / `reset-password` endpoints and mobile routes; EN/ES copy present. Production validation used the live recovery portal, Postmark Production with open/link tracking disabled, a fragment-scrubbed link, rejected replay, and successful sign-in with the new password. No token, credential, address or raw link recorded. |
| **Email verification (ADR-P026, FEATURE-011 Vertical 2)** | **PASS** — Production-validated 2026-09-04 | Schema (V2-A), backend (V2-C), surface (V2-D) and the two-half external gate (V2-E) all delivered. 24-hour SHA-256-only single-use tokens, generic `202` resend, public `verify-email` that **creates no session**, best-effort issuance where a mail failure never blocks registration, advisory dashboard reminder while `emailVerifiedAt` is null, 23 `auth.verify.*` keys at EN/ES parity. Soft gate preserved: unverified users keep full core access. Cross-environment token redemption was **not** tested and is **not** claimed; no no-mutation claim rests on the external gate (that invariant is ADR-P029's, with automated tests). |
| **Transactional email infrastructure (Postmark)** | **PASS** | Owned domain and sending subdomain in place, evidenced by authenticated delivery in both environments. Postmark account, plan and transactional stream exist with **open/link tracking disabled**. The API key was provided as a Development secret first and never committed. **No email is ever sent from CI** — `FakeMailTransport` is the only transport bound in tests, by construction. |
| **Browser portals + CORS isolation** | **PASS** (as deployed) | Each environment ends on its **own** portal served by its own Cloudflare Worker version: **Production** `account.appfitnessrd.com`, **Development** `account-dev.appfitnessrd.com`, plus the recovery portal `recovery.appfitnessrd.com`. Both `/health` endpoints returned 200 at the gate. Allow-lists are **disjoint and verified in both directions** — Production rejects the Development Account origin and Development rejects the Production Account origin, so neither browser portal can call the other environment's API. **In-repo caveat:** no Cloudflare Worker or hosting configuration exists in this repository; the portal deployment is owner-managed and outside version control. |
| **Deep-link completion for emailed links (ADR-P026)** | **NOT STARTED — V1 gate (native rebuild)** | `mobile/app.json` declares `scheme: appfitness` but **no `intentFilters` and no `associatedDomains`**, and `expo-linking` is unused in `mobile/src`. An emailed link opens the **Web portal, not the app**. Target is HTTPS links with a Web fallback; Universal / App Links require domain ownership **and a native rebuild (not OTA-eligible)**. |
| **Privacy contact mailbox** | **BLOCKED-OWNER — V1 gate** | `docs/legal/PRIVACY_POLICY.md` carries a real contact address on the owned domain (the placeholder was replaced by PR #102). It is a *domain* address, and **whether that mailbox actually receives mail is still unverified** — an owner check, not claimed here. |
| **Physical-device validation** | **BLOCKED-OWNER — V1 gate** | All device-side evidence to date is from an **emulator**. Physical-device validation — including **biometric**, which is not applicable on an emulator — remains outstanding before publication. |
| **Accessibility validation (UX-4C)** | **PENDING-HUMAN — V1 gate** | No manual screen-reader (VoiceOver / TalkBack), keyboard, or large-text pass has been performed, on any build. Component-level accessibility requirements are asserted in unit tests; **outcomes are not claimed**. |
| **Rollback dry-run** | **BLOCKED-OWNER** | Runbooks exist; never exercised on a live track. |
| **Production log / monitoring review** | **PENDING-HUMAN** | See item 11. |
| **Performance evidence** | **NOT STARTED** | `PERF-001` (mobile startup performance baseline) is **Proposed** and unstarted. There is **no** startup, memory, bundle-size or interaction-latency measurement recorded anywhere in the repository for any build. |
| **Release notes + submission approval** | **PASS** (template + draft) / **PENDING-HUMAN** | `docs/RELEASE_NOTES_TEMPLATE.md` and the drafted `docs/releases/v1.0.0.md` cover Phases 13–17 and **predate Phase 21**; they must be rewritten for the actual candidate. Explicit owner submission approval is unrecorded. |

## Web boundary — what actually works on Web today

This section replaces any implication of Web app parity. **No responsive
Web-app parity is claimed, and Web publication readiness is not claimed.**

**The boundary is now a recorded owner decision.** **ADR-P032** (2026-09-16)
states it: public V1 Web is a **responsive, polished bilingual portal** for
account, password-recovery and email-verification flows and for legal/public
entry surfaces, and every database-backed fitness feature keeps its honest
ADR-P019 Web-unavailable treatment. Functional Web parity with the mobile
product is a **separate, later phase** — a recorded direction only, not
designed, not scheduled, **not release-blocking for mobile V1**, and not
authorized to bypass a Web-specific architecture, security and data-sync
review (`FEATURE-014`, §Future tracks).

**What works on Web:**

- The Expo Router app exports a static Web build (`app.json` → `web.output:
  "static"`).
- **The document shell is bilingual-correct** (`BUG-016`, Done 2026-09-16).
  Every exported document declares `lang="en"` as the prerender fallback and
  corrects it to the visitor's language **synchronously, before the body is
  parsed**, from the ADR-P018 language preference and the browser language
  list only. Every product document carries a non-empty title, and the three
  portals are titled from the catalogues. An unmatched or expired link lands
  on a bilingual product not-found screen with no `/_sitemap` affordance.
  Gated on the artifact by `npm run verify:web-export`.
- The **account, recovery and verification portals work**: `/verify-email`,
  `/reset-password` and `/forgot-password` render on Web, capture the token from
  the URL **fragment** after hydration, scrub it from the URL and history, and
  **create no session**. These are the surfaces behind
  `account.appfitnessrd.com`, `account-dev.appfitnessrd.com` and
  `recovery.appfitnessrd.com`, and they are Production-validated (2026-09-02 and
  2026-09-04).
  **Qualified 2026-09-17:** they work *functionally*. They do **not** honour a
  dark-mode visitor — `BUG-017` / `.ai/23` finding T-2, verified on a local
  static export of `main`, not against the hosted Workers.

**What does not work on Web:**

- **Every database-backed feature renders the canonical Web-unavailable state**,
  because the local SQLite capability is dormant on Web under **ADR-P019**
  (`DATABASE_UNSUPPORTED_ON_WEB`). This is a deliberate, informational boundary —
  not an error, not a retry, and it fabricates no data.
- Verified on `main` across: **dashboard**, **nutrition** (plan, food log,
  targets, dietary preferences), **profile and goal**, **progress**,
  **workout** (exercise library, routine builder, workout log), **wellness
  safety profile**, and **`/sync-conflicts`**.
- **The prerendered body copy is English until hydration.** A single-language
  static export has no visitor at build time, so it cannot carry a per-visitor
  language. **Accepted and recorded** (ADR-P032 §Decision 2, audit finding
  F-7); the document *language* is already correct while it happens. Closing
  it needs per-locale prerendering or a server render — deferred
  infrastructure decisions, not defects.
- **`_sitemap.html` keeps an empty title.** Expo Router appends it outside the
  app root layout, so the repository has no mount point in it; recorded as the
  single named exemption of the export gate (ADR-P032 §Consequences).
- **ADR-P018 / ADR-P019 govern this posture and remain in force.** Web is a
  capability-limited surface for account and recovery flows only.

**Consequence for publication:** the v1 publication target is the **mobile**
app. Any future responsive Web-app scope is a separate, evidence-gated track and
is **not** part of this re-gate.

## Open defects, observations and security/privacy gaps

Ordered by launch impact, deliberately **not** by recency. **P3 observations do
not outrank launch blockers.**

**Launch-relevant (must be resolved or explicitly accepted before submission):**

| Item | Status | Impact |
|---|---|---|
| Legal sign-off (`docs/legal/*`) | **BLOCKED-EXTERNAL** | Blocks submission. Also **not yet refreshed for Phase 21** (wellness rebaseline, bilingual surface, conflict resolution). |
| Play Console listing, Data Safety, privacy URL | **BLOCKED-OWNER** | Blocks submission. |
| Physical-device + biometric validation | **BLOCKED-OWNER** | Blocks publication; all evidence to date is emulator-only. |
| Accessibility pass (UX-4C) | **PENDING-HUMAN** | Blocks a credible accessibility claim; no outcome is claimed today. |
| Universal / App Links + native rebuild | **NOT STARTED** | Emailed links open the Web portal, not the app. |
| Privacy-contact mailbox receipt | **BLOCKED-OWNER** | A published privacy contact that does not receive mail is a compliance exposure. |
| Production backups / PITR | **WAIVED** (owner-accepted) | Data-loss risk explicitly accepted for v1; no restore test exists. |
| Dependency-audit triage currency | **STALE** | Triage predates several lockfile changes; must be refreshed. |
| Cloud E2E currency (E1) | **PASS** | Runs `35597775166` and `35600746413` (post-merge), 2026-09-21, all eleven flows green on the Phase 21 candidate. |
| Rollback dry-run | **BLOCKED-OWNER** | Untested runbook is an unproven recovery path. |
| Production log / monitoring review | **PENDING-HUMAN** | Required by the deployment checklist. |
| Performance evidence (`PERF-001`) | **NOT STARTED** | No baseline of any kind exists. |
| `BUG-017` Web portals do not render dark mode | **Open (P2)** | The three public portals render light — or two themes at once — for a dark-mode visitor. Verified on a local static export of `main` (`.ai/23`, finding T-2); the hosted portals were not contacted. Blocks closing Stage 2 gate 6 and contradicts the ADR-P032 "polished portal" boundary. Does not affect the native product. |

**Security / privacy items carried in the backlog:**

| Item | Status | Note |
|---|---|---|
| `SECURITY-001` Local sensitive data protection | **Proposed** | Unstarted. |
| `RESEARCH-001` SQLite encryption strategy | **Proposed** | Unstarted; related to SECURITY-001. |
| `BUG-006` Dormant `EvaluationHistory` is unrouted and pushes | **Open** | Dormant-domain defect; medical is decoupled from the public API (`MedicalModule` unmounted), which limits exposure, but the entry remains open. |
| `TECHDEBT-004` Dormant nutrition schema latent integrity issues | **Open** | Dormant-schema debt. |

**Coverage risk:**

| Item | Status | Note |
|---|---|---|
| `RISK-001` Cross-package test fixtures were excluded by CI path filters | **Done** (2026-09-15) | Three tests read a fixture from outside their own package, and each direction was unprotected: `.ai/19_COPY_DECKS.md` to mobile `conflict-catalogue.spec.ts`; `api/prisma/migrations/20260908120000_add_wellness_safety_profiles/migration.sql` to mobile `wellness-safety-profile.spec.ts`; and — the mirror image of the originally reported edge — `mobile/src/features/workout/infrastructure/exercise-catalog.data.ts` to API `exercise-identity.spec.ts`. Both detectors gained the exact missing paths and nothing else. Required contexts, fail-safe-on-unavailable-base, unrelated-documentation no-op, and every audit job and threshold are preserved and verified unchanged. Proven by extracting the shipped patterns and the shipped detector scripts and exercising them, including empty and bogus base SHAs. |

**Open functional defects:** none. **`BUG-016`** (P2) was the last one and is
**Done (2026-09-16)**, closed by **ADR-P032**. Recorded 2026-09-15 by the
bilingual surface audit, it held that the Web document shell was English-only
(`lang="en"`, empty `<title>`, English-only static prerender) and that an
unmatched URL landed on Expo Router's framework-English not-found screen. The
`lang`, the title and the not-found screen are corrected; the English
prerendered **body** is accepted and recorded as the limitation of a
single-language static export, and `_sitemap.html` keeps an empty title as a
named exemption. It affected the shipped account, recovery and verification
portals, never the mobile publication target. Two P3 observations remain open
alongside it — `OBS-BSA-1` (the account-deletion confirmation phrase is the
English word `DELETE` in both languages) and `OBS-BSA-2` (`/delete-account`
renders no Web-unavailable state).

`BUG-011` was the previous one and is **Done (2026-09-15)**. All four applicable
row-level treatments are shipped; its residual was an **absent surface** —
Progress never lists an individual body-measurement row — and was closed by
correcting the acceptance criterion rather than adding a measurement list and
copy the deck does not contain.

**P3 observations — recorded, not launch blockers:**

| Item | Status | Note |
|---|---|---|
| `OBS-C7-1` "Try now" is a silent no-op inside the settlement backoff window | **Open, P3** | Retry policy is correct and **no data is at risk**; the gap is absent feedback for a deliberate user action. |
| `OBS-C7-2` Dashboard read failed once after a force-stop during sync | **Open, P3** | Observed **once in five campaign runs**; not reproducible on relaunch with identical state; **no root cause claimed**. |

## Future tracks (recorded, unstarted, not v1)

- **`FEATURE-012` Azul payments** — unstarted and unauthorized. Requires product
  scope (including whether store billing policy even permits a third-party
  processor for the intended purchase type), its own accepted ADR,
  security/compliance review including PCI scope, webhook and idempotency
  design, and UX/failure semantics. See `.ai/11_BACKLOG.md`.
- **`FEATURE-014` Post-mobile Web product parity** — unstarted and
  unauthorized. A recorded owner **direction** (ADR-P032 §Decision 7): after
  the mobile product is complete, a separately planned phase may deliver
  functional Web parity with the mobile product. It is **not designed, not
  scheduled and not release-blocking for mobile V1**, and it may not start
  without a Web-specific architecture, security, data-synchronization and
  privacy review and its own accepted ADR. Until then ADR-P018 and ADR-P019
  stay in force exactly as written. See `.ai/11_BACKLOG.md`.
- **`FEATURE-013` W-5 supplement education** — optional and unauthorized.
  Educational, **food-first only**: no dosage of any kind, no diagnosis, no
  medication-interaction advice, no brand or product recommendation, mandatory
  deferral to a qualified professional. Requires its own accepted ADR **and**
  qualified legal/domain review. Declining it remains a valid outcome.

## Route to publication — dependency-ordered queue

Every remaining item is classified **`in-repo`** (engineering work in this
repository), **`owner`** (an account, asset, device or approval the owner
controls), **`external`** (a third party), or **`post-v1`**. Later stages depend
on earlier ones; items within a stage are parallelisable.

**Stage 1 — finish the product contract (`in-repo`)**

**Both are now done.** They were the same piece of work seen from different
angles — coverage, then quality.

1. ~~`in-repo` — Complete the **exhaustive bilingual surface audit**.~~ **Done
   2026-09-15** — `.ai/21_BILINGUAL_SURFACE_AUDIT.md`. Every one of the 20 route
   entry points, every embedded surface, the three shipped Web portals and both
   non-catalogue content catalogues were traced in both directions. **Mobile
   coverage is complete**: outside the dormant medical domain the only literals
   left on a reachable surface are the frozen `AppFitness` brand and the unit
   symbols `kcal` and `kg`, which are identical in both languages. Three
   coverage defects were corrected — the food log rendered the stored serving
   unit (`piece`, `cup`, `tbsp`, `tsp`, `slice` in a Spanish log), and two date
   fields hinted `YYYY-MM-DD` while their own Spanish validation message said
   `AAAA-MM-DD`. **Web coverage was not complete**: `BUG-016` recorded a fixed
   `lang="en"`, an empty `<title>`, an English-only static prerender and a
   framework-English not-found screen, none correctable without new copy or an
   architecture decision. Both have since been supplied: `BUG-016` is **Done
   2026-09-16** under **ADR-P032**, which corrects the `lang`, the titles and
   the not-found screen and records the English prerendered body as the
   accepted limitation of a single-language static export.
2. ~~`in-repo` — **Bilingual quality** review beyond coverage: wording, tone, and
   correct locale formatting of dates, numbers and units.~~ **Done 2026-09-16** —
   `.ai/22_BILINGUAL_QUALITY_REVIEW.md`. All **43** user-facing numeric renders
   from `.ai/21_BILINGUAL_SURFACE_AUDIT.md` §Handoff now resolve through the
   shared formatter: the three fractional sites that were wrong in Spanish
   (serving count, logged serving count, set weight) read `0,25`, `1,5` and
   `82,5`, and the calorie total that read `2,500` on one screen and `2500` on
   another in English now reads the same on both. Accessibility labels carry the
   same formatted value as the text they describe. **Wording is reviewed, not
   certified**: 1063 key pairs were read in both languages and **three** values
   changed — the progression sentence whose count sat outside it in both
   languages, and a Spanish reset confirmation that said the devices closed
   rather than the sessions. Everything else provable but not settleable by a
   reviewer — two Spanish movement vocabularies, mixed register, an approved
   conflict-deck row, an unwritten sentence, the generic `es` locale, and a
   numeric input contract that accepts only the English decimal separator — is
   recorded as `OBS-BQR-1 … OBS-BQR-6`. **The evidence gate is met**: a key count is not the
   claim, `mobile/src/shared/localization/localized-formatting.spec.ts` is.

*Closed out of this stage on 2026-09-15:*

- ~~Complete the deterministic workout routine.~~ **Already shipped and
  user-reachable**, verified in code against `.ai/07_ICOACH.md` without
  modifying the generator: `/routines` → `RoutineBuilder` →
  `GeneratedWorkoutPlan` renders a weekly schedule with active-recovery and
  full-rest days, per-session exercise selection, sets, repetitions or duration,
  rest, target RPE and equipment-compatible substitutions; progression is
  explicit (`WorkoutProgressionRule`, three strategies); goals drive repetition
  profiles; declared movements filter candidates; output is deterministic and
  versioned with no randomness, clock or network in the generator; it is a pure
  function over local data, so it works offline; and the domain emits stable ids
  translated only at the presentation boundary.
- ~~Resolve or explicitly defer `BUG-011`.~~ **Done.** All four applicable
  row-level treatments are shipped (Workout Log, Dietary Preferences, body
  weight, weekly snapshot). The residual was an **absent surface**, not a missing
  treatment — Progress never lists an individual body-measurement row — so it was
  closed by correcting the acceptance criterion rather than inventing a
  measurement list and copy the deck does not contain.
- **W-5 (optional supplement education) does not block v1** and never did. It is
  the one W-slice ADR-P017 made optional; nothing depends on it, and declining it
  is a valid outcome. Tracked as `FEATURE-013`.

**Stage 2 — design and experience gates (`in-repo`, evidence-based)**

5. `in-repo` — **Attractive, friendly visual UX**: FEATURE-010 is still
   *In Progress*, and ADR-P022's Material Symbols icon delivery mechanism is
   still **unresolved and separately gated** (no package, asset format or
   per-platform mapping selected). Gate on shipped evidence, not intent.
   **Progress 2026-09-16 (ADR-P022 Addendum A, UX-1C-4):** the light-theme
   WCAG 2.2 AA colour failures are closed — four token values corrected and four
   foreground-pairing defects fixed, including one that rendered every
   `secondary` and `text` button label as untinted black at **1.13–1.42:1 on
   the dark theme's grounds**. **This does not advance gate 5 to done**: Inter,
   icons, motion and dark surface-tint elevation are all still unimplemented, so
   the app's appearance is still largely default MD3.
6. `in-repo` — **Light and dark mode** verified across every shipped surface.
   **PARTIALLY VERIFIED 2026-09-16** — `.ai/23_THEME_SURFACE_VERIFICATION.md`.
   **18 of the 19 reachable routes were captured and visually reviewed in both
   themes** (36 captures) from a release APK built from `5dee02b`, the first
   build containing ADR-P022 Addendum A. **No dark-mode rendering failure was
   found**: every string was legible, no surface failed to adapt, selected chips
   and enabled filled buttons are correct in both themes, and the 1.13–1.42:1
   label defect Addendum A describes is confirmed absent from this build. One
   low-severity finding, **T-1**: disabled filled buttons fall to **2.52–3.75:1**
   label-vs-fill because the disabled state is a blanket `opacity: 0.56`
   composite rather than a token pair — WCAG-exempt as an inactive control, and
   **worse in light than dark**.
   **PASS 2 — 2026-09-17, from `ef8b181`.** The five gaps pass 1 recorded are
   closed on **native**: populated rows, `TrendBars`, `WeeklySnapshotSummary`,
   `GeneratedWorkoutPlan` and the conflict **card** (undecided, retrying and
   settled treatments) were seeded, rendered and captured in both themes — **40
   native captures, 20 light/dark pairs, not one pair identical**, from the same
   verified build (byte-identical to pass 1's artifact by SHA-256; `mobile/src`
   is unchanged between `5dee02b` and `ef8b181`; that artifact is the **`e2e`
   variant** of the release build, which is why it can reach only a local API).
   Data came from a **local disposable stack** through the public sync contract;
   no hosted environment was contacted.
   **No native theme defect was found**, and **T-1 is reconfirmed** including its
   direction (light is the harder one to read).
   **The Web portals are now covered, and they fail.** New finding **T-2**
   (`BUG-017`, P2): with `prefers-color-scheme: dark` asserted inside the page,
   the local static export never renders dark — `/forgot-password` is
   **pixel-identical to light** at 360 / 414 / 768 / 1280 px, while
   `/reset-password` and `/verify-email` render **two themes at once** (light
   page and card, dark banner and button). The export is prerendered light-only
   and contains no `prefers-color-scheme` rule at all. Verified against a local
   export; the hosted Cloudflare portals were deliberately not contacted.
   **Gate 6 is therefore still NOT done.** Native is now evidenced; Web is
   evidenced as **broken**. Closing it needs `BUG-017` resolved — an owner
   decision, since every fix changes behaviour on a deployed surface — and
   re-verification afterwards. Four observations are recorded as
   `OBS-T2-1 … OBS-T2-4`, one of which (`OBS-T2-4`) was a second, independent
   confirmation that the E2E journeys had gone stale against ADR-P027. That
   staleness is now resolved — gate E1 passed on 2026-09-21 — but `BUG-017`
   is untouched by it and still gates this item.
7. `in-repo` — **Accessibility (UX-4C)**: manual screen-reader, keyboard and
   large-text passes. No outcome may be claimed until run. **Unchanged by
   ADR-P022 Addendum A** — contrast arithmetic is not an assistive-technology
   outcome, and all five V1 accessibility release-review gates (ADR-P023 /
   ADR-P024 / ADR-P025) remain open at the same severity.
8. `in-repo` — **Responsive-Web scope decision**: today Web is account/recovery
   portals only, with every DB-backed feature on the Web-unavailable path.
   Either accept that boundary for v1 **or** open a separate track. Do not claim
   parity without evidence.

**Stage 3 — refresh engineering evidence on a real candidate (`in-repo`)**

9. `in-repo` — Refresh the **dependency-audit triage** against current lockfiles.
9a. ~~`in-repo` — Close `RISK-001`.~~ **Done 2026-09-15.** All three
    cross-package fixture edges now select their consumer workflow, so a green
    PR means what it appears to mean.
10. ~~`in-repo` — Re-run the **cloud E2E** suite (gate E1) on the candidate.~~
    **Done 2026-09-21.** Run `35597775166`, all eleven flows green.
11. `in-repo` — Consider promoting the 14 **conflict journeys** into automated
    coverage, or record explicitly that they stay manual and two-device.
12. `in-repo` — Produce **performance evidence** (`PERF-001`): at minimum a
    startup baseline on the candidate build.
13. `in-repo` — Rewrite `docs/releases/v1.0.0.md` for the actual candidate.

**Stage 4 — build and validate the candidate (`owner` + `in-repo`)**

14. `in-repo` + `owner` — **Native rebuild with Universal / App Links** and
    `intentFilters` / `associatedDomains`. Not OTA-eligible; requires domain
    ownership.
15. `owner` — **Physical-device validation**, including **biometric**.
16. `owner` — **Rollback dry-run** on the first internal track.
17. `owner` — **Production log / monitoring review**.
18. `owner` — Re-verify **Sentry** on the candidate build.

**Stage 5 — compliance and store (`external` + `owner`)**

19. `external` — **Legal sign-off** on the `docs/legal/*` set, **refreshed
    for Phase 21** rather than the Phase 20 product.
20. `owner` — **Privacy-contact mailbox receipt** verification.
21. `owner` — **Play Console**: create the app, upload listing assets, complete
    Data Safety, publish the privacy-policy URL.
22. `owner` — **Track progression** internal → closed → production.
23. `owner` — **Explicit submission approval**, recorded.

**Post-v1**

24. `post-v1` — Phase 18 (Habit Tracking), Phase 19 (Notifications).
25. `post-v1` — `FEATURE-012` Azul payments.
26. `post-v1` — `FEATURE-013` W-5 supplement education (optional).
27. `post-v1` — `FEATURE-014` post-mobile Web product parity. A recorded
    direction only (ADR-P032 §Decision 7); it starts after the mobile product
    is complete and only with its own reviews and ADR.
28. `post-v1` — `OBS-C7-1`, `OBS-C7-2`, `SECURITY-001`, `RESEARCH-001`,
    `BUG-006`, `TECHDEBT-004` unless a review promotes any of them.

## Verdicts (four distinct dimensions — do not conflate)

**1. In-repo release engineering: green on `d498658`.** CI, migrations, the
account-deletion path and the release scaffolding are done and CI-green, and
conflict resolution is now verified end to end. **But** two evidence gates are
**stale** — the cloud E2E run and the dependency triage — so "green CI" is not
the same as "current release evidence".

**2. Feature completeness for public v1: NEARLY.** Phase 21 has delivered the
medical decoupling, the Wellness Safety Profile (W-0 … W-4E), bilingual
nutrition, conflict resolution, and — verified in code on 2026-09-15 — the
complete deterministic workout routine, user-reachable at `/routines`. The
**exhaustive bilingual surface audit** is **complete**
(`.ai/21_BILINGUAL_SURFACE_AUDIT.md`, 2026-09-15): mobile coverage is complete,
and the Web-shell gap it tracked as `BUG-016` is **Done (2026-09-16,
ADR-P032)**. The **bilingual quality
review** is **complete** for locale formatting and reviewed for wording
(`.ai/22_BILINGUAL_QUALITY_REVIEW.md`, 2026-09-16); six wording, locale and
input-contract decisions are recorded for an owner as `OBS-BQR-1 … OBS-BQR-6`,
none of which is a defect a reviewer may settle alone. **Stage 1 is therefore closed in
repo.** **W-5 is optional and does not block v1.**

**3. Production / store-submission readiness: BLOCKED.** Blocked on owner and
external gates — legal sign-off, Play Console, physical-device and accessibility
validation, deep links, rollback dry-run, log review and submission approval —
and on the Stage 1–3 in-repo work above. No candidate build exists for the
current product contract.

**4. Scope of this edition.** Documentation-only. It does not change source,
tests, dependencies, schemas, migrations, configuration, infrastructure,
secrets, production or store state, and it does not approve any submission.
