# AppFitness — Sentry Enablement Runbook

> **Operational runbook.** Backend Sentry is enabled and live-verified in
> Production; mobile enablement remains an owner/external gate (ADR-P010;
> `RELEASE_READINESS.md` item 10). This document never stores DSNs or tokens.

Last updated: 2026-08-05 · Evidence commit `9da7482` (Phase 20 Slice 3).

## Current state (as built)

- **Mobile is wired but inert:**
  `mobile/src/shared/infrastructure/monitoring/sentry.ts` calls
  `Sentry.init` only if `process.env.EXPO_PUBLIC_SENTRY_DSN` is set;
  environment from `EXPO_PUBLIC_SENTRY_ENVIRONMENT` (falls back to
  `__DEV__ ? 'development' : 'production'`). Dependency
  `@sentry/react-native@~7.11.0`.
- **Backend is enabled + verified:** Railway Production provides
  `SENTRY_DSN`/`SENTRY_ENVIRONMENT`; `api/src/instrument.ts` initializes on
  boot. A scrubbed live event was verified in `production` on 2026-08-05 (see
  `RELEASE_READINESS.md` item 10). No secret value is recorded here.
- **Privacy scrubbers** exist on both sides
  (`mobile/src/shared/infrastructure/monitoring/sentry-scrub.ts`,
  `api/src/monitoring/sentry-scrub.ts`): `sendDefaultPii` off,
  `beforeSend`/`beforeBreadcrumb` redact a token/PII/PHI key-list. Medical
  free-text is encrypted before any loggable layer.
- The `@sentry/react-native/expo` config plugin is already registered in
  `mobile/app.config.js`. `mobile/eas.json` still sets
  `SENTRY_DISABLE_AUTO_UPLOAD: "true"` in every build profile, so release
  source-map upload/symbolication remains disabled pending approved EAS
  credentials/configuration. See step 4.

## Enablement steps (owner)

1. **Create the Sentry org + projects.** One project for the React Native app
   and one for the NestJS backend (or a combined project per team preference).

2. **Backend DSN (Railway secret store — never in the repo):**
   - Set `SENTRY_DSN` = the backend project DSN.
   - Set `SENTRY_ENVIRONMENT` = `production` (or `staging`) to match the
     deploy target.
   - Redeploy; `api/src/instrument.ts` will initialize on boot.

3. **Mobile DSN (build-time env, injected per EAS build — not committed):**
   - Set `EXPO_PUBLIC_SENTRY_DSN` = the mobile project DSN.
   - Set `EXPO_PUBLIC_SENTRY_ENVIRONMENT` = `production`.
   - Provide these via the EAS build environment (EAS project env vars /
     profile env), not by editing `eas.json` in the repo with a real DSN.

4. **Source maps / symbolication (required for readable release stack traces):**
   - The `@sentry/react-native/expo` plugin is already registered in
     `mobile/app.config.js`; do not add a duplicate entry.
   - Provide `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN` to the EAS
     build environment so the plugin can upload source maps.
   - The `SENTRY_DISABLE_AUTO_UPLOAD` flags in `eas.json` should be revisited
     when upload credentials are approved (they currently keep uploads
     disabled).

5. **Verify scrubbers BEFORE trusting production events.** Re-run the scrubber
   tests (`sentry-scrub.spec.ts` on both sides) and confirm a test event
   contains no tokens/PII/PHI. Medical free-text must never appear (it is
   encrypted upstream).

6. **Live-event verification.** Trigger a test error in each app against the
   configured environment and confirm it arrives in Sentry, scrubbed, with the
   correct environment tag and (for mobile) symbolicated frames. Record the
   verification in `docs/RELEASE_READINESS.md` item 10.

## Do NOT (in this slice / this runbook)

- Do not commit a real DSN, auth token, org, or project slug.
- Do not duplicate or move the existing Expo config plugin without a separate
  config-change review.
- Do not mark `RELEASE_READINESS.md` item 10 complete until scrubbed live events
  are verified for both backend and mobile, with mobile frames symbolicated.
