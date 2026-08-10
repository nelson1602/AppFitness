# AppFitness — Phase 20 External-Gate Owner Handoff

> Operational checklist for the **owner/external** gates that remain before
> the v1.0.0 store submission. Each gate is executed by the owner; Codex then
> **verifies the evidence and records the PASS** in `docs/RELEASE_READINESS.md`
> (the authoritative gate matrix). **This file does not mark any gate PASS.**

- **Target publication date:** 2026-08-20
- **Current status:** Phase 20 Slices 1–4 complete & merged. Gate B1 is
  **PASS-WITH-WAIVER**; Gate B2 is **PASS (backend + mobile)** — both live-verified;
  Gate B5 is **PASS (backend/API production smoke)** — verified 2026-08-06 with
  synthetic data only; Gate B6 is **PASS-WITH-LIMITATION (device-side mobile
  validation)** — verified 2026-08-10 on an emulator with the fixed
  production-validation APK (**physical-device biometric validation remains
  pending before store publication**; production log review remains PENDING-HUMAN).
  All other remaining gates are owner/external.
- **Production environment:** Railway Production is live and verified at
  `appfitness-production-5cfa.up.railway.app` (Gate B1). The previous Railway
  project/Development URL remains separate and untouched.

## Recommended execution order

Run **Track A (legal/store)** and **Track B (infra/build)** in parallel, then
converge on **Close-out**. Legal sign-off (A1) is the critical path (external
review latency) — start it first.

### Track A — Legal / store
1. Legal sign-off on `docs/legal/*` (A1)
2. Play Console app shell (A2)
3. Privacy-policy URL published (A3)
4. Data Safety submission (A4)

### Track B — Infra / build
1. Production/Staging environment (B1)
2. Sentry enablement + live verification (B2)
3. Production/internal-track build (B3)
4. Rollback dry-run (B4)
5. Production smoke + logs review (B5)
6. Mobile production validation (B6)

### Close-out
1. Fill release-note deploy fields (C1)
2. Final submission approval (C2)

Dependency summary: A2→A3→A4 (Data Safety needs approved wording + a live
privacy URL); B1 precedes B2 (backend DSN) and B5 (something to smoke); B3
needs A2 (Play app) + B1 (prod API URL baked via `EXPO_PUBLIC_API_URL`); B4/B6
need B3 (a published internal build); C2 is last, after every gate is PASS.

---

## Gate details

### A1 — Legal sign-off (`RELEASE_READINESS.md` item 13)
- **Owner action:** legal reviews + approves `PRIVACY_POLICY`, `TERMS_OF_USE`,
  `HEALTH_DISCLAIMER`, `PLAY_DATA_SAFETY`, `DATA_INVENTORY`; fills every
  `[PLACEHOLDER]`/`[LEGAL REVIEW REQUIRED]` (entity/contact, GDPR basis +
  health-data consent, retention window, children/min-age, international
  transfer, governing law).
- **Evidence required:** written sign-off (who/when) + finalized doc text.
- **Verification (Codex):** `rg -c "PLACEHOLDER|LEGAL REVIEW REQUIRED"
  docs/legal/*.md` → **0** across all files (today: TERMS 8, PRIVACY 13,
  DATA_INVENTORY 1, HEALTH_DISCLAIMER 1).
- **Repo files to update:** finalized `docs/legal/*`; `RELEASE_READINESS.md`
  item 13 → PASS.
- **Blocker/dependency:** none; **start first** (longest external lead time).

### A2 — Play Console app shell (`item 12`)
- **Owner action:** create the Google Play app for `com.appfitness.mobile`;
  set up the internal testing track.
- **Evidence required:** Play Console app-created confirmation (package name,
  app id) screenshot/link.
- **Verification (Codex):** none in-repo (owner attestation); cross-check the
  package name matches `mobile/app.json` `android.package`.
- **Repo files to update:** `RELEASE_READINESS.md` item 12 (partial).
- **Blocker/dependency:** none to start the shell; assets/Data Safety come later.

### A3 — Privacy-policy URL published (`item 12/13`)
- **Owner action:** publish the finalized privacy policy at a stable public URL.
- **Evidence required:** the live URL.
- **Verification (Codex):** `WebFetch <url>` resolves and matches the finalized
  `PRIVACY_POLICY.md`.
- **Repo files to update:** `PRIVACY_POLICY.md` (record published URL);
  `RELEASE_READINESS.md` item 12.
- **Blocker/dependency:** **A1** (approved wording).

### A4 — Data Safety submission (`item 12`)
- **Owner action:** complete the Play Data Safety form using
  `docs/legal/PLAY_DATA_SAFETY.md`; reconcile categories to current Play labels.
- **Evidence required:** submitted Data Safety form screenshot/summary.
- **Verification (Codex):** diff submitted answers vs `PLAY_DATA_SAFETY.md`
  (encryption/deletion/sharing rows).
- **Repo files to update:** `RELEASE_READINESS.md` item 12 → PASS.
- **Blocker/dependency:** **A1** + **A2** + **A3**.

### B1 — Production / Staging environment (`item 9`)
- **Owner action:** create a Railway **Production** project per
  `api/DEPLOYMENT.md` (Postgres, env vars incl. fresh `JWT_ACCESS_SECRET` +
  `MEDICAL_ENC_KEY`, pre-deploy `prisma migrate deploy`, `/health` check,
  backups + 1 verified restore). Distinct from the Development env.
- **Evidence required:** prod URL; `/health` 200; backup/restore confirmation.
- **Verification (Codex):** `curl -sf https://<prod>/health` → 200 (+
  `uptimeSeconds`); confirm URL ≠ the Development URL.
- **Repo files to update:** `api/DEPLOYMENT.md` "Current deployment";
  `RELEASE_READINESS.md` item 9 → PASS (prod).
- **Blocker/dependency:** none; precedes B2 (backend DSN) and B5 (smoke).
- **STATUS — PASS-WITH-WAIVER (evidence recorded 2026-08-05):** Production
  created + verified — URL `https://appfitness-production-5cfa.up.railway.app`
  (distinct from Dev; US West), `/health` = 200 (independently confirmed), 10
  migrations applied / none pending, CI green, deployed commit `4ee52a1`;
  Railway project `68c0d53d-9c53-4f12-8482-be35da190d25`, API deployment
  `0416691a-5a32-491c-b584-b9e9da5b4754`. **WAIVER (owner-approved):** backups /
  PITR require Railway Pro — owner declined; **no backups and no restore test**
  (v1 data-loss risk accepted; restore verification NOT claimed). Previous
  Railway project left untouched. Recorded in `RELEASE_READINESS.md` item 9.

### B2 — Sentry enablement + live verification (`item 10`)
- **Owner action:** follow `docs/SENTRY_ENABLEMENT.md` — create org/projects;
  set backend `SENTRY_DSN`/`SENTRY_ENVIRONMENT` (Railway) + mobile
  `EXPO_PUBLIC_SENTRY_DSN`/`_ENVIRONMENT` (EAS); add the
  `@sentry/react-native/expo` plugin + `SENTRY_AUTH_TOKEN`/`ORG`/`PROJECT` for
  source maps; trigger a live event.
- **Evidence required:** scrubbed live event link (both apps) with correct env
  tag; symbolicated mobile stack frames.
- **Verification (Codex):** `npx jest sentry-scrub` green (both packages);
  `rg -i dsn` shows **no DSN committed**; confirm the plugin is present in
  `app.config.js`. The plugin is already present; enabling release source-map
  upload still requires an authorized EAS configuration/credential change.
- **Repo files to update:** `eas.json` only if source-map upload configuration
  changes (separate authorization); `RELEASE_READINESS.md` item 10 → PASS.
- **Blocker/dependency:** **B1** (backend DSN target env).
- **STATUS — PASS (backend + mobile) (evidence recorded 2026-08-05 / 2026-08-06):**
  *Backend:* Sentry project provisioned; Railway Production variables configured
  and deployment `2b1ec9ba-a2ab-42d5-a848-6828980e5a39` succeeded on release
  `1d16b99991dc`; `/health` = 200; 10 migrations found / none pending; live issue
  [`APPFITNESS-API-1`](https://hardtech-solutions.sentry.io/issues/7654812085/), event
  `c1b6a0116fa34d82bb981f5f17a48083`, `environment=production`, synthetic
  `notes`/`token` redacted, no PII/PHI/token; backend scrubber specs 7/7 green.
  *Mobile:* EAS build `db57221a-3f96-4a87-9c93-b1d7186f72ae` (profile
  `sentry-verification`, 1.0.0 / vc3) FINISHED with **source-map upload
  succeeding** (after rotating the Sentry Organization Token); runtime-verified
  on `emulator-5554` (no crash/ANR/JS-fatal/transport failure); event
  `31f94e5b7a9e425b99d8a02ba5758eb1` (issue
  [`REACT-NATIVE-1`](https://hardtech-solutions.sentry.io/issues/7656864096/)) at
  `2026-08-06T17:46:06.750Z`, project `react-native`, `environment=production`,
  release `1.0.0 (3)`; synthetic `notes` **[REDACTED]** / `token` **[Filtered]**;
  frames **symbolicated** (`sentry.ts`, `_layout.tsx`); exactly one controlled
  event. Privacy: Sentry captured standard crash/device diagnostics, a
  pseudonymous device id, and approximate geography; the event held no PHI, no
  auth token, and no user-entered health data. The temporary `sentry-verification`
  harness never entered `main` (draft PR #31 closed unmerged).

### B3 — Production / internal-track build (`supports item 14`)
- **Owner action:** `eas build --platform android --profile production` (AAB),
  then `eas submit --platform android --profile production` to the **internal**
  track (draft) — an owner-approved store action.
- **Evidence required:** EAS build id (commit `c22cda8`+); Play internal-track
  release id.
- **Verification (Codex):** `eas build:list … --json` shows a FINISHED build on
  the release commit; confirm `versionName` 1.0.0.
- **Repo files to update:** `docs/releases/v1.0.0.md` (build/track ids).
- **Blocker/dependency:** **A2** (Play app) + **B1** (prod API URL in the build).

### B4 — Rollback dry-run (`item 8`)
- **Owner action:** execute `docs/MOBILE_ROLLBACK.md` Scenario A on the internal
  track (halt rollout + forward-fix).
- **Evidence required:** console evidence of halt + a corrected build promoted.
- **Verification (Codex):** owner attestation (not repo-verifiable) + build/track
  ids.
- **Repo files to update:** `docs/MOBILE_ROLLBACK.md` "Validation status" →
  tested; `RELEASE_READINESS.md` item 8 → PASS; close RELEASE-001.
- **Blocker/dependency:** **B3**.

### B5 — Production smoke + logs review (`items 11/14`)
- **Owner action:** deploy to prod; run the `10_DEPLOYMENT.md` 10-check
  Production Smoke; review prod logs.
- **Evidence required:** smoke checklist all-pass; logs reviewed (no critical
  errors).
- **Verification (Codex):** backend probes against the prod URL —
  `curl -sf https://<prod>/health`, auth/profile/sync reads (read-only).
- **Repo files to update:** `docs/releases/v1.0.0.md`; `RELEASE_READINESS.md`
  items 11/14.
- **Blocker/dependency:** **B1**.
- **STATUS — PASS (backend/API production smoke) (evidence recorded 2026-08-06):**
  the server-side portion of the `10_DEPLOYMENT.md` Production Smoke was executed
  against the live Production API (`https://appfitness-production-5cfa.up.railway.app`)
  using **synthetic data only** — **15/15 checks PASS**: HTTPS + `/health` 200;
  registration; login; authenticated identity (`GET /auth/me`); profile create +
  read-back (`PUT`/`GET /users/me/profile`); baseline `GET /sync/pull`; body-weight
  `POST /sync/push` applied + round-trip pull; missing-token and invalid-token
  rejection (401); logout (204) + refresh-token revocation (401); supported account
  deletion (`DELETE /auth/account`, 204) with the deleted credentials rejected
  afterward (401). **All synthetic accounts/data — this run plus the earlier
  harness-attempt orphan — were deleted via `DELETE /auth/account` and verified
  inaccessible; no synthetic records remain in Production.** No secrets, tokens,
  credentials, PII, or health data are recorded. **Scope:** backend/API smoke
  subset only — the device-side checks (SQLite init, dashboard, on-device iCoach
  recs, offline, reconnect sync) belong to **Gate B6**, and production **log
  review** (item 11) was **not** performed here (remains PENDING-HUMAN). Recorded
  in `RELEASE_READINESS.md` item 14 (backend smoke portion) + the Production Smoke
  Tests row.

### B6 — Mobile production validation (`item 14`)
- **Owner action:** install the internal/closed-track build on a real device;
  run the `10_DEPLOYMENT.md` Mobile Production Validation 10-check (open, login,
  nav, dashboard, offline, push permissions, SecureStore, biometric, **no debug
  info**, store-build-matches-env).
- **Evidence required:** signed-off checklist on a real device (device/OS noted).
- **Verification (Codex):** manual — owner attestation (not repo-verifiable).
- **Repo files to update:** `docs/releases/v1.0.0.md`; `RELEASE_READINESS.md`
  item 14 → PASS.
- **Blocker/dependency:** **B3**.
- **STATUS — PASS-WITH-LIMITATION (device-side mobile validation) (evidence
  recorded 2026-08-10):** the device-side portion of the `10_DEPLOYMENT.md` Mobile
  Production Validation was run against the fixed **production-validation** APK
  (EAS build `0ad2f78a-…`, source commit `d976c66`, app **1.0.0 / versionCode 4**,
  Production API + production Sentry) installed on the **appfitness emulator
  (Android 15 / API 35)** using a single synthetic account. **PASS:** clean cold
  launch (bundled release — no Metro/dev-client/debug), production
  registration/login, dashboard + Progress render, force-stop/relaunch session
  restore via SecureStore, and the two BUG-005 regressions — **same-date weight
  and same-date measurement each produced exactly one logical server row with the
  latest values** (no raw SQLite/native error, no "Progress unavailable", screen
  stayed usable). **Offline→reconnect round-trip PASS:** an offline CREATE (new
  date) and an offline UPDATE (existing same date) persisted across an offline
  force-stop/relaunch and synchronized on reconnect — server round-trip shows the
  correct rows with latest values, **no duplicates, no conflict, no retry loop,
  no raw SQLite message**. Sentry initialized for `production` (no DSN/token
  exposed); no AppFitness crash/ANR/native/JS/SQLite/sync/cleartext/Sentry-transport
  failure. The synthetic account was deleted via the supported in-app flow and its
  credentials were rejected afterward (no synthetic data remains). No secrets,
  tokens, synthetic identifiers, or signer fingerprints are recorded.
  **LIMITATION:** validation used a **sideloaded production-equivalent APK on an
  emulator** — **not** a Google Play internal-track build and **not** a physical
  device. **Biometric was NOT APPLICABLE on the emulator; physical-device
  biometric validation remains pending before store publication.** One transient
  Android **SystemUI "isn't responding"** dialog was emulator-only (system, not
  AppFitness). Recorded in `RELEASE_READINESS.md` item 14 + the Mobile Production
  Validation row.

### C1 — Fill release-note deploy fields (Phase 20 close-out)
- **Owner action:** provide the deploy-time values for `docs/releases/v1.0.0.md`
  `[SET AT RELEASE]` fields: backend api commit, environment (Production),
  actual release date, track.
- **Evidence required:** the values above.
- **Verification (Codex):** `rg -c "SET AT RELEASE" docs/releases/v1.0.0.md` →
  **0** after update.
- **Repo files to update:** `docs/releases/v1.0.0.md`.
- **Blocker/dependency:** **B1** (env), **B3** (track).

### C2 — Final submission approval (Phase 20 exit)
- **Owner action:** confirm every gate PASS and record explicit submission
  approval; promote the internal build through closed → production tracks.
- **Evidence required:** owner approval statement + track promotion evidence.
- **Verification (Codex):** `RELEASE_READINESS.md` matrix all **PASS or
  explicitly waived**; internal→closed→production progression recorded.
- **Repo files to update:** `RELEASE_READINESS.md` Phase 20 exit → met
  (Slice 5 close-out).
- **Blocker/dependency:** **all gates A1–B6 + C1**.

---

## Evidence packet template (owner → Codex)

Paste this back per gate (or batched) so Codex can verify + record the PASS:

```
Gate: <A1 | A2 | A3 | A4 | B1 | B2 | B3 | B4 | B5 | B6 | C1 | C2>
Date: <YYYY-MM-DD>
Owner: <name>
Action taken: <one line>
Evidence:
  - <link / screenshot ref / URL / build id / track id>
  - <secondary evidence if any>
Values (if applicable):
  - prod API URL: <https://…>            # B1/B5
  - privacy policy URL: <https://…>      # A3
  - EAS build id / versionName: <id / 1.0.0>   # B3
  - Play track / release id: <…>         # B3/B4/C2
  - backend api commit / env: <sha / Production>   # C1
  - actual release date: <YYYY-MM-DD>    # C1
Notes / caveats: <anything Codex should know>
```

> On receipt, Codex runs the read-only verification listed for that gate,
> updates `docs/RELEASE_READINESS.md` (and the noted repo files) to record the
> PASS with an evidence citation, and stops before commit for authorization.
> Codex does **not** execute the gate, enable Sentry, add the Sentry plugin,
> create environments, or perform Play/legal actions.
