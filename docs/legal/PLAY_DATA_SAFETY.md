# AppFitnessRD — Google Play Data Safety Matrix (DRAFT)

> **DRAFT — NOT LEGAL ADVICE.** Engineering-produced mapping to Google
> Play's Data Safety form, grounded in `DATA_INVENTORY.md`. MUST be
> reviewed by a qualified human/legal reviewer and reconciled against the
> live Play Console form (categories change) before submission. Answers
> reflect the app **as currently built**; do not submit while blockers
> below are open.

Last updated: 2026-08-05 · Status: Draft · Evidence commit `5bc6683` ·
App state: Phases 13–17 complete (incl. nutrition, workout, progress).

## Global answers

- **Is data encrypted in transit?** Yes — all production/preview traffic
  is HTTPS/TLS; release builds block cleartext.
- **Do you provide a way to request data deletion?** **Yes — implemented
  and surfaced in-app (pending legal wording confirmation).** A guarded
  `/delete-account` flow (typed-confirmation gate) calls
  `DELETE /auth/account`, which permanently and irreversibly deletes the
  account and all user-owned data (cascade — incl. nutrition, workout, and
  progress entities), with the audit trail retained but anonymized
  (ADR-P011; e2e-proven). The only open item before finalizing the form
  answer is **legal confirmation of the deletion wording / that no
  in-scope jurisdiction mandates a retention window** (a legal decision,
  not an engineering gap).
- **Do you share data with third parties?** No (no advertising/analytics
  sharing). Error-monitoring (Sentry, when enabled) is a processor, not a
  "share" for Play purposes — **confirm in review**.

## Matrix

Columns: Collected · Shared · Purpose · Required/Optional · Encrypted in
transit · Encrypted at rest · Deletion support · Notes/blockers

| Data type (Play category) | Collected | Shared | Purpose | Req/Opt | Enc. transit | Enc. at rest | Deletion | Notes |
|---|---|---|---|---|---|---|---|---|
| Name / username | Yes | No | Account management, app functionality | Required | Yes | No (hashed creds only) | Supported | username collected; no legal name required |
| Email address | Yes | No | Account management | Required | Yes | No | Supported | login identifier |
| Password / credentials | Yes | No | Account security | Required | Yes | Hashed (Argon2) | Supported | tokens stored hashed |
| Health info — free-text (doctor notes, conditions, medications) | Yes | No | App functionality (coaching, safety constraints) | Optional | Yes | **Yes (AES-256-GCM)** | Supported | encrypted device + server |
| Health & fitness — body metrics / vitals (evaluation) | Yes | No | App functionality (coaching) | Optional | Yes | No (structured) | Supported | user-entered |
| **Health & fitness — progress body metrics** (weight, waist/hip/chest, body-fat %, weekly snapshots) | Yes | No | App functionality (progress monitoring) | Optional | Yes | **No — wellness plaintext (ADR-P016 D1)** | Supported | do NOT claim at-rest encryption |
| **Health & fitness — nutrition/dietary intake** (food logs, calories, macros) | Yes | No | App functionality (nutrition tracking) | Optional | Yes | No (structured) | Supported | food + quantity = health data; sensitive sync-queue payload encrypted on device |
| **Health & fitness — dietary preferences / allergies** | Yes | No | App functionality (safety warnings) | Optional | Yes | **Note field: Yes (AES-256-GCM)** | Supported | allergy data; free-text note encrypted |
| **Health & fitness — workout/exercise activity** (logs, sets, routines) | Yes | No | App functionality (workout tracking) | Optional | Yes | No (structured) | Supported | fitness activity |
| Fitness/profile (birth date, gender, activity, goals) | Yes | No | App functionality | Optional | Yes | No | Supported | birth date may map to "Personal info" — confirm category |
| User-generated content (custom exercise name/instructions) | Yes | No | App functionality | Optional | Yes | No | Supported | user-created catalog entries |
| App activity / sync metadata | Yes | No | App functionality (offline sync) | Required | Yes | Sensitive payloads encrypted in queue | Supported | operational |
| Crash logs / diagnostics | Only if enabled | Processor (Sentry) | App stability | — | Yes | — | N/A | **no DSN configured yet → not collected currently**; scrubbed of PII/PHI when enabled |
| Device identifiers (advertising) | No | No | — | — | — | — | — | not collected |
| Precise/approximate location | No | No | — | — | — | — | — | not collected |
| Contacts / photos / messages / audio | No | No | — | — | — | — | — | not collected |

## Blockers before submission

1. **Deletion wording (legal only):** the engineering surface is DONE —
   in-app `/delete-account` + `DELETE /auth/account`, immediate irreversible
   cascade (ADR-P011), e2e-proven. Remaining: **legal confirmation of the
   deletion wording and that no in-scope jurisdiction mandates a retention
   window.** Not an engineering blocker.
2. **Diagnostics decision:** confirm whether Sentry is enabled at launch;
   set the crash-logs row accordingly. Currently inert (no DSN).
3. **Health-data declarations:** Play's Health Connect / sensitive-data
   policies and any health-app declarations must be reviewed for this
   category set (now spanning medical, nutrition, workout, and progress
   wellness data).
4. **Sub-processor / region disclosures** must match the finalized Privacy
   Policy.
5. **Category reconciliation:** map each row above to the exact current Play
   Console Data Safety category/subtype (labels drift) during form entry.
