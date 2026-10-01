# FEATURE-012 S-5 — Subscription Sandbox and Lifecycle Evidence

Status: **OPEN — in-repo proof recorded; no external store or provider evidence yet**
Owner: Product / Architecture / QA
Created: 2026-10-01 (base `d8a076e`)
Revised: 2026-10-01 — audit correction (ADR-P028 identity) and owner decision D-2

This is the S-5 evidence matrix for ADR-P034. It separates what the repository
proves today from what only RevenueCat, Apple, Google and physical devices can
prove. **Nothing in the external columns has been run.** No row may move to
PROVEN on the strength of a mock, a unit test or Expo Go (ADR-P034 Decision 11).
S-5 and FEATURE-012 stay open until each external cell carries recorded
evidence.

## Evidence tiers

| Tier | Meaning | Runs where |
|---|---|---|
| **T0** | Unit and integration proof in this repository, run by CI | Jest (mobile and API), API e2e on a disposable Postgres |
| **T1** | RevenueCat Test Store (simulated purchases, never real money) | A `__DEV__` development build carrying `EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY` (see [Test Store boundary](#test-store-boundary-d-2)) — supported in-repo, **never run** |
| **T2** | Apple sandbox and TestFlight | A signed iOS build and an Apple sandbox tester |
| **T3** | Google Play license testing and internal track | An internal-track build and a license tester |
| **T4** | Physical-device outcome (airplane mode, real clock, store sheets) | A real phone on T2 or T3 |

Cell values: **PROVEN** (with its evidence), **NOT RUN** (possible now, not
done), **BLOCKED P-n / D-n** (waiting on the named prerequisite or decision), or
**N/A**.

## Matrix

T0 cells cite the exact spec and test title. Mobile paths are under
`mobile/src/`, API paths under `api/`.

| # | Row | T0 — in-repo proof | T1 | T2 | T3 | T4 |
|---|---|---|---|---|---|---|
| 1 | Eligible one-month trial shown | **PROVEN** — `revenuecat-purchases.adapter.spec.ts`: *shows the free trial only when the SDK reports eligibility*, *uses the default option full-price phase and its free phase*; `SubscriptionScreen.spec.tsx`: *presents the trial only when the offer carries a confirmed free trial* | NOT RUN — BLOCKED P-1, P-2 | BLOCKED P-3…P-6, P-11 | BLOCKED P-4, P-7…P-11 | BLOCKED P-11 |
| 2 | Ineligible user sees the normal monthly offer | **PROVEN** — adapter: *uses ordinary paid terms when eligibility is %s*, *uses ordinary paid terms when the default option has no free phase*; screen: *shows ordinary paid terms with the store price verbatim when no trial is confirmed* | NOT RUN — BLOCKED P-1, P-2 | BLOCKED P-3…P-6, P-11 | BLOCKED P-4, P-7…P-11 | BLOCKED P-11 |
| 3 | Purchase success | **PROVEN** — adapter: *buys the exact package the offer load returned*; `subscription.store.spec.ts`: *shows success only when the provider reports the entitlement active* | NOT RUN — BLOCKED P-1, P-2 | BLOCKED P-3…P-6, P-11 | BLOCKED P-4, P-7…P-11 | BLOCKED P-11 |
| 4 | Cancellation (store sheet dismissed) | **PROVEN** — adapter: *reports %s as cancelled, not as an error*; store: *treats cancellation as a choice: no error and no notice* | NOT RUN — BLOCKED P-1, P-2 | BLOCKED P-3…P-6, P-11 | BLOCKED P-4, P-7…P-11 | BLOCKED P-11 |
| 5 | Pending purchase | **PROVEN** — adapter: *reports a pending payment as pending, never as active*; store: *never reports a %s purchase as active*, *performs no provider operation for a second purchase while pending* | NOT RUN — BLOCKED P-1, P-2 | BLOCKED P-3…P-6, P-11 (Ask to Buy) | BLOCKED P-4, P-7…P-11 (slow test card) | BLOCKED P-11 |
| 6 | Restore | **PROVEN** — store: *restores an active entitlement*, *says plainly when nothing was restored and keeps the offer* | NOT RUN — BLOCKED P-1, P-2 | BLOCKED P-3…P-6, P-11 | BLOCKED P-4, P-7…P-11 | BLOCKED P-11 |
| 7 | Expiry | **PROVEN** — `entitlement-authorization.service.spec.ts`: *fails closed for an enabled provider with a %s mirror*; `test/entitlement-enforcement.e2e-spec.ts`: *refuses an inactive and an expired mirror*; `revenuecat-entitlement.provider.spec.ts`: *treats a refund or elapsed expiry as inactive* | NOT RUN — BLOCKED P-1, P-2 | BLOCKED P-3…P-6, P-11, P-12 (accelerated sandbox renewals) | BLOCKED P-4, P-7…P-12 (accelerated test renewals) | BLOCKED P-11, P-12 |
| 8 | Refund or revocation | **PROVEN** — provider: *treats a refund or elapsed expiry as inactive*; `subscription.service.spec.ts`: *reconciles from provider, persists the mirror and audits only a change* | N/A (no refund in Test Store) | BLOCKED P-3…P-6, P-12 | BLOCKED P-4, P-7…P-10, P-12 | BLOCKED P-12 |
| 9 | Billing retry and grace period | **PROVEN (server rule)** — provider: *uses a later grace expiry and preserves cancellation until expiry*. Whether grace is on is a store-console setting (P-5, P-8) | N/A | BLOCKED P-5, P-12 | BLOCKED P-4, P-8, P-12 | BLOCKED P-12 |
| 10 | Offline cached access up to RevenueCat's three-day window | **PARTIAL** — the client uses only the SDK-reported entitlement and adds no extension (`entitlement-access.spec.ts`: *authorizes only the owner whose active evidence was published*). The three-day behaviour itself belongs to the SDK and **cannot** be proven in-repo | N/A | BLOCKED P-3…P-6, P-11 | BLOCKED P-4, P-7…P-11 | **Required** — BLOCKED P-11 |
| 11 | Read-only after trusted access expires | **PROVEN** — `entitlement-access.spec.ts`: *fails closed while checking and when the provider reports inactive*; `DashboardScreen.spec.tsx`: *explains read-only access and keeps account, subscription and navigation actions usable* | NOT RUN — BLOCKED P-1, P-2 | BLOCKED P-3…P-6, P-11 | BLOCKED P-4, P-7…P-11 | BLOCKED P-11 |
| 12 | Queue preservation and later resumption | **PROVEN** — `sync-worker.spec.ts`: *resumes the preserved queue once trusted access returns, with nothing lost or retried*, *keeps the queue untouched but still pulls while the account is read-only*; `wellness-safety-profile.repository.spec.ts`: *rolls the row back when paid access is unavailable* | NOT RUN — BLOCKED P-1, P-2 | BLOCKED P-3…P-6, P-11, P-12 | BLOCKED P-4, P-7…P-12 | BLOCKED P-11, P-12 |
| 13 | Account-switch isolation | **PROVEN** — store: *never publishes across accounts: an account switch mid-read publishes nothing for the old owner*; `subscription-purchases.spec.ts`: *configures with the authenticated UUID and switches A -> B directly*, *refuses account B's purchase of an offer account A loaded* | NOT RUN — BLOCKED P-1, P-2 | BLOCKED P-3…P-6, P-11 | BLOCKED P-4, P-7…P-11 | BLOCKED P-11 |
| 14 | Server mirror reconciliation | **PROVEN** — `subscription.service.spec.ts`: *reconciles from provider, persists the mirror and audits only a change*, *does not move lastProviderEventAt backwards for an out-of-order event*; `test/subscription-webhook.e2e-spec.ts`; store: *reports a failed server reconciliation but keeps the confirmed access* | NOT RUN — BLOCKED P-1, P-2, P-12 | BLOCKED P-3…P-6, P-11, P-12 | BLOCKED P-4, P-7…P-12 | BLOCKED P-11, P-12 |

**T0 totals:** 13 rows PROVEN in-repo and row 10 PARTIAL by design. Every
external cell is NOT RUN, BLOCKED or N/A, and none is PROVEN. T1 cells are
NOT RUN: the in-repo Test Store path exists, but no RevenueCat account,
Test Store or Test Store execution exists yet.

## Prerequisites (verified 2026-10-01, read-only)

| Id | Prerequisite | Status | Evidence |
|---|---|---|---|
| P-1 | RevenueCat account and project | **UNVERIFIED — assumed absent** | No RevenueCat key or credential in the repository, EAS profiles or Railway |
| P-2 | RevenueCat entitlement `appfitness_pro`, a current offering, a monthly package; for T1 also a Test Store with a monthly product in that package and its public Test Store key | **UNVERIFIED — assumed absent** | Depends on P-1 |
| P-3 | Apple Developer Program membership, Paid Apps agreement, banking and tax | **UNVERIFIED** | Nothing in the repository |
| P-4 | Native publication identity: `com.appfitnessrd.mobile` for iOS and Android, display name `AppFitnessRD` | **ACCEPTED TARGET — NOT IMPLEMENTED; live availability NOT VERIFIED** | ADR-P028 (Accepted 2026-08-31) freezes these values. UX-4B-1 is not implemented: `mobile/app.json` still carries the pre-freeze `AppFitness` / `android.package` `com.appfitness.mobile` and has no `ios.bundleIdentifier`. Availability of the identifier in App Store Connect and Play Console has not been checked live. UX-4B-1 is a separately authorized slice and is **not** part of S-5 |
| P-5 | App Store Connect app record for `com.appfitnessrd.mobile`, subscription group, monthly product with a one-month free introductory offer, sandbox tester | **MISSING** | Depends on P-3, P-4; no app record is evidenced |
| P-6 | RevenueCat App Store configuration (In-App Purchase key) | **MISSING** | Depends on P-1, P-5 |
| P-7 | Google Play developer account, app record for `com.appfitnessrd.mobile`, payments profile | **UNVERIFIED** | Depends on P-4. Phase 20 gate A2 targeted the pre-freeze `com.appfitness.mobile` and is owner attestation only; there is no live evidence of a Play app record for either package. No Play internal-track build was ever published (Gate B6 used an emulator APK) |
| P-8 | Play subscription with a monthly base plan and a one-month free-trial offer, license testers | **MISSING** | Depends on P-7 and on P-9 (Play requires an uploaded billing build) |
| P-9 | An internal-track build of `com.appfitnessrd.mobile` containing the billing library | **MISSING** | Depends on P-4 (the first upload fixes the package permanently). No internal-track build exists; `mobile/credentials/play-service-account.json` (the `eas submit` key) is not present |
| P-10 | RevenueCat Google Play configuration (service-account credential) | **MISSING** | Depends on P-1, P-7 |
| P-11 | Public platform SDK keys (`appl_`, `goog_`) in EAS for a preview profile (T2/T3; never the Test Store key) | **MISSING** | `eas.json` defines no `EXPO_PUBLIC_REVENUECAT_*`; EAS environment variables could not be listed because the EAS CLI is not logged in on this machine (P-13) |
| P-12 | Development API provider enabled and webhook registered | **MISSING** | Railway Development and Production both have **no** `REVENUECAT_*` variable, so the provider is disabled and no webhook is configured |
| P-13 | EAS CLI login on the operator machine | **MISSING** | `eas whoami` reports not logged in |

| Id | Decision | Why it is needed |
|---|---|---|
| D-1 | ~~The iOS bundle identifier~~ | **Withdrawn — not an open decision.** The first audit listed it in error: ADR-P028 already freezes `com.appfitnessrd.mobile` for iOS and Android. The real blocker is P-4 (UX-4B-1 not implemented, live availability not verified) |
| D-2 | Whether development builds may accept a RevenueCat Test Store key | **Approved by the owner 2026-10-01** for development builds only, impossible in preview, release and production builds. Implemented in-repo; see [Test Store boundary](#test-store-boundary-d-2) |

## Test Store boundary (D-2)

`mobile/src/features/subscriptions/infrastructure/revenuecat-config.ts` reads a
dedicated public variable, `EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY`. The
`test_` prefix comes from the installed SDK (its browser module accepts
`test_` as a Test Store key) and from RevenueCat's official iOS and Android SDK
key validators. RevenueCat's documentation does not state the prefix. The key
is accepted only when all of these hold; otherwise configuration fails closed
and the app stays unconfigured:

- `__DEV__ === true`, the React Native development-bundle flag. Release
  bundles set it to `false`. The repository has no stricter build signal.
- The platform is iOS or Android.
- No `appl_` or `goog_` platform key is configured beside it.
- The key starts with `test_` and has content after the prefix.

A blank Test Store variable is ignored, so missing-key inert behaviour and the
Apple and Google key rules are unchanged. Rejection messages are fixed strings
with no key material. The proof is in `revenuecat-config.spec.ts` and
`subscription-runtime.spec.ts` (*RevenueCat Test Store* blocks).

**Which build can run T1.** The `development` EAS profile in `mobile/eas.json`
sets no `developmentClient`, and `expo-dev-client` is not installed, so that
profile produces a release-variant bundle with `__DEV__ === false`. It rejects
the Test Store key by design. T1 therefore runs on a local debug build: for
example `npx expo run:android` on the existing emulator, with the key in an
untracked `mobile/.env.local` (`.env*.local` is git-ignored). Never commit
or paste the key. No Apple or Google account is needed for T1.

## Evidence capture protocol

For every external cell, record: date, tier, EAS build id and profile, store
environment (sandbox or test track), the **label** of the test account (never
an email, UUID, token or receipt), the observed UI outcome, and the server
mirror state.

Read the server mirror with the authenticated status endpoint. It returns no
identifier, only `state`, `expiresAt`, `periodType`, `store`, `willRenew` and
`lastReconciledAt`:

```sh
curl -sS -H "Authorization: Bearer $APPFITNESS_TEST_TOKEN" \
  https://appfitness-production-1e78.up.railway.app/subscriptions/status
```

That host is **Development**. Never paste the token into this document or a
commit. Enabling P-12 on Development makes paid writes require an entitlement
there, so use only disposable test accounts.

## Related documents

- `.ai/12_DECISIONS.md` — ADR-P034 (Decisions 5–11, S-1…S-4 records)
- `.ai/11_BACKLOG.md` — FEATURE-012
- `docs/RELEASE_READINESS.md` — publication blockers
- `api/DEPLOYMENT.md` — `REVENUECAT_*` variables
