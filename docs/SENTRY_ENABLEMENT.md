# AppFitness — Sentry Enablement Runbook

> **Runbook only — Sentry is NOT enabled by this document.** Enabling Sentry
> is an owner/external gate (ADR-P010; `RELEASE_READINESS.md` item 10).
> Follow these steps at enablement time; nothing here provisions accounts,
> secrets, or DSNs.

Last updated: 2026-08-05 · Evidence commit `9da7482` (Phase 20 Slice 3).

## Current state (as built)

- Sentry is **wired but inert** on both apps — it initializes **only** when a
  DSN is present, and no DSN is configured, so no events are sent today.
  - **Mobile:** `mobile/src/shared/infrastructure/monitoring/sentry.ts` calls
    `Sentry.init` only if `process.env.EXPO_PUBLIC_SENTRY_DSN` is set;
    environment from `EXPO_PUBLIC_SENTRY_ENVIRONMENT` (falls back to
    `__DEV__ ? 'development' : 'production'`). Dependency
    `@sentry/react-native@~7.11.0`.
  - **Backend:** `api/src/instrument.ts` calls `Sentry.init` only if
    `process.env.SENTRY_DSN` is set; environment from `SENTRY_ENVIRONMENT`.
- **Privacy scrubbers** exist on both sides
  (`mobile/src/shared/infrastructure/monitoring/sentry-scrub.ts`,
  `api/src/monitoring/sentry-scrub.ts`): `sendDefaultPii` off,
  `beforeSend`/`beforeBreadcrumb` redact a token/PII/PHI key-list. Medical
  free-text is encrypted before any loggable layer.
- `mobile/eas.json` sets `SENTRY_DISABLE_AUTO_UPLOAD: "true"` in every build
  profile. **Gap:** there is **no `@sentry/react-native/expo` config plugin** in
  `mobile/app.json`, so release source-map upload/symbolication is **not
  configured yet** (that env var is currently a no-op). See step 4.

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
   - Add the `@sentry/react-native/expo` config plugin to `mobile/app.json`
     `plugins` (this is a **separate config change**, intentionally NOT done in
     Phase 20 Slice 3).
   - Provide `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN` to the EAS
     build environment so the plugin can upload source maps.
   - The `SENTRY_DISABLE_AUTO_UPLOAD` flags in `eas.json` should be revisited
     once the plugin is added (they currently gate an upload path that is not
     yet configured).

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
- Do not add the Expo config plugin as part of Phase 20 Slice 3 (deferred to
  enablement, step 4).
- Do not mark `RELEASE_READINESS.md` item 10 complete until a live scrubbed
  event is verified.
