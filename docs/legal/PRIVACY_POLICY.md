# AppFitnessRD — Privacy Policy (DRAFT)

> **DRAFT — NOT LEGAL ADVICE.** Engineering-produced draft grounded in
> `DATA_INVENTORY.md`. It MUST be reviewed and completed by a qualified
> human/legal reviewer before publication or any app-store submission.
> Bracketed `[PLACEHOLDER]` fields require business/legal input. Do not treat
> this as a published policy or as evidence of legal compliance.

> Draft technically refreshed 2026-09-30 · Evidence baseline `0e3c4f6` plus
> the FEATURE-012 S-1 candidate · App
> state: public-v1 Phase 21 wellness product, including bilingual surfaces,
> wellness-safety declarations, conflict resolution, password recovery, and
> email verification. External legal review remains pending.

Effective date: `[PLACEHOLDER — actual first-public-release date; owner target November 2026 or earlier]`
Data controller: Nelson Deschamps, an individual trading as HardTech Solutions,
Calle La Guardia 41, Santo Domingo D.N., Dominican Republic
Privacy contact: `privacy@appfitnessrd.com`
Support contact: `support@appfitnessrd.com`

## 1. Summary

AppFitnessRD helps you track fitness, nutrition, progress, and wellness data
and receive deterministic coaching recommendations. We collect only what the
current product needs to function. We do **not** sell your data, show
third-party ads, or include third-party analytics SDKs. This policy describes
what we process and your choices.

## 2. Data we process

Grounded in `DATA_INVENTORY.md`:

- **Account and authentication:** email, username, password (stored only as an
  Argon2 hash), email-verification status, session information, and hashed
  refresh, password-reset, and email-verification tokens. Raw reset and
  verification values are not stored server-side; an emailed link carries the
  value that the client submits for redemption.
- **Profile:** birth date, gender, height, fitness level, activity level,
  training preferences, equipment, schedule, sleep/stress baselines, and
  similar profile attributes you enter.
- **Wellness Safety Profile:** whether you report completing a professional
  physical evaluation, the date when provided, and closed-list areas or
  movements you ask the app to avoid. The app does not collect the evaluation
  result or professional findings through this profile.
- **Nutrition:** foods and quantities you log, calories/macronutrients, meal
  entries, and dietary preferences or allergies. An optional
  dietary-preference note is AES-256-GCM encrypted at rest on your device and
  on the server. Other structured nutrition data is not field-encrypted.
- **Workout:** logged workouts and sets, routines you build, and custom
  exercises you create.
- **Progress:** body-weight and body-measurement entries (including waist,
  hip, chest, body-fat percentage, and muscle mass when entered) and
  deterministic weekly progress snapshots computed on your device. This
  wellness data is not field-encrypted at rest; it is protected by
  app-private storage, TLS in transit, and server access controls.
- **Goals:** goal type and optional targets.
- **Synchronization:** queued operations, version/cursor metadata, and conflict
  records used to synchronize devices and let you review unresolved
  differences. Sensitive queued payloads identified in `DATA_INVENTORY.md`
  are encrypted on device; this does not mean every sync or conflict field is
  field-encrypted.
- **On-device data:** an offline-first SQLite database and a device encryption
  key held in your device's secure keystore. The database-backed product is a
  native mobile capability; the current Web portals do not persist this data
  in browser storage.
- **Transactional email:** Postmark receives the recipient address, language,
  and password-recovery or email-verification message needed to deliver those
  emails. These messages are transactional, not marketing mail.
- **Diagnostics:** configured production builds may send scrubbed crash/error
  data to Sentry, including an opaque user identifier and app/device/runtime
  metadata. `sendDefaultPii` is disabled and repository scrubbers remove
  identified credential, token, personal, and health fields. Candidate-build
  monitoring must still be reverified before release.

Public v1 does **not** ask for doctor notes, medications, medical conditions,
blood pressure, diagnoses, treatment instructions, professional restrictions,
or professional evaluation results. The repository retains a dormant legacy
medical implementation and may retain legacy rows created by earlier builds;
that capability is not exposed, written, synchronized, or used by public-v1
iCoach. Any retained legacy rows remain protected and are removed by account
deletion.

We do **not** collect precise location, contacts, photos, microphone/audio, or
advertising identifiers. Habits, push notifications, and supplement education
are not implemented in public v1.

**Subscription implementation gate:** the owner has selected a one-month free
trial followed by an auto-renewing monthly subscription with a target base price
of US$5. The repository now implements a disabled-by-default server entitlement
mirror, minimal event-id/hash ledger, RevenueCat reconciliation/webhook adapter
and provider-first deletion. It does not yet implement the native purchase
flow, paywall or access enforcement, and no provider account or secret is
configured. Before release, this policy must be reconciled to the completed
Apple/Google path, provider agreement, retention/deletion behavior, and exact
store disclosures. AppFitnessRD must never receive or store full payment-card
details for the mobile subscription.

## 3. How we use data

- To provide authentication, password recovery, email verification, local
  storage, synchronization, conflict review/resolution, fitness and nutrition
  tracking, and deterministic on-device coaching.
- To apply user-declared movement exclusions conservatively to deterministic
  assessment and routine generation. These declarations are not diagnoses or
  professional medical restrictions.
- To keep the service reliable and secure through operational audit records
  and scrubbed error monitoring.

We rely on `[PLACEHOLDER: applicable legal bases and any consent requirements,
to be determined by qualified legal review]`. No legal basis is established by
this engineering draft.

## 4. Storage, security, and transmission

- Production traffic is encrypted in transit using HTTPS/TLS.
- Passwords are Argon2-hashed; refresh, reset, and verification tokens are
  stored only as hashes on the server.
- The optional dietary-preference note and retained legacy medical free-text
  are AES-256-GCM encrypted at rest on device and server. Other structured
  fitness/wellness data is not field-encrypted at rest.
- Session tokens and the device field-encryption key are stored in the native
  OS secure keystore, never in SQLite. The current Web session is memory-only.
- Public-v1 iCoach decisions are deterministic, versioned, and run from
  structured local inputs; generative AI is not the decision maker.

No security control eliminates all risk. `[PLACEHOLDER: final security and
incident-response wording after legal review.]`

## 5. External services and disclosures

The engineering inventory identifies these external service paths:

- Railway hosts the API and PostgreSQL environments.
- Postmark delivers transactional recovery and verification email.
- Cloudflare serves the deployed account/recovery/verification Web portals.
- Sentry receives scrubbed diagnostics from configured builds.

ADR-P034 approves RevenueCat for the store-subscription implementation. Its S-1
server adapter is present but disabled and has no configured account, secret or
live traffic; it becomes an active service path only after those external gates
are approved and enabled.

The app contains no advertising or third-party analytics SDK. `[PLACEHOLDER:
qualified legal review must classify each service relationship, finalize the
subprocessor list, regions, transfer terms, and required disclosures; do not
infer a Play/App Store “sharing” answer from this engineering description.]`

## 6. Data retention and deletion

**Current product behavior:** the in-app **Delete account** action immediately
and irreversibly deletes the account and its user-owned data, including profile,
wellness-safety, nutrition, workout, progress, token, sync, and conflict rows.
Only an anonymized security audit record is retained. The owner's selected
retention period for that anonymized record is 12 months, subject to qualified
legal confirmation and an implemented expiry/deletion procedure. The local database is
wiped as part of successful account deletion; uninstalling the app removes its
app-private local data. A separate user-facing data-export flow is not yet
available.

`[PLACEHOLDER: qualified legal review must determine retention periods for the
anonymized security audit, any legal-hold obligations, and whether an in-scope
jurisdiction conflicts with immediate irreversible deletion.]`

## 7. Your rights

Subject to applicable law, you may have rights to access, export, correct,
delete, restrict processing, or withdraw consent. Deletion can be exercised
directly in the app. Until self-service export exists, send other requests from
the account's registered email to `privacy@appfitnessrd.com`. The operator will
verify control of the account, prepare the data available to the service,
deliver it through a secure channel, record completion, and confirm the outcome
to the requester. `[PLACEHOLDER: counsel must approve the applicable rights,
identity-verification standard, secure-delivery method, and statutory response
deadline.]`

## 8. Children

The owner-selected product minimum age is 16. The service is not directed to
children under 16. `[PLACEHOLDER — qualified legal review must decide whether
users aged 16–17 require parent/guardian consent, how age is verified, and the
corresponding store audience settings.]`

## 9. International transfers

`[PLACEHOLDER — hosting/service regions and any transfer mechanisms must be
confirmed in qualified legal review.]`

## 10. Changes and contact

We will update this policy as the product evolves. Spanish is the controlling
legal version; English is provided as a translation, while the app displays the
user's selected language. Contact `privacy@appfitnessrd.com` for privacy
requests or `support@appfitnessrd.com` for product support. The owner confirmed
receipt at the privacy mailbox on 2026-09-29.
