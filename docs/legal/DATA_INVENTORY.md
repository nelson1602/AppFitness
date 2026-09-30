# AppFitnessRD — Data Inventory

> **DRAFT — NOT LEGAL ADVICE.** This engineering inventory grounds the
> compliance drafts in this folder. It MUST be reviewed by a qualified
> human/legal reviewer before derived artifacts are published or used for a
> store submission. It describes the current repository and verified deployment
> evidence; legal classifications and obligations remain external decisions.

Last technically updated: 2026-09-30 · Status: Draft · Evidence baseline
`f995dec` plus the FEATURE-012 S-2 candidate · App state: public-v1 Phase 21 wellness product. Habits,
notifications, supplement education, and mobile/Web feature parity are not
implemented. A store subscription is required for v1; its fail-closed server
foundation and an inert native adapter are implemented, while purchase UX,
enforcement and provider configuration are not. Azul is not selected for native
checkout.

## Scope and evidence

Grounds `PRIVACY_POLICY.md`, `TERMS_OF_USE.md`,
`HEALTH_DISCLAIMER.md`, and `PLAY_DATA_SAFETY.md`. Sources include:

- `.ai/00_PROJECT.md`, `.ai/05_SECURITY.md`, and `.ai/07_ICOACH.md`;
- accepted ADR-P011, P012, P017, P019, P026, P029, P030, P031, and P034;
- `api/prisma/schema.prisma` and forward migrations;
- the mobile SQLite migrations, repositories, sync queue/conflict store, and
  composition roots;
- deployment/release evidence for Railway, Postmark, Cloudflare, and Sentry.

## Data categories collected or processed by public v1

| Category                        | Representative fields                                                                                                                            | Engineering classification                                   | Source                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------- |
| Account/auth                    | email, username, Argon2 password hash, role, email-verification timestamp, hashed refresh/reset/verification tokens                              | Critical credentials/tokens + personal identifier            | registration/authentication     |
| Profile                         | birth date, gender, height, fitness/activity level, training history, occupation, sleep/stress baselines, equipment, schedule, nutrition targets | Highly sensitive health-adjacent/profile                     | user                            |
| Goals                           | goal type, target weight/date                                                                                                                    | Sensitive                                                    | user                            |
| Wellness Safety Profile         | evaluation-completed flag, optional date, closed-list affected-area and movement-to-avoid tokens                                                 | Sensitive wellness                                           | user declaration                |
| Nutrition preferences/allergies | catalog key, exclusion type/kind, optional encrypted note                                                                                        | Highly sensitive health-adjacent                             | user                            |
| Nutrition logs                  | food catalog key/snapshot, serving quantity, calories, macros, meal/date structure                                                               | Sensitive health/fitness                                     | user                            |
| Workout logs and sets           | workout name/start, exercise references, reps, weight, completion                                                                                | Sensitive fitness activity                                   | user                            |
| Routines/custom exercises       | routine name/order; custom name, muscle group, instructions                                                                                      | Sensitive fitness + user-generated content                   | user                            |
| Progress metrics                | weight, waist/hip/chest, body-fat percentage, muscle mass, optional note, date                                                                   | Sensitive wellness                                           | user                            |
| Weekly progress snapshots       | deterministic averages/totals/counts/deload signal and rule version                                                                              | Sensitive derived wellness                                   | computed on device              |
| Sync operations/conflicts       | operation id/type, entity identity, versions, retry/status/error metadata, cursors, client/server snapshots, standing resolution                 | Sensitive operational data; payload may contain feature data | generated by app/server         |
| Device/local security           | local SQLite database, SecureStore session values, device field-encryption key                                                                   | Critical key + operational                                   | generated on device             |
| Transactional email             | recipient address, language, recovery/verification message and bearer link                                                                       | Personal/account-security                                    | generated for Postmark delivery |
| Diagnostics                     | error/message/stack, opaque user id, app/device/runtime/environment metadata after scrubbers                                                     | Sensitive operational                                        | configured runtime              |
| Security audit                  | action, optional de-linked user/device/entity references, operational metadata, timestamp                                                        | Security operational                                         | API                             |
| Subscription entitlement       | AppFitness user UUID, entitlement/activity state, expiry, period/product/store/environment/renewal state; webhook event id/type/time/status, attempt count and payload digest | Sensitive purchase/access operational data; no receipt or full webhook payload | RevenueCat reconciliation/webhook |

## Public-v1 medical boundary and retained legacy data

Public v1 does **not** collect, display, synchronize, or use doctor notes,
medications, medical conditions, blood pressure, professional restrictions,
diagnoses, treatments, rehabilitation instructions, medical clearance, or
professional evaluation results. `MedicalModule` is absent from the API
composition root, medical sync appliers are unregistered, no public mobile route
renders the dormant feature, and public-v1 iCoach reads only wellness inputs.

The schema and source retain dormant legacy `medical_evaluations` and
`medical_restrictions` structures. Existing rows may therefore remain from
older builds. Their encrypted free-text, access control, redaction, and deletion
protections remain in force. Dormancy is not deletion or reclassification.

## Storage locations and protection

| Location           | Data                                                                                                                                                                      | Protection / boundary                                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native SecureStore | access/refresh tokens, session data, device field-encryption key                                                                                                          | OS secure keystore; never SQLite                                                                                                                                                             |
| Native SQLite      | offline operational copy of profile, goals, wellness safety, nutrition, workout, progress, sync operations/conflicts, plus any retained legacy medical rows               | app-private DB; optional dietary note and retained legacy medical free-text use AES-256-GCM; other structured wellness/fitness data is not field-encrypted                                   |
| Backend PostgreSQL | system of record for accounts, profiles, goals, wellness safety, nutrition, workout, progress, auth-token hashes, sync/conflicts, audit, normalized subscription entitlement/webhook metadata, plus dormant legacy medical rows | authorization/access controls; password Argon2 hashes; refresh/reset/verification token hashes; designated free-text ciphertext; no raw purchase receipt or full provider webhook payload; most structured wellness/fitness fields not field-encrypted |
| Web runtime        | memory-only authenticated session for current portals                                                                                                                     | no sensitive local/session storage; only non-sensitive language preference may persist; no browser database-backed fitness data                                                              |
| Postmark           | transactional email recipient, locale-derived message, and recovery/verification link                                                                                     | HTTPS REST transport; open/link tracking recorded disabled in deployment evidence                                                                                                            |
| Cloudflare portals | account/recovery/verification static Web surfaces and ordinary request metadata                                                                                           | hosted outside this repository; environment-specific API origin allow-lists                                                                                                                  |
| Sentry             | scrubbed crash/error events from configured builds                                                                                                                        | TLS, `sendDefaultPii: false`, repository `beforeSend`/`beforeBreadcrumb` scrubbers; candidate re-verification pending                                                                        |
| RevenueCat         | AppFitness account UUID plus purchase/entitlement lifecycle needed for store billing reconciliation and customer deletion                                                | server adapter and native SDK boundary implemented but disabled; native module is lazy without public keys; no account/secret/live traffic yet; no email, username or health profile attributes |

## Field and payload encryption boundaries

- **AES-256-GCM field encryption on device and server:** optional
  dietary-preference free-text note and retained legacy medical free-text.
- **Encrypted local queue payloads:** operations flagged sensitive, including
  dietary preferences and meal items, are stored as encrypted envelopes on
  device. This does not make the underlying structured server rows or every
  conflict snapshot field-encrypted.
- **Not field-encrypted:** structured wellness-safety data, progress metrics and
  snapshots, workout data, food-log rows, goals, and most profile fields.
- **Credentials:** passwords are Argon2-hashed; refresh, password-reset, and
  email-verification tokens are hash-only on the server. The raw reset or
  verification value is delivered by transactional link and submitted by the
  client for redemption; it is not persisted server-side.
- **Diagnostics/logging:** raw authentication tokens, emailed bearer tokens,
  message bodies, declared wellness tokens, personal identifiers, and health
  values must not enter logs, audit metadata, or Sentry events. Scrubbers and
  source-level guards support this boundary; manual candidate verification is a
  separate release gate.

## Transmission and external service paths

- Production API and portal traffic uses HTTPS/TLS. Release mobile builds block
  cleartext; only the local E2E variant permits a disposable HTTP test API.
- Railway hosts the API and PostgreSQL environments.
- Postmark provides transactional recovery and verification delivery.
- Cloudflare serves the deployed Web portals.
- Sentry provides error monitoring for configured environments.
- RevenueCat is the accepted subscription processor. S-1 can query normalized
  entitlement state, receive authenticated/signed lifecycle events and request
  provider-customer deletion. S-2 adds a native adapter that supplies only the
  authenticated account UUID and stays inert without its platform public key.
  It never creates an anonymous provider identity. After sign-out the on-device
  SDK may retain the last account UUID and entitlement cache until another
  account signs in or the app process ends, but no purchase operation is
  reachable while signed out. Both provider paths remain disabled until the external account, agreements
  and separate configuration are approved.
- No advertising or third-party analytics SDK is integrated.

`[PLACEHOLDER — qualified legal review must classify service-provider roles,
subprocessors, regions, international transfers, agreements, and store-policy
“sharing” answers.]`

## Synchronization and conflict handling

Native writes are local-first, queued, and synchronized with authenticated,
owner-scoped operations. Operation ids provide server idempotency. Version
differences can create conflict records. The native `/sync-conflicts` surface
shows only allow-listed, localized fields and lets the user choose a supported
resolution. Unsupported/redacted values fail closed. Conflict and queue rows are
deleted with the account.

## Deletion and retention (ADR-P011)

- The in-app guarded flow calls the authenticated account-deletion endpoint.
- The API records the deletion event, severs `user_id` from the immutable audit
  rows, requests provider-customer deletion first when RevenueCat is enabled,
  and physically deletes the user only after that succeeds; database cascades
  remove user-owned profile, wellness, nutrition, workout, progress, token,
  sync, conflict, and dormant legacy medical rows.
- Shared food/exercise catalog data remains because it is not user-owned.
- Native local data is wiped after successful deletion. App-private data is also
  removed on uninstall.
- The only retained artifact is the anonymized security audit record.
- No self-service export flow exists yet.

`[PLACEHOLDER — qualified legal review must determine audit-record retention,
legal-hold obligations, and whether an in-scope jurisdiction conflicts with the
implemented immediate irreversible deletion model.]`

## Not collected or not implemented in public v1

- No doctor notes, medications, medical conditions, blood pressure,
  professional restrictions, diagnoses, treatments, rehabilitation
  instructions, clearance, or professional evaluation results through the
  public product.
- No precise location, contacts, photos, microphone/audio, advertising
  identifier, ad SDK, or analytics SDK.
- No full card/bank data, raw store receipt or full RevenueCat webhook payload
  is collected or retained. S-1 stores only the minimum normalized
  store/entitlement lifecycle fields and event-id/hash metadata. The native
  adapter is implemented but purchase collection and provider traffic remain
  unconfigured and unverified.
- No habit-tracking or notification-preference data; those phases are post-v1.
- No supplement recommendation, dosage, product/brand, or interaction data.
- No browser-persistent fitness/wellness database and no current Web/mobile
  feature parity.
- No self-service data export flow. Account deletion is implemented.
