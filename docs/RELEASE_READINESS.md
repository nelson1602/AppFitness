# AppFitness — Release Readiness (Phase 20 evidence / Phase 21 publication reset)

> Engineering re-audit of every `10_DEPLOYMENT.md` Release Checklist item and
> the Phase 20 exit criteria against current repository evidence. **Not a
> submission approval.** Legal / owner / store-console gates are called out
> explicitly and remain the owner's to close.

Last updated: 2026-09-02 (password-recovery Production validation) · Current
main baseline `0476957` · App version `1.0.0` · Publication date: **not set**.

> **2026-09-02 — password recovery is Production-validated.** PR #102 merged as
> `724a18e7`; the Expo SDK patch alignment (PR #119) merged as `0476957`, with
> post-merge mobile and API CI green. The **Password recovery** gate below moves
> **NOT STARTED → PASS**, and the **Privacy contact** row is corrected: its
> placeholder claim was stale. **Nothing else moves.** Email verification,
> deep-link completion, physical-device validation, Play Console, Production
> environment, rollback dry-run and legal sign-off are untouched, and this is
> **not** a statement of publication readiness.

> **PUBLICATION RESET — ADR-P017 (2026-08-10):** the owner clarified that the
> public v1 product is fitness, nutrition, progress, and wellness — not a medical
> product — and must support Spanish and English. The medical implementation is
> preserved but will be reversibly disconnected from public navigation, writes,
> sync composition, dashboard inputs, and iCoach. The existing release evidence
> below remains historically valid for the build tested, but **that build is no
> longer a publication candidate**. Store submission is blocked until Phase 21
> implements and revalidates the new product contract.

> **No destructive action is authorized by the reset:** no medical code, table,
> migration, encrypted field, or retained record is deleted. Existing medical
> data remains protected under ADR-0011/P001/P006/P011 while dormant.

> **Slice 4 handoff:** the remaining owner/external gates (Sentry, legal
> sign-off, Play listing/Data Safety/privacy URL, Production env, rollback
> dry-run, production smoke, mobile production validation, submission approval)
> are tracked with owner actions + evidence templates in
> **`docs/PHASE20_EXTERNAL_GATES.md`**. Gate PASS is recorded in *this* matrix
> once evidence is verified.

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

## Preserved Phase 20 engineering evidence (`d5fa45c` and later gate evidence)

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
| 6 | Security audit reviewed | **PASS** (tracked exceptions) | dependency-audit job in both CI workflows (critical-gated on prod deps); triage refreshed **2026-08-05 (Phase 20 Slice 3)** in `docs/DEPENDENCY_AUDIT.md`. **Two HIGH prod advisories remediated** (non-breaking `npm audit fix`: api `fast-uri`, mobile `brace-expansion`). Post-remediation: **api 0 advisories; mobile 12 moderate** (Expo build-tooling transitives, non-runtime, tracked). **0 high/critical** either side. |
| 7 | Migrations tested | **PASS** | `prisma migrate deploy` in the `api-ci` e2e job + local; account-deletion cascade applied & e2e-verified |
| 8 | Rollback plan exists | **PASS** (plan) / **BLOCKED-OWNER** (tested) | API rollback (`api/DEPLOYMENT.md`) + mobile store-track runbook (`docs/MOBILE_ROLLBACK.md`) documented; **not yet exercised on a live track** — dry-run is an owner action. **Note (B1 waiver):** the DB snapshot/restore fallback is unavailable in Production (no backups/PITR — see item 9); backend rollback therefore relies on redeploy-previous under the expand-first migration policy (unaffected). |
| 9 | Environment variables verified | **PASS** (dev) / **PASS — with backup/restore WAIVER** (prod) | Railway **Production created + verified 2026-08-05** (Gate B1): URL `https://appfitness-production-5cfa.up.railway.app` (distinct from Dev; US West), API + PostgreSQL online, **`/health` = 200 (independently confirmed)**, **10 migrations applied / none pending**, OpenSSL warning resolved, post-merge API/mobile CI green (deployed commit `4ee52a1`). Railway project `68c0d53d-9c53-4f12-8482-be35da190d25` · API deployment `0416691a-5a32-491c-b584-b9e9da5b4754`; fresh prod secrets set (names per `api/DEPLOYMENT.md`; values not recorded). **WAIVER (owner-approved 2026-08-05):** Railway daily backups / PITR require the Pro plan — owner declined the paid upgrade, so **no automated backups and no restore test were performed** for v1 (data-loss risk explicitly accepted). *Restore verification is NOT claimed.* Staging env not created (optional). |
| 10 | Monitoring enabled | **PASS (backend + mobile)** | **Backend enabled + live-verified 2026-08-05 (Gate B2):** Railway Production deployment `2b1ec9ba-a2ab-42d5-a848-6828980e5a39` on release `1d16b99991dc`; `/health` 200 after redeploy; Sentry issue [`APPFITNESS-API-1`](https://hardtech-solutions.sentry.io/issues/7654812085/) / event `c1b6a0116fa34d82bb981f5f17a48083` in `production`. The event used the deployed bootstrap + scrubbers; synthetic `notes`/`token` values arrived redacted and no PII/PHI/token was present. Backend scrubber specs: 7/7 green. **Mobile enabled + live-verified 2026-08-06 (Gate B2-mobile):** EAS build `db57221a-3f96-4a87-9c93-b1d7186f72ae` (profile `sentry-verification`, app 1.0.0 / versionCode 3) FINISHED with **source-map upload succeeding** (after rotating the Sentry Organization Token). Runtime verification on `emulator-5554`: app launched cleanly — no crash, ANR, JS-fatal, or Sentry transport failure. Sentry event `31f94e5b7a9e425b99d8a02ba5758eb1` (issue [`REACT-NATIVE-1`](https://hardtech-solutions.sentry.io/issues/7656864096/)) at `2026-08-06T17:46:06.750Z` — project `react-native`, `environment=production`, release `1.0.0 (3)`; synthetic `notes` **[REDACTED]** / `token` **[Filtered]** scrubbed; stack frames **symbolicated** to `sentry.ts` + `_layout.tsx`; exactly one controlled event. **Privacy:** Sentry captured standard crash/device diagnostics, a pseudonymous device identifier, and approximate geography; the verified event contained **no PHI, no authentication token, and no user-entered health data**. The temporary verification harness never entered `main` (draft PR #31 closed unmerged). Mobile scrubber specs green. See `docs/SENTRY_ENABLEMENT.md`. |
| 11 | Logs reviewed | **PENDING-HUMAN** | hosted Development logs exist; no production logs to review yet |
| 12 | Store metadata ready | **BLOCKED-OWNER** | `eas.json` `submit` profile present (Android internal/draft); **missing** store-listing assets (screenshots, descriptions, categories), Data Safety form, and a published privacy-policy URL — owner / store-console |
| 13 | Privacy requirements satisfied | **BLOCKED-EXTERNAL** | account deletion implemented + in-app surfaced (PASS); `docs/legal/*` (privacy, ToS, health disclaimer, Data Safety, data inventory) **refreshed to Phases 13–17 in Phase 20 Slice 2 (2026-08-05)** — now review-ready; still **BLOCKED-EXTERNAL pending legal sign-off** |
| 14 | Smoke tests completed | **PASS-WITH-LIMITATION** — **PASS** (cloud E2E + **backend/API production smoke**, Gate B5) + **PASS-WITH-LIMITATION** (device-side mobile validation, Gate B6) | 12-flow Maestro `mobile-e2e` green on `d5fa45c` (run 31008855392). **Backend/API Production Smoke — PASS (Gate B5, 2026-08-06):** the `10_DEPLOYMENT.md` server-side smoke ran against the live Production API with **synthetic data only** — 15/15 checks pass (HTTPS + `/health`, register, login, `GET /auth/me`, profile `PUT`/`GET`, `GET /sync/pull` baseline, body-weight `POST /sync/push` + round-trip, missing/invalid-token 401, logout + refresh revocation, `DELETE /auth/account` + post-deletion login rejected); synthetic data deleted & verified inaccessible; no secrets/PII/PHI recorded (see `PHASE20_EXTERNAL_GATES.md` B5). **Device-side Mobile Production Validation — PASS-WITH-LIMITATION (Gate B6, 2026-08-10):** the fixed production-validation APK (EAS `0ad2f78a-…`, source `d976c66`, 1.0.0 / vc4, Production API + Sentry) on the appfitness **emulator (Android 15 / API 35)** — clean cold launch (bundled release, no Metro/dev-client), production register/login, dashboard + Progress render, SecureStore session restore, the BUG-005 same-date weight & measurement regressions (one logical server row each, latest values, no raw SQLite error / no screen wipe), and the **offline CREATE + UPDATE → reconnect round-trip** (persisted across offline relaunch, synced with no duplicates/conflict/retry loop). Synthetic account deleted & rejected afterward. **LIMITATION:** sideloaded production-equivalent APK on an **emulator** — **not** a Play internal-track build and **not** a physical device; **biometric NOT APPLICABLE on the emulator — physical-device biometric validation remains pending before store publication** (see `PHASE20_EXTERNAL_GATES.md` B6). |

## Additional `10_DEPLOYMENT.md` release gates

| Gate | Status | Evidence / gap |
|---|---|---|
| Production Smoke Tests (10 checks: backend health, auth, profile, SQLite init, dashboard, iCoach recs, offline, sync init, reconnect sync, no critical monitoring errors) | **PASS-WITH-LIMITATION** — backend/API subset PASS (Gate B5) + device-side PASS (Gate B6, emulator) | **Backend/API subset PASS (2026-08-06, B5):** health, auth, profile + sync push/pull round-trip + authz/session-revocation against the live Production API with **synthetic data only** (15/15; synthetic data deleted & verified inaccessible). **Device-side PASS (2026-08-10, B6):** SQLite init, dashboard render, on-device Progress/iCoach, offline entry, and reconnect sync verified on the appfitness **emulator** with the production-validation APK (see item 14 + `PHASE20_EXTERNAL_GATES.md` B6). **Remaining:** production **log / monitoring-error review** (item 11) = **PENDING-HUMAN**; physical-device pass pending. |
| Mobile Production Validation (10 checks: open, login, nav, dashboard, offline, push permissions, SecureStore, biometric-if-enabled, no debug info, store build matches env) | **PASS-WITH-LIMITATION** (Gate B6, 2026-08-10) | Validated on the appfitness **emulator (Android 15 / API 35)** with the fixed production-validation APK (source `d976c66`, 1.0.0 / vc4): open, login (Production), navigation, dashboard, offline entry + reconnect sync, SecureStore session restore, **no debug info** (bundled release, no Metro/dev-client), and **store-build-matches-env** (Production API + Sentry). **LIMITATION:** sideloaded APK on an **emulator** — **not** a Play internal-track build and **not** a physical device; **biometric NOT APPLICABLE on the emulator (physical-device biometric validation remains pending before store publication)**; push-permission behavior not exercised (notifications are post-v1). |
| Release Notes | **PASS** (template + v1 draft) / **PENDING-HUMAN** (deploy-time fields) | reusable `docs/RELEASE_NOTES_TEMPLATE.md`; **v1.0.0 note drafted `docs/releases/v1.0.0.md` (Phase 20 Slice 3)** covering Phases 13–17; deploy-time fields (backend commit/env, actual date, track progression) marked `[SET AT RELEASE]` |
| **Password recovery available (ADR-P026, FEATURE-011 Vertical 1)** | **PASS** — Production-validated 2026-09-02 | Shipped by **PR #102**, merged `724a18e7`. **In-repo evidence on `main`:** `MailTransport` port and Postmark REST transport (`api/src/modules/mail/`); `forgot-password` / `reset-password` endpoints (`api/src/modules/auth/presentation/auth.controller.ts:103`, `:129`); reset tokens SHA-256-stored and **single-use** via `consumedAt` (`password-recovery.service.ts:260-264`) with a **30-minute TTL** (`api/src/modules/auth/infrastructure/token.service.ts:21`, `PASSWORD_RESET_TTL_MINUTES = 30`); mobile `forgot-password` / `reset-password` routes (`mobile/src/app/`); EN/ES copy present (8 `auth.forgot.*` + 14 `auth.reset.*` keys). **Production validation (2026-09-02):** Production and Development deployments healthy; the recovery Web route `https://recovery.appfitnessrd.com` is live; Postmark **Production** delivered the controlled recovery message with **open/link tracking disabled**; a fresh authorized link changed the password, the URL fragment was **scrubbed**, **replay was rejected with the generic invalid/expired response**, and sign-in with the new password succeeded. An earlier link expired **correctly** — it was opened more than five hours after delivery against the 30-minute contract, which is conformant behaviour and **not an application defect**. No token, credential, address, message identifier or raw link is recorded here. **Scope:** closes **Vertical 1 only**. Vertical 2 (email verification) and deep-link completion remain separate open V1 gates below. |
| **Email verification available (ADR-P026, FEATURE-011 Vertical 2)** | **NOT MET — V1 gate; schema (V2-A) + backend (V2-C), no user-facing surface** | Added as a V1 launch requirement by **ADR-P026 (2026-08-27)**; also resolves **TECHDEBT-001**'s requirement that the verification strategy be explicitly decided. Audited at `f1e7214`: `User` has **no `emailVerified`/`emailVerifiedAt`**, no verification-token model, no verify/resend endpoint, and no mobile route or copy. Requires: `emailVerifiedAt` column + verification-token migration (same storage design, single-use, **24-h TTL**), `resend-verification` / `verify-email` endpoints, persistent soft-gate reminder, and legacy backfill. **Policy:** existing accounts are backfilled `emailVerifiedAt = NULL` and are **never locked out**; **no `PENDING_VERIFICATION` `UserStatus`**; unverified users keep **core access**, with verification mandatory only before future email-report / account-notification features. **V2-A (2026-09-03) delivers the schema only** — nullable `users.email_verified_at`, the `email_verification_tokens` table (hash-only unique; a partial unique index on `user_id` `WHERE consumed_at IS NULL AND invalidated_at IS NULL` — i.e. **one open unconsumed/uninvalidated row per user**, expiry deliberately not in the predicate; cascade on user delete), and the two `EMAIL_VERIFICATION_*` `AuditAction` values, in two additive forward-only migrations validated against disposable PostgreSQL. **V2-C (2026-09-03) delivers the backend** — automatic issuance at registration (best-effort; a mail failure never alters or rolls back the registration response), the **authenticated** `POST /auth/resend-verification` (no email field; same generic `202` for every accepted request — dispatched, already verified, mail failure, per-account-ceiling no-op — with `400`/`401`/`429`/`503` at the boundaries, per ADR-P026 §Clarifications 2026-09-03), the **public** `POST /auth/verify-email` (204, single-use, generic 400, **creates no session**), the EN/ES mail template, 24-hour SHA-256-only tokens, per-IP throttles plus a per-account ceiling, both `EMAIL_VERIFICATION_*` audit actions, Sentry scrubbing, and `emailVerifiedAt` on `GET /auth/me`. Proved against **disposable PostgreSQL only** (22 e2e cases incl. concurrent redemption, concurrent resend, replay, expiry, expired-but-open replacement, throttling and mail-failure independence); **CI sends no email by construction** (`FakeMailTransport`). **The gate remains unmet:** **no mobile/Web route, no dashboard reminder and no `auth.verify.*` copy exist (V2-D)**, and the account host `account.appfitnessrd.com` **does not exist** (DNS + CORS, V2-E) — so `MAIL_VERIFICATION_BASE_URL` is unset everywhere and **verification mail is switched off by construction**. No Development or Production database, and no provider, was contacted. |
| **Deep-link completion for emailed links (ADR-P026)** | **NOT STARTED — V1 gate (native rebuild)** | `mobile/app.json` declares `scheme: appfitness` but **no `intentFilters` and no `associatedDomains`**, and `expo-linking` is unused in `mobile/src` — so a link tapped in an email would not open the app today. Target is **HTTPS links with a Web fallback**; native **Universal / App Links require domain ownership and a native rebuild (not OTA-eligible)**. |
| **Privacy contact resolved (ADR-P026 Decision 14)** | **BLOCKED-OWNER — V1 gate** | **Corrected 2026-09-02 — the earlier claim was stale.** `docs/legal/PRIVACY_POLICY.md` no longer carries `[PLACEHOLDER — privacy contact email]`; PR #102 (`724a18e7`) replaced it with a real contact address on the owned domain. **Still BLOCKED-OWNER:** it is a *domain* address, not a personal mailbox, and **whether that mailbox actually receives mail is not verified** — that needs an owner check and is **not** claimed here. Related to item 13 (privacy requirements). |

## Phase 20 Exit Criteria (`13_MIGRATION_ROADMAP.md`)

| Criterion | Status | Evidence / gap |
|---|---|---|
| `docs/RELEASE_READINESS.md` matrix all PASS or explicitly waived | **RESET / BLOCKED-PRODUCT** | ADR-P017 changed the public-v1 contract after the Phase 20 candidate was validated. Phase 21 must complete medical decoupling, bilingual support, nutrition/workout completion, and a fresh re-gate. |
| internal → closed → production track progression validated | **BLOCKED-OWNER** | no track progression exercised yet |

## Owner / external action list (unresolved gates)

Before these external gates can close, the following **in-repo Phase 21 product
gates** must pass on a fresh candidate:

1. Public medical routes/fields/writes/sync/iCoach inputs reversibly disconnected.
2. Self-entered physical-assessment contract active without doctor/diagnosis/
   treatment/medical-clearance fields.
3. Spanish and English complete across UI, iCoach, catalogs, validation, errors,
   accessibility, dates, numbers, and units.
4. Goal-oriented nutrition suggestions and complete deterministic workout
   routines validated offline-first.
5. Fresh bilingual CI/E2E, physical-device, privacy, production-smoke, and
   release-candidate evidence.

The owner/external items below remain necessary after those product gates. Their
existing Phase 20 statuses are historical until the Phase 21 re-gate confirms
which evidence can be reused.

1. **Sentry** (item 10) — **PASS (backend + mobile), 2026-08-06**: backend and
   mobile Sentry are enabled and live-verified — scrubbed events in `production`
   on both platforms, mobile frames symbolicated (per ADR-P010). No remaining
   owner action for this gate.
2. **Legal sign-off** (item 13) — **BLOCKED-EXTERNAL**: finalize + approve
   `docs/legal/{PRIVACY_POLICY,TERMS_OF_USE,HEALTH_DISCLAIMER,PLAY_DATA_SAFETY,DATA_INVENTORY}.md`.
3. **Play Console** (item 12) — **BLOCKED-OWNER**: create the app; upload
   listing assets (screenshots, descriptions, categories); complete the Data
   Safety form; publish a privacy-policy URL.
4. **Production / Staging environment** (item 9) — **BLOCKED-OWNER**: provision
   + set secrets; only Development exists today.
5. **Rollback dry-run** (item 8) — **BLOCKED-OWNER**: exercise the API +
   mobile-track rollback runbooks on the first internal track.
6. **Production Smoke** (item 11/14) — **PASS-WITH-LIMITATION**: backend/API
   subset **PASS (Gate B5, 2026-08-06)** and device-side subset **PASS (Gate B6,
   2026-08-10, emulator)** — both with synthetic data only (deleted & verified
   inaccessible). Remaining: production **log / monitoring-error review** (item 11)
   = **PENDING-HUMAN**.
7. **Mobile Production Validation** (item 14) — **PASS-WITH-LIMITATION (Gate B6,
   2026-08-10)**: device-side validation passed on the appfitness **emulator**
   with the fixed production-validation APK (open/login/nav/dashboard/offline+
   reconnect/SecureStore/no-debug/env-match). **Physical-device biometric
   validation remains pending before store publication**; not run on a Play
   internal-track build.
8. **Release notes + submission approval** — **PENDING-HUMAN**: author the v1
   release note from the template and record explicit owner submission approval.
9. **Transactional email prerequisites** (ADR-P026 / FEATURE-011) — **PARTLY
   SATISFIED (Vertical 1), 2026-09-02**. The owner actions ADR-P026 deliberately
   did not authorize have since been carried out for **password recovery**:
   (a) the **owned domain and sending subdomain** are in place — evidenced by
   authenticated delivery in both environments; (b) the **Postmark account,
   plan and transactional stream** exist, with **tracking disabled**;
   (c) the **API key was provided as a Development secret first**, never
   committed; (d) the **privacy-contact placeholder is replaced** in-repo,
   though the mailbox itself is still **unverified** (see the Privacy contact
   row). Development sandbox validation preceded Production, as required.
   **Still outstanding:** (e) native **Universal / App Links still need a native
   rebuild** — unchanged and **not** claimed complete; and **Vertical 2 (email
   verification) has schema (V2-A) and backend (V2-C) but no user-facing
   surface** — V2-D and V2-E remain — so it retains every prerequisite above in
   its own right, plus the account host its links point at. **No email is ever sent from
   CI** — a fake transport remains the only one bound in tests.

## Verdicts (four distinct dimensions — do not conflate)

**1. In-repo release engineering: COMPLETE and green on `d5fa45c`.** CI
(type/lint/format/unit/integration-e2e/build/dependency-audit), migrations, the
account-deletion path, and the release scaffolding (dependency-audit policy,
release-notes template, EAS submit profile, rollback runbooks) are done and
CI-green. The 12-flow Maestro `mobile-e2e` suite passes end-to-end in the cloud.

**2. Feature completeness for the former Phase 20 candidate: historically MET;
for the clarified public v1: NOT YET.** The tested build includes the former
medical/physical evaluation experience and English-only copy. ADR-P017 now
requires a non-medical public physical-assessment flow, Spanish + English, and a
complete deterministic workout routine rather than the current read-only
TrainingPlan guidance. Nutrition already has deterministic breakfast/lunch/
dinner/snack planning but must be carried through the bilingual product audit.

**3. Production / store-submission readiness: BLOCKED-PRODUCT.** Phase 20
infrastructure and operational evidence remains useful, but a new candidate must
be built after Phase 21. Legal drafts, Data Safety, Health Apps declaration,
store copy, screenshots, device validation, logs, release notes, and track testing
must describe and validate that new candidate rather than the former medical-
surface build.

**4. Rebaseline scope honored.** Phase 21 Slice 1 is documentation-only. It does
not claim the medical domain is already disconnected, does not alter legal text,
and does not change source, schemas, migrations, production, or store state.
