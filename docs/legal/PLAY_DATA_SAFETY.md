# AppFitness — Google Play Data Safety Matrix (DRAFT)

> **DRAFT — NOT LEGAL ADVICE.** Engineering-produced mapping to Google
> Play's Data Safety form, grounded in `DATA_INVENTORY.md`. MUST be
> reviewed by a qualified human/legal reviewer and reconciled against the
> live Play Console form (categories change) before submission. Answers
> reflect the app **as currently built**; do not submit while blockers
> below are open.

Last updated: 2026-07-08 · Status: Draft

## Global answers

- **Is data encrypted in transit?** Yes — all production/preview traffic
  is HTTPS/TLS; release builds block cleartext.
- **Do you provide a way to request data deletion?** **Capability
  implemented (2026-07-08).** An authenticated `DELETE /auth/account`
  endpoint permanently deletes the account and all user-owned data
  (cascade), with the audit trail retained but anonymized (TECHDEBT-002
  closed; e2e-proven). **Still pending before answering "yes" on the
  form:** a user-facing surface (in-app confirmation flow and/or a
  documented request URL) and the finalized retention window — see
  Blockers.
- **Do you share data with third parties?** No (no advertising/analytics
  sharing). Error-monitoring (Sentry, when enabled) is a processor, not a
  "share" for Play purposes — **confirm in review**.

## Matrix

Columns: Collected · Shared · Purpose · Required/Optional · Encrypted in
transit · Deletion support · Notes/blockers

| Data type (Play category) | Collected | Shared | Purpose | Req/Opt | Enc. transit | Deletion | Notes |
|---|---|---|---|---|---|---|---|
| Name / username | Yes | No | Account management, app functionality | Required | Yes | Blocked | username collected; no legal name required |
| Email address | Yes | No | Account management | Required | Yes | Blocked | login identifier |
| Password / credentials | Yes | No | Account security | Required | Yes | Blocked | stored Argon2-hashed; tokens hashed |
| Health & fitness (body metrics, vitals) | Yes | No | App functionality (coaching) | Optional | Yes | Blocked | user-entered; core feature |
| Health info — free-text (doctor notes, conditions, medications) | Yes | No | App functionality (coaching, safety constraints) | Optional | Yes | Blocked | **AES-256-GCM encrypted at rest** (device + server) |
| Fitness/profile (birth date, gender, activity, goals) | Yes | No | App functionality | Optional | Yes | Blocked | birth date may map to "personal info" — confirm category |
| App activity / sync metadata | Yes | No | App functionality (offline sync) | Required | Yes | Blocked | operational; sensitive payloads encrypted |
| Crash logs / diagnostics | Only if enabled | Processor (Sentry) | App stability | — | Yes | N/A | **no DSN configured yet → not collected currently**; scrubbed of PII/PHI when enabled |
| Device identifiers (advertising) | No | No | — | — | — | — | not collected |
| Precise/approximate location | No | No | — | — | — | — | not collected |
| Contacts / photos / messages / audio | No | No | — | — | — | — | not collected |

## Blockers before submission

1. **Deletion support (P1 — resolved 2026-07-08, pending legal wording):**
   the server-side capability EXISTS (`DELETE /auth/account`, cascade +
   audit anonymization, e2e-proven; TECHDEBT-002 closed) AND is now
   **surfaced in-app** — a guarded `/delete-account` screen with a
   typed-confirmation gate calls it and wipes local data (Step 6B).
   Retention decision made: **immediate, irreversible deletion** (v1,
   ADR-P011). The remaining item before flipping the "Deletion" cells to
   "Supported" on the live form is **legal review of the deletion wording
   / confirmation that no in-scope jurisdiction mandates a retention
   window** — a legal decision, not an engineering blocker.
2. **Diagnostics decision:** confirm whether Sentry is enabled at launch;
   set the crash-logs row accordingly. Currently inert (no DSN).
3. **Health-data declarations:** Play's Health Connect / sensitive-data
   policies and any health-app declarations must be reviewed for this
   category set.
4. **Sub-processor/region disclosures** must match the finalized Privacy
   Policy.
