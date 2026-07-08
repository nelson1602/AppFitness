# AppFitness — Mobile Store Rollback Runbook

Rollback procedures for the Expo/EAS Android app. Complements the backend
rollback in `api/DEPLOYMENT.md`. OTA is deferred (ADR-P010), so mobile
rollback is **track/version-based**, not an over-the-air revert.

Last reviewed: 2026-07-08 · Status: documented; not yet exercised on a
live Play track (see "Validation status").

## Principles

- No `expo-updates` yet → a shipped build cannot be hot-patched; recovery
  is via the Play Console track (halt/rollout) plus a corrected build.
- Version codes only increase (`eas.json` production `autoIncrement`).
  You cannot re-upload a lower/equal versionCode — forward-fix, never
  "re-push the old number".
- Client talks to a versioned backend; a mobile rollback must stay
  compatible with the currently-deployed API (API is expand-first, so an
  older client keeps working — verify per release).

## Scenario A — bad build caught during staged rollout (internal/closed)

1. Play Console → the app → Testing → the affected track → **halt
   rollout** (or reduce rollout %) to stop further distribution.
2. Testers on the bad build: instruct to reinstall the prior track build,
   or ship the fix (Scenario C). Internal-track audiences are small.
3. Record the incident in the release notes for the fixed version.

## Scenario B — bad build in production staged rollout

1. Play Console → Production → **halt the staged rollout** immediately
   (this stops new users receiving it; already-updated users keep it —
   there is no forced downgrade on Android).
2. Assess severity: data-safety/security/crash-loop → treat as urgent
   forward-fix (Scenario C) and consider a Play "app deactivation" only
   as a last resort.
3. Communicate via release notes / support channel.

## Scenario C — forward-fix (the primary mechanism)

1. Fix on a `fix/` branch; ensure CI green (all required checks).
2. Bump nothing manually — `production` profile auto-increments the
   versionCode; keep or bump `expo.version` in `app.json` per SemVer.
3. `eas build --platform android --profile production`.
4. `eas submit --platform android --profile production` (draft/internal
   first; see `eas.json` submit profile) — **owner-approved store action**.
5. Promote through tracks once validated.

## Backend coupling

- If a mobile release depended on a backend change, roll the API back
  first/simultaneously per `api/DEPLOYMENT.md` (previous image redeploy),
  keeping the expand-first schema so older clients still function.
- Never roll the API to a schema an in-the-wild client can't tolerate.

## Pre-release safeguards (reduce rollback need)

- Staged rollout (start small %) on production.
- Internal track validation before closed/production.
- `docs/RELEASE_READINESS.md` matrix must be clean for the release.

## Validation status

This runbook is **documented but not yet exercised** against a live Play
track (no app published). First real internal-track release should do a
dry-run of Scenario A (halt + forward-fix) to validate the procedure —
tracked in RELEASE-001 / Phase 12 exit criteria ("rollback plan
documented and tested").
